import { useEffect, useMemo, useState } from 'react';
import { useAccount, useChainId, usePublicClient, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { formatEther, formatUnits, zeroAddress } from 'viem';
import { stableYieldAccumulatorAbi } from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { usePolling } from '../contexts/PollingContext';
import { useToast } from '../components/ui/ToastProvider';
import { syaHarvesterAbi } from '../lib/syaHarvesterAbi';
import { decodeContractError } from '../lib/decodeContractError';
import { FORGE_HARVEST_MIN_OUT_BPS } from '../data/forgeMockData';
import { log } from '../utils/logger';

/** Re-quote cadence while real-time updates are on. Matches the Stake tab heartbeat. */
const HARVEST_REFRESH_INTERVAL_MS = 12_000;
/** Margin on the gas estimate used as the tx gas limit (harvest.sh default: 20%). */
const GAS_LIMIT_MARGIN_BPS = 2_000n;
/**
 * `harvest`'s `nftIndex` argument. The gate-free SYA (phStaging2 story 131) has
 * `nftMinter() == 0`, so `claim` ignores the index and the harvester moves no
 * NFT. `0` is the harvester's documented "transfer no NFT" value.
 */
const NO_NFT_INDEX = 0n;

/**
 * The outcome of simulating `harvest([], 0, 0)` at a ZERO gas price.
 *
 * The harvester has no view quote, and its on-chain guard reverts
 * `Unprofitable` whenever `ethOut < (gasUsed + GAS_OVERHEAD) * tx.gasprice`.
 * At a zero gas price that guard is trivially satisfied, so the simulation runs
 * the real flash-loan path and returns the real `ethOut`, and the gas estimate
 * returns the real gas units (gas use does not depend on price). Profitability
 * is then decided client-side against live fees (`harvestProfitability`)
 * instead of by decoding an `Unprofitable` revert, which wallet RPCs often
 * strip of its data.
 *
 * `ok` also carries the live fee fields the profit was priced at. The harvest
 * transaction is sent with exactly those, so the contract's own guard sees the
 * same gas price and stays the on-chain backstop if gas spikes.
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
  | { kind: 'error'; message: string };

/** Why there is no quote yet. `null` once a quote can be (or has been) taken. */
export type HarvestBlocker =
  | 'inactive'
  | 'disconnected'
  | 'loading'
  | null;

export interface ForgeHarvestState {
  /** False when SYAHarvester is the zero address on this network. */
  active: boolean;
  /** `SYAHarvester.owner()`, used to gate admin-only Forge rows. */
  owner: `0x${string}` | undefined;
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
  pendingAction: 'harvest' | null;
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
 * `eth_call` of `harvest(exempt=[], nftIndex=0, minEthOut=0)` from the connected
 * wallet, both at a zero gas price, with profit priced client-side against live
 * fees (see `HarvestQuoteResult`).
 * The SYA is gate-free, so no claim NFT is held, approved or burned: any
 * connected wallet can be quoted.
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
  // yield is read from the accumulator it actually claims from.
  const { data: syaRaw } = useReadContract({
    address: harvester,
    abi: syaHarvesterAbi,
    functionName: 'sya',
    query: { enabled: active },
  });
  const sya = liveAddress(syaRaw);

  const { data: totalYieldRaw, refetch: refetchYield } = useReadContract({
    address: sya,
    abi: stableYieldAccumulatorAbi,
    functionName: 'getTotalYield',
    query: { enabled: !!sya, refetchInterval },
  });
  const yieldUsd = totalYieldRaw === undefined ? null : Number(formatUnits(totalYieldRaw as bigint, 18));

  // The fixed gas the contract adds to its own measurement before comparing
  // against `ethOut`. Read rather than hard-coded so a redeploy cannot drift.
  const { data: gasOverhead } = useReadContract({
    address: harvester,
    abi: syaHarvesterAbi,
    functionName: 'GAS_OVERHEAD',
    query: { enabled: active },
  });

  let blocker: HarvestBlocker = null;
  if (!active) blocker = 'inactive';
  else if (!wallet) blocker = 'disconnected';
  else if (!sya || gasOverhead === undefined) blocker = 'loading';

  const quoteQuery = useQuery<HarvestQuoteResult>({
    queryKey: ['forge-harvest-quote', chainId, harvester, wallet],
    enabled: blocker === null && !!publicClient,
    refetchInterval,
    retry: false,
    queryFn: async () => {
      const client = publicClient!;
      // Zero gas price on purpose: see HarvestQuoteResult.
      const call = {
        address: harvester!,
        abi: syaHarvesterAbi,
        functionName: 'harvest',
        args: [[], NO_NFT_INDEX, 0n],
        account: wallet!,
        gasPrice: 0n,
      } as const;
      try {
        const [{ maxFeePerGas, maxPriorityFeePerGas }, gasUnits] = await Promise.all([
          client.estimateFeesPerGas(),
          client.estimateContractGas(call),
        ]);
        const gasLimit = (gasUnits * (10_000n + GAS_LIMIT_MARGIN_BPS)) / 10_000n;
        const { result } = await client.simulateContract({ ...call, gas: gasLimit });
        return { kind: 'ok', ethOutWei: result, gasUnits, gasLimit, maxFeePerGas, maxPriorityFeePerGas };
      } catch (error) {
        const decoded = decodeContractError(error);
        log.warn('Harvest quote failed:', error);
        return { kind: 'error', message: decoded.message };
      }
    },
  });
  const quote = blocker === null ? quoteQuery.data : undefined;

  const display = useMemo<ForgeHarvestState['display']>(() => {
    if (!quote || quote.kind === 'error' || gasOverhead === undefined) return null;
    const { gasCostWei, profitable } = harvestProfitability(quote, gasOverhead);
    return {
      ethOut: Number(formatEther(quote.ethOutWei)),
      gasEth: Number(formatEther(gasCostWei)),
      gasUnits: Number(quote.gasUnits),
      gasGwei: Number(formatUnits(quote.maxFeePerGas, 9)),
      minEthOut: profitable ? Number(formatEther(minEthOutWei(quote.ethOutWei))) : 0,
      profitable,
    };
  }, [quote, gasOverhead]);

  // ---- Writes -------------------------------------------------------------
  const [pendingAction, setPendingAction] = useState<'harvest' | null>(null);
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

  const harvest = async () => {
    if (!quote || quote.kind !== 'ok' || !display?.profitable || !harvester) return;
    try {
      setPendingAction('harvest');
      addToast({ type: 'info', title: 'Confirm Transaction', description: 'Please confirm the harvest in your wallet.', duration: 30000 });
      const hash = await writeContractAsync({
        address: harvester,
        abi: syaHarvesterAbi,
        functionName: 'harvest',
        args: [[], NO_NFT_INDEX, minEthOutWei(quote.ethOutWei)],
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
    refetchYield();
    quoteQuery.refetch();
    setPendingAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [harvestDone, harvestFailed, harvestHash]);

  return {
    active,
    owner,
    yieldUsd,
    blocker,
    quote,
    isQuoting: quoteQuery.isFetching && !quoteQuery.data,
    display,
    pendingAction,
    harvest,
  };
}

/**
 * Client-side profitability of a zero-fee harvest quote, priced at live fees.
 *
 * `gasCostWei` is what the caller pays, priced at `maxFeePerGas` (an upper
 * bound: the tx is charged `min(maxFee, baseFee + priority)`).
 *
 * `profitable` mirrors the contract's own guard,
 * `ethOut >= (gasUsed + GAS_OVERHEAD) * tx.gasprice`, conservatively: the
 * estimate already exceeds the contract's in-call `gasUsed` (it adds the 21k
 * intrinsic cost and calldata), and `maxFeePerGas >= tx.gasprice`. So a quote
 * shown as profitable is one the contract will not reject as `Unprofitable`
 * at the quoted fees, and it also covers what the caller actually pays.
 */
export function harvestProfitability(
  quote: { ethOutWei: bigint; gasUnits: bigint; maxFeePerGas: bigint },
  gasOverhead: bigint,
): { gasCostWei: bigint; profitable: boolean } {
  const gasCostWei = quote.gasUnits * quote.maxFeePerGas;
  const contractThresholdWei = (quote.gasUnits + gasOverhead) * quote.maxFeePerGas;
  return { gasCostWei, profitable: quote.ethOutWei > contractThresholdWei };
}

/** `minEthOut` in wei: the quoted payout less the Forge haircut, rounded down. */
function minEthOutWei(ethOutWei: bigint): bigint {
  return (ethOutWei * BigInt(FORGE_HARVEST_MIN_OUT_BPS)) / 10_000n;
}
