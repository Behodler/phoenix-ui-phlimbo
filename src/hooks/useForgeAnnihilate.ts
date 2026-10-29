import { useEffect, useState } from 'react';
import {
  useAccount,
  useChainId,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { erc20Abi, formatUnits, maxUint256, parseUnits, zeroAddress } from 'viem';
import { antimatterAbi, phusdStableMinterAbi } from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { usePolling } from '../contexts/PollingContext';
import { useToast } from '../components/ui/ToastProvider';
import { useWalletBalances } from '../contexts/WalletBalancesContext';
import { useTokenApproval } from './useContractInteractions';
import { useBalancerPrice } from './useBalancerPrice';
import { ANNIHILATE_PRICE_FLOOR } from './useStableStakerPools';
import { STABLE_POOLS, type StablePoolConfig } from '../data/stableStakerPools';
import { ANTIMATTER_DECIMALS } from '../data/antimatterData';
import { FORGE_ANNIHILATE_SLIPPAGE_BPS } from '../data/forgeMockData';
import { decodeContractError } from '../lib/decodeContractError';
import { log } from '../utils/logger';

const REFRESH_INTERVAL_MS = 12_000;

/** Display symbols of the stablecoins that can be paired, in selector order. */
export type AnnihilateStableSymbol = 'USDC' | 'USDe' | 'DOLA';

const STABLES: Record<AnnihilateStableSymbol, StablePoolConfig> = {
  USDC: STABLE_POOLS.find((p) => p.id === 'usdc')!,
  USDe: STABLE_POOLS.find((p) => p.id === 'usde')!,
  DOLA: STABLE_POOLS.find((p) => p.id === 'dola')!,
};
export const ANNIHILATE_STABLE_ORDER: readonly AnnihilateStableSymbol[] = ['USDC', 'USDe', 'DOLA'];

export interface ForgeAnnihilateState {
  /** False when Antimatter / PhusdStableMinter is the zero address on this network. */
  active: boolean;
  paused: boolean;
  walletAntimatter: number;
  stableBalances: Record<AnnihilateStableSymbol, number>;
  /**
   * phUSD price for display. Off mainnet there is no market to read and the
   * repo's 1.0 stands; on mainnet this is the raw price, `null` when unknown.
   */
  price: number | null;
  /** Why annihilation is closed, or `null` when it is open. */
  gateReason: string | null;
  /** The gate is closed because phUSD trades at or below `ANNIHILATE_PRICE_FLOOR`. */
  priceGated: boolean;

  stable: AnnihilateStableSymbol;
  setStable: (s: AnnihilateStableSymbol) => void;
  amount: string;
  setAmount: (a: string) => void;

  /** Total phUSD the current amount fetches (antimatter half + minter quote), or null while unquoted. */
  phusdOut: number | null;
  /** `minPhUSDOut` the tx will carry, human units. */
  minPhusdOut: number | null;
  needsApproval: boolean;
  pendingAction: 'approve' | 'annihilate' | null;
  approve: () => Promise<void>;
  annihilate: () => Promise<void>;
}

const liveAddress = (value: unknown): `0x${string}` | undefined => {
  const addr = value as `0x${string}` | undefined;
  return addr && addr !== zeroAddress ? addr : undefined;
};

const safeParse = (amount: string, decimals: number): bigint => {
  try {
    return amount ? parseUnits(amount, decimals) : 0n;
  } catch {
    return 0n;
  }
};

/**
 * Live wiring for the Forge "Annihilate Antimatter" row: the wallet's own
 * loose Antimatter plus an equal quantity of a stablecoin, burned and
 * deposited through `Antimatter.annihilate(stable, recipient, amount, minPhUSDOut)`.
 *
 * Unlike the Stake tab's `autoAnnihilate`, this path pulls the stablecoin from
 * the wallet, so it needs an ERC20 approval to the Antimatter contract, and it
 * needs an honest `minPhUSDOut`. That floor is built from the contract's own
 * pieces: the antimatter half mints 1:1 and the stable half is whatever
 * `PhusdStableMinter.calculateMintAmount` quotes, both 18-dec phUSD.
 */
export function useForgeAnnihilate(): ForgeAnnihilateState {
  const { address: wallet } = useAccount();
  const chainId = useChainId();
  const isMainnet = chainId === 1;
  const { addresses, networkType } = useContractAddresses();
  const { isPollingEnabled } = usePolling();
  const { addToast } = useToast();
  const { refreshWalletBalances } = useWalletBalances();
  const { approve: approveToken } = useTokenApproval();
  const { price: balancerPrice } = useBalancerPrice();

  const antimatter = liveAddress(addresses?.Antimatter);
  const minter = liveAddress(addresses?.PhusdStableMinter);
  const active = !!antimatter && !!minter;
  const refetchInterval = isPollingEnabled ? REFRESH_INTERVAL_MS : false;

  const [stable, setStable] = useState<AnnihilateStableSymbol>('USDC');
  const [amount, setAmount] = useState('');
  const cfg = STABLES[stable];
  const tokenFor = (s: AnnihilateStableSymbol) => liveAddress(addresses?.[STABLES[s].addressKey]);
  const stableAddress = tokenFor(stable);

  const { data: pausedRaw } = useReadContract({
    address: antimatter,
    abi: antimatterAbi,
    functionName: 'paused',
    query: { enabled: active, refetchInterval },
  });
  const paused = pausedRaw === true;

  const { data: amBalanceRaw, refetch: refetchAm } = useReadContract({
    address: antimatter,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: wallet ? [wallet] : undefined,
    query: { enabled: active && !!wallet, refetchInterval },
  });
  const walletAntimatter = amBalanceRaw ? Number(formatUnits(amBalanceRaw, ANTIMATTER_DECIMALS)) : 0;

  // Balance + allowance (spender = Antimatter) for each pairable stable, in one multicall.
  const { data: stableReads, refetch: refetchStables } = useReadContracts({
    contracts: ANNIHILATE_STABLE_ORDER.flatMap((s) => {
      const token = tokenFor(s);
      return [
        { address: token, abi: erc20Abi, functionName: 'balanceOf', args: [wallet ?? zeroAddress] },
        { address: token, abi: erc20Abi, functionName: 'allowance', args: [wallet ?? zeroAddress, antimatter ?? zeroAddress] },
      ] as const;
    }),
    query: { enabled: active && !!wallet, refetchInterval },
  });
  const readAt = (i: number): bigint => {
    const r = stableReads?.[i];
    return r && r.status === 'success' ? (r.result as bigint) : 0n;
  };
  const stableBalances = Object.fromEntries(
    ANNIHILATE_STABLE_ORDER.map((s, i) => [s, Number(formatUnits(readAt(i * 2), STABLES[s].decimals))]),
  ) as Record<AnnihilateStableSymbol, number>;
  const allowanceRaw = readAt(ANNIHILATE_STABLE_ORDER.indexOf(stable) * 2 + 1);

  // The input caps at 4 dp, finer than every stable's decimals, so the amount is
  // always representable and `toStableAmount` cannot revert on it.
  const amountWei = safeParse(amount, ANTIMATTER_DECIMALS);
  const stableRaw = safeParse(amount, cfg.decimals);

  const { data: mintedForStable } = useReadContract({
    address: minter,
    abi: phusdStableMinterAbi,
    functionName: 'calculateMintAmount',
    args: stableAddress ? [stableAddress, stableRaw] : undefined,
    query: { enabled: active && !!stableAddress && stableRaw > 0n, refetchInterval },
  });
  const totalOutWei = mintedForStable !== undefined && amountWei > 0n ? amountWei + (mintedForStable as bigint) : undefined;
  const minOutWei =
    totalOutWei !== undefined ? (totalOutWei * BigInt(10_000 - FORGE_ANNIHILATE_SLIPPAGE_BPS)) / 10_000n : undefined;

  const price = isMainnet ? balancerPrice : 1.0;
  let gateReason: string | null = null;
  if (!active) gateReason = 'Annihilation is not live on this network yet.';
  else if (paused) gateReason = 'Annihilation is paused.';
  else if (isMainnet && balancerPrice === null)
    gateReason = 'The phUSD price is unavailable, so the value of annihilating cannot be established.';
  const priceGated = active && !paused && price !== null && price <= ANNIHILATE_PRICE_FLOOR;
  if (priceGated)
    gateReason = `Annihilation paused at phUSD ≤ $${ANNIHILATE_PRICE_FLOOR.toFixed(2)}`;

  // ---- Writes -------------------------------------------------------------
  const [pendingAction, setPendingAction] = useState<'approve' | 'annihilate' | null>(null);
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>();
  const { isSuccess: approveDone, isError: approveFailed } = useWaitForTransactionReceipt({
    hash: approveHash,
    query: { enabled: !!approveHash },
  });
  const { data: annihilateHash, writeContractAsync } = useWriteContract();
  const { isSuccess: annihilateDone, isError: annihilateFailed } = useWaitForTransactionReceipt({
    hash: annihilateHash,
    query: { enabled: !!annihilateHash },
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

  const approve = async () => {
    if (!wallet || !antimatter || !stableAddress) return;
    try {
      setPendingAction('approve');
      addToast({ type: 'info', title: 'Confirm in Wallet', description: `Please confirm the ${stable} approval in your wallet.`, duration: 30000 });
      const hash = await approveToken(stableAddress, antimatter, maxUint256);
      setApproveHash(hash);
      submittedToast(hash);
    } catch (error) {
      failToast(error, 'Approval Failed');
      setPendingAction(null);
    }
  };

  const annihilate = async () => {
    if (gateReason || !wallet || !antimatter || !stableAddress || minOutWei === undefined || amountWei === 0n) return;
    try {
      setPendingAction('annihilate');
      addToast({ type: 'info', title: 'Confirm Transaction', description: `Please confirm the ${stable} annihilation in your wallet.`, duration: 30000 });
      const hash = await writeContractAsync({
        address: antimatter,
        abi: antimatterAbi,
        functionName: 'annihilate',
        args: [stableAddress, wallet, amountWei, minOutWei],
      });
      submittedToast(hash);
    } catch (error) {
      failToast(error, 'Annihilation Failed');
      setPendingAction(null);
    }
  };

  useEffect(() => {
    if (!approveHash) return;
    if (approveDone) {
      addToast({ type: 'success', title: 'Approval Successful', description: `${stable} approved for annihilation.`, duration: 12000 });
      refetchStables();
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
    if (!annihilateHash || pendingAction !== 'annihilate') return;
    if (annihilateDone) {
      addToast({
        type: 'success',
        title: 'Annihilation Confirmed',
        description: 'Antimatter and stablecoin annihilated; phUSD has been minted to your wallet.',
        duration: 30000,
        action: { label: 'View Transaction', onClick: () => window.open(explorerUrl(annihilateHash), '_blank') },
      });
      setAmount('');
    } else if (annihilateFailed) {
      addToast({ type: 'error', title: 'Annihilation Failed', description: 'The annihilation transaction reverted.', duration: 16000 });
    } else {
      return;
    }
    refetchAm();
    refetchStables();
    refreshWalletBalances();
    setPendingAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annihilateDone, annihilateFailed, annihilateHash]);

  return {
    active,
    paused,
    walletAntimatter,
    stableBalances,
    price,
    gateReason,
    priceGated,
    stable,
    setStable,
    amount,
    setAmount,
    phusdOut: totalOutWei !== undefined ? Number(formatUnits(totalOutWei, 18)) : null,
    minPhusdOut: minOutWei !== undefined ? Number(formatUnits(minOutWei, 18)) : null,
    needsApproval: stableRaw > 0n && allowanceRaw < stableRaw,
    pendingAction,
    approve,
    annihilate,
  };
}
