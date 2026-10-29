import { useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId, usePublicClient, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { formatEther, formatUnits, zeroAddress } from 'viem';
import { nftMinterV2Abi, stableYieldAccumulatorAbi } from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { usePolling } from '../contexts/PollingContext';
import { useMinterPageView } from './useMinterPageView';
import { useToast } from '../components/ui/ToastProvider';
import { useERC1155ApprovalForAll } from './useERC1155ApprovalForAll';
import { syaHarvesterAbi } from '../lib/syaHarvesterAbi';
import { decodeContractError } from '../lib/decodeContractError';
import { nftStaticConfig } from '../data/nftMockData';
import { FORGE_HARVEST_DEFAULT_NFT_ID, FORGE_HARVEST_MIN_OUT_BPS } from '../data/forgeMockData';
import { log } from '../utils/logger';

/** Re-quote cadence while real-time updates are on. Matches the Stake tab heartbeat. */
const HARVEST_REFRESH_INTERVAL_MS = 12_000;
/** Margin on the gas estimate used as the tx gas limit (harvest.sh default: 20%). */
const GAS_LIMIT_MARGIN_BPS = 2_000n;

/**
 * The simulated outcome of `harvest([], nftIndex, 0)`.
 *
 * `ok` carries the fee fields the quote was taken at, so the transaction is
 * sent with exactly those: the contract's on-chain `Unprofitable` check uses
 * `tx.gasprice`, and simulating at a zero gas price (most wallets' default)
 * would pass it trivially and quote a harvest that reverts for real.
 */
export type HarvestQuoteResult =
  | {
      kind: 'ok';
      ethOutWei: bigint;
      gasUnits: bigint;
      gasLimit: bigint;
      maxFeePerGas: bigint;
      maxPriorityFeePerGas: bigint;
    }
  /** The contract itself rejected the harvest as not covering its gas. */
  | { kind: 'unprofitable'; ethOutWei: bigint; gasCostWei: bigint; maxFeePerGas: bigint }
  | { kind: 'error'; message: string };

/** Why there is no quote yet. `null` once a quote can be (or has been) taken. */
export type HarvestBlocker =
  | 'inactive'
  | 'disconnected'
  | 'loading'
  | 'no-nft'
  | 'needs-approval'
  | null;

export interface ForgeHarvestState {
  /** False when SYAHarvester is the zero address on this network. */
  active: boolean;
  /** `SYAHarvester.owner()`, used to gate admin-only Forge rows. */
  owner: `0x${string}` | undefined;
  /** SYA still burns a claim NFT per claim (its `nftMinter()` is set). */
  requiresNft: boolean;
  /**
   * Wallet claim-NFT holdings, keyed by `nftStaticConfig` id → units. That id is
   * a display key only; the on-chain ERC1155 tokenId is the dispatcher index.
   */
  nftHoldings: Record<number, number>;
  selectedNftId: number;
  setSelectedNftId: (id: number) => void;
  /** `setApprovalForAll(harvester)` on the claim-NFT minter. */
  nftApproved: boolean;
  /** SYA `getTotalYield()`, USD (18 dp on-chain). `null` while unknown. */
  yieldUsd: number | null;
  blocker: HarvestBlocker;
  quote: HarvestQuoteResult | undefined;
  isQuoting: boolean;
  /** Human-unit view of an `ok` / `unprofitable` quote, for display. */
  display: {
    ethOut: number;
    gasEth: number;
    gasUnits: number;
    gasGwei: number;
    minEthOut: number;
    profitable: boolean;
  } | null;
  pendingAction: 'approve' | 'harvest' | null;
  approveNfts: () => Promise<void>;
  harvest: () => Promise<void>;
}

const liveAddress = (value: unknown): `0x${string}` | undefined => {
  const addr = value as `0x${string}` | undefined;
  return addr && addr !== zeroAddress ? addr : undefined;
};

/**
 * Live wiring for the Forge "Harvest Yield" row (`SYAHarvester`).
 *
 * There is no view quote on the harvester: the ETH it pays is only known by
 * running the whole flash-loan path. So the quote is a gas estimate plus an
 * `eth_call` of `harvest(exempt=[], nftIndex, minEthOut=0)` from the connected
 * wallet, both carrying real EIP-1559 fee fields (see `HarvestQuoteResult`).
 * While SYA still burns a claim NFT, that simulation needs the wallet to hold
 * the chosen NFT and to have approved the harvester, so no quote is possible
 * before both.
 */
export function useForgeHarvest(): ForgeHarvestState {
  const { address: wallet } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { addresses, networkType } = useContractAddresses();
  const { isPollingEnabled } = usePolling();
  const { addToast } = useToast();

  const harvester = liveAddress(addresses?.SYAHarvester);
  const active = !!harvester;
  const refetchInterval = isPollingEnabled ? HARVEST_REFRESH_INTERVAL_MS : false;

  const { data: owner } = useReadContract({
    address: harvester,
    abi: syaHarvesterAbi,
    functionName: 'owner',
    query: { enabled: active },
  });

  // The harvester's own SYA (immutable), not the address-server key, so the
  // NFT minter and yield are read from the accumulator it actually claims from.
  const { data: syaRaw } = useReadContract({
    address: harvester,
    abi: syaHarvesterAbi,
    functionName: 'sya',
    query: { enabled: active },
  });
  const sya = liveAddress(syaRaw);

  const { data: nftMinterRaw, isLoading: nftMinterLoading } = useReadContract({
    address: sya,
    abi: stableYieldAccumulatorAbi,
    functionName: 'nftMinter',
    query: { enabled: !!sya },
  });
  const nftMinter = liveAddress(nftMinterRaw);
  const requiresNft = !!nftMinter;

  const { data: totalYieldRaw, refetch: refetchYield } = useReadContract({
    address: sya,
    abi: stableYieldAccumulatorAbi,
    functionName: 'getTotalYield',
    query: { enabled: !!sya, refetchInterval },
  });
  const yieldUsd = totalYieldRaw === undefined ? null : Number(formatUnits(totalYieldRaw as bigint, 18));

  // NFTMinterV2 mints tokenId == dispatcher index, assigned in registration
  // order (EYE 1, SCX 2, Flax 3, ...), which is NOT the nftStaticConfig id
  // order. Read each NFT's index from MintPageView, as the mint flow does.
  const { data: mintView, isLoading: mintViewLoading } = useMinterPageView();
  const tokenIds = useMemo(() => {
    const out: { configId: number; tokenId: bigint }[] = [];
    if (!mintView) return out;
    for (const n of nftStaticConfig) {
      const index = mintView[n.tokenPrefix]?.dispatcherIndex;
      if (index) out.push({ configId: n.id, tokenId: BigInt(index) });
    }
    return out;
  }, [mintView]);

  const { data: balancesRaw, refetch: refetchHoldings } = useReadContract({
    address: nftMinter,
    abi: nftMinterV2Abi,
    functionName: 'balanceOfBatch',
    args: wallet ? [tokenIds.map(() => wallet), tokenIds.map((t) => t.tokenId)] : undefined,
    query: { enabled: !!nftMinter && !!wallet && tokenIds.length > 0, refetchInterval },
  });
  const nftHoldings = useMemo(() => {
    const out: Record<number, number> = {};
    const balances = balancesRaw as readonly bigint[] | undefined;
    tokenIds.forEach(({ configId }, i) => {
      out[configId] = balances ? Number(balances[i] ?? 0n) : 0;
    });
    return out;
  }, [balancesRaw, tokenIds]);

  const approval = useERC1155ApprovalForAll(wallet, harvester, nftMinter);

  // Default to the first held NFT once holdings load, unless the user picked one they hold.
  const [selectedNftId, setSelectedNftId] = useState(FORGE_HARVEST_DEFAULT_NFT_ID);
  useEffect(() => {
    if ((nftHoldings[selectedNftId] ?? 0) > 0) return;
    const held = nftStaticConfig.find((n) => (nftHoldings[n.id] ?? 0) > 0);
    if (held) setSelectedNftId(held.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nftHoldings]);

  const holdsSelected = (nftHoldings[selectedNftId] ?? 0) > 0;
  const selectedTokenId = tokenIds.find((t) => t.configId === selectedNftId)?.tokenId;
  const nftIndex = requiresNft ? selectedTokenId ?? 0n : 0n;

  let blocker: HarvestBlocker = null;
  if (!active) blocker = 'inactive';
  else if (!wallet) blocker = 'disconnected';
  else if (!sya || nftMinterLoading || (requiresNft && (mintViewLoading || !mintView))) blocker = 'loading';
  else if (requiresNft && !holdsSelected) blocker = 'no-nft';
  else if (requiresNft && !approval.isApprovedForAll) blocker = 'needs-approval';

  const quoteQuery = useQuery<HarvestQuoteResult>({
    queryKey: ['forge-harvest-quote', chainId, harvester, wallet, nftIndex.toString()],
    enabled: blocker === null && !!publicClient,
    refetchInterval,
    retry: false,
    queryFn: async () => {
      const client = publicClient!;
      const { maxFeePerGas, maxPriorityFeePerGas } = await client.estimateFeesPerGas();
      const call = {
        address: harvester!,
        abi: syaHarvesterAbi,
        functionName: 'harvest',
        args: [[], nftIndex, 0n],
        account: wallet!,
        maxFeePerGas,
        maxPriorityFeePerGas,
      } as const;
      try {
        const gasUnits = await client.estimateContractGas(call);
        const gasLimit = (gasUnits * (10_000n + GAS_LIMIT_MARGIN_BPS)) / 10_000n;
        const { result } = await client.simulateContract({ ...call, gas: gasLimit });
        return { kind: 'ok', ethOutWei: result, gasUnits, gasLimit, maxFeePerGas, maxPriorityFeePerGas };
      } catch (error) {
        const decoded = decodeContractError(error);
        if (decoded.errorName === 'Unprofitable') {
          const [ethOutWei, gasCostWei] = decoded.args as readonly [bigint, bigint];
          return { kind: 'unprofitable', ethOutWei, gasCostWei, maxFeePerGas };
        }
        log.warn('Harvest quote failed:', error);
        return { kind: 'error', message: decoded.message };
      }
    },
  });
  const quote = blocker === null ? quoteQuery.data : undefined;

  const display = useMemo<ForgeHarvestState['display']>(() => {
    if (!quote || quote.kind === 'error') return null;
    const gasGwei = Number(formatUnits(quote.maxFeePerGas, 9));
    if (quote.kind === 'unprofitable') {
      const ethOut = Number(formatEther(quote.ethOutWei));
      const gasEth = Number(formatEther(quote.gasCostWei));
      const gasUnits = quote.maxFeePerGas > 0n ? Number(quote.gasCostWei / quote.maxFeePerGas) : 0;
      return { ethOut, gasEth, gasUnits, gasGwei, minEthOut: 0, profitable: false };
    }
    const ethOut = Number(formatEther(quote.ethOutWei));
    // Priced at maxFeePerGas: an upper bound on what the tx actually pays.
    const gasEth = Number(formatEther(quote.gasUnits * quote.maxFeePerGas));
    const minEthOut = Number(formatEther(minEthOutWei(quote.ethOutWei)));
    return { ethOut, gasEth, gasUnits: Number(quote.gasUnits), gasGwei, minEthOut, profitable: ethOut > gasEth };
  }, [quote]);

  // ---- Writes -------------------------------------------------------------
  const [pendingAction, setPendingAction] = useState<'approve' | 'harvest' | null>(null);
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: approveDone, isError: approveFailed } = useWaitForTransactionReceipt({
    hash: approveHash,
    query: { enabled: !!approveHash },
  });
  const { data: harvestHash, writeContractAsync } = useWriteContract();
  const { isSuccess: harvestDone, isError: harvestFailed } = useWaitForTransactionReceipt({
    hash: harvestHash,
    query: { enabled: !!harvestHash },
  });

  const explorerUrl = (hash: string) =>
    networkType === 'mainnet' ? `https://etherscan.io/tx/${hash}` : `https://sepolia.etherscan.io/tx/${hash}`;
  const submittedToast = (hash: string) =>
    addToast({
      type: 'info',
      title: 'Transaction Submitted',
      description: 'Waiting for blockchain confirmation...',
      duration: 30000,
      action: { label: 'View on Etherscan', onClick: () => window.open(explorerUrl(hash), '_blank') },
    });
  const failToast = (error: unknown, title: string) => {
    const decoded = decodeContractError(error);
    log.error(`${title}:`, error);
    addToast(
      decoded.userRejected
        ? { type: 'error', title: 'Transaction Cancelled', description: 'You cancelled the transaction.', duration: 8000 }
        : { type: 'error', title, description: decoded.message, duration: 16000 },
    );
  };

  const approveNfts = async () => {
    if (!wallet) {
      addToast({ type: 'error', title: 'Wallet Not Connected', description: 'Please connect your wallet using the button in the header.' });
      return;
    }
    try {
      setPendingAction('approve');
      addToast({ type: 'info', title: 'Confirm in Wallet', description: 'Approve the Harvester to use your claim NFTs.', duration: 30000 });
      const hash = await approval.approveAll();
      setApproveHash(hash);
      submittedToast(hash);
    } catch (error) {
      failToast(error, 'Approval Failed');
      setPendingAction(null);
    }
  };

  const harvest = async () => {
    if (!quote || quote.kind !== 'ok' || !display?.profitable || !harvester) return;
    try {
      setPendingAction('harvest');
      addToast({ type: 'info', title: 'Confirm Transaction', description: 'Please confirm the harvest in your wallet.', duration: 30000 });
      const hash = await writeContractAsync({
        address: harvester,
        abi: syaHarvesterAbi,
        functionName: 'harvest',
        args: [[], nftIndex, minEthOutWei(quote.ethOutWei)],
        gas: quote.gasLimit,
        maxFeePerGas: quote.maxFeePerGas,
        maxPriorityFeePerGas: quote.maxPriorityFeePerGas,
      });
      submittedToast(hash);
    } catch (error) {
      failToast(error, 'Harvest Failed');
      setPendingAction(null);
    }
  };

  useEffect(() => {
    if (!approveHash) return;
    if (approveDone) {
      addToast({ type: 'success', title: 'Approval Successful', description: 'The Harvester can now use your claim NFTs.', duration: 12000 });
      approval.refetch();
    } else if (approveFailed) {
      addToast({ type: 'error', title: 'Approval Failed', description: 'The approval transaction reverted.', duration: 16000 });
    } else {
      return;
    }
    setPendingAction(null);
    setApproveHash(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveDone, approveFailed, approveHash]);

  useEffect(() => {
    if (!harvestHash || pendingAction !== 'harvest') return;
    if (harvestDone) {
      addToast({
        type: 'success',
        title: 'Harvest Successful',
        description: 'Yield harvested; the ETH profit has been sent to your wallet.',
        duration: 30000,
        action: { label: 'View Transaction', onClick: () => window.open(explorerUrl(harvestHash), '_blank') },
      });
    } else if (harvestFailed) {
      addToast({ type: 'error', title: 'Harvest Failed', description: 'The harvest transaction reverted.', duration: 16000 });
    } else {
      return;
    }
    refetchHoldings();
    refetchYield();
    quoteQuery.refetch();
    setPendingAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [harvestDone, harvestFailed, harvestHash]);

  return {
    active,
    owner,
    requiresNft,
    nftHoldings,
    selectedNftId,
    setSelectedNftId,
    nftApproved: approval.isApprovedForAll,
    yieldUsd,
    blocker,
    quote,
    isQuoting: quoteQuery.isFetching && !quoteQuery.data,
    display,
    pendingAction,
    approveNfts,
    harvest,
  };
}

/** `minEthOut` in wei: the quoted payout less the Forge haircut, rounded down. */
function minEthOutWei(ethOutWei: bigint): bigint {
  return (ethOutWei * BigInt(FORGE_HARVEST_MIN_OUT_BPS)) / 10_000n;
}
