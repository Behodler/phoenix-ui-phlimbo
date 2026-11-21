import { useEffect, useState } from 'react';
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { erc20Abi, formatUnits, maxUint256, parseEventLogs, parseUnits, zeroAddress } from 'viem';
import { antimatterAbi, antimatterBoosterAbi } from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { usePolling } from '../contexts/PollingContext';
import { useToast } from '../components/ui/ToastProvider';
import { useWalletBalances } from '../contexts/WalletBalancesContext';
import { useTokenApproval } from './useContractInteractions';
import { ANNIHILATE_STABLE_ORDER, type AnnihilateStableSymbol, type ForgeAnnihilateState } from './useForgeAnnihilate';
import { STABLE_POOLS, type StablePoolConfig } from '../data/stableStakerPools';
import { ANTIMATTER_DECIMALS } from '../data/antimatterData';
import { FORGE_ANNIHILATE_SLIPPAGE_BPS } from '../data/forgeMockData';
import { decodeContractError } from '../lib/decodeContractError';
import { liveAddress } from '../lib/liveAddress';
import { log } from '../utils/logger';

const REFRESH_INTERVAL_MS = 12_000;
const BPS = 10_000n;

const STABLES: Record<AnnihilateStableSymbol, StablePoolConfig> = {
  USDC: STABLE_POOLS.find((p) => p.id === 'usdc')!,
  USDe: STABLE_POOLS.find((p) => p.id === 'usde')!,
  DOLA: STABLE_POOLS.find((p) => p.id === 'dola')!,
};

/**
 * `AntimatterBooster.Reason`, which the ABI only types as `uint8`. Mirrors the
 * enum in `lib/antimatter/src/AntimatterBooster.sol` (re-checked by story 103).
 */
export const BOOST_REASON_LABELS: readonly string[] = [
  'Eligible', // 0 None
  'Not tracked by the booster', // 1 NotTracked
  'Stablecoin not supported by the booster', // 2 UnsupportedStable
  'Not low on protocol-owned liquidity', // 3 AboveThreshold
  'Boost switched off', // 4 BoostDisabled
  'Boost paused', // 5 Paused
  'Annihilation paused', // 6 AntimatterPaused
  'phUSD minter not set', // 7 MinterNotSet
  'Stablecoin disabled on the phUSD minter', // 8 StableDisabled
  'phUSD minter paused', // 9 MinterPaused
  'Amount too precise for this stablecoin', // 10 AmountNotRepresentable
  'Daily phUSD mint cap reached', // 11 DailyCapExceeded
];
export const boostReasonLabel = (reason: number): string =>
  BOOST_REASON_LABELS[reason] ?? `Not eligible (reason ${reason})`;

export const BOOST_NOT_LIVE = 'Boost not live on this network';
export const BOOST_PAUSED = 'Boost paused';

/**
 * Booster ABI plus Antimatter's custom errors, so a revert raised inside
 * `Antimatter.annihilate` and bubbled through the booster still decodes.
 */
const boosterNames = new Set(
  antimatterBoosterAbi.filter((e) => e.type === 'error').map((e) => (e as { name: string }).name),
);
export const BOOSTER_WRITE_ABI = [
  ...antimatterBoosterAbi,
  ...antimatterAbi.filter((e) => e.type === 'error' && !boosterNames.has((e as { name: string }).name)),
] as unknown as typeof antimatterBoosterAbi;

/** previewBoost's return tuple. */
type PreviewTuple = readonly [boolean, number, bigint, bigint, bigint, bigint];

export type BoostPendingAction = 'approveAntimatter' | 'approveStable' | 'boostedAnnihilate' | null;

export interface ForgeAnnihilateBoostState {
  /** AntimatterBooster has a non-zero address on this network. */
  live: boolean;
  paused: boolean;
  /** `boostBps()`, or null until read. */
  boostBps: number | null;
  /** `boostBps / 100`; may be fractional. Null until read. */
  boostPct: number | null;
  /** Stables `previewBoost(stable, 0)` reports eligible, in selector order. */
  eligibleStables: AnnihilateStableSymbol[];
  isEligible: (s: AnnihilateStableSymbol) => boolean;
  /** Why the boost is unavailable for `s` right now, or null when it is available. */
  reasonFor: (s: AnnihilateStableSymbol) => string | null;
  /**
   * Why the boost cannot be applied to the current pair and amount, or null
   * when it can. Covers not-live, paused, and the amount-specific preview.
   */
  unavailableReason: string | null;
  /** The amount-specific preview is still loading. */
  quoteLoading: boolean;
  expectedBaseWei: bigint | undefined;
  expectedBonusWei: bigint | undefined;
  /** `minPhUSDOut` for `boostedAnnihilate`: (base + bonus) less slippage. */
  minOutWei: bigint | undefined;
  expectedBase: number | null;
  expectedBonus: number | null;
  minPhusdOut: number | null;
  needsAmApproval: boolean;
  needsStableApproval: boolean;
  pendingAction: BoostPendingAction;
  approveAntimatter: () => Promise<void>;
  approveStable: () => Promise<void>;
  boostedAnnihilate: () => Promise<void>;
}

const safeParse = (amount: string, decimals: number): bigint => {
  try {
    return amount ? parseUnits(amount, decimals) : 0n;
  } catch {
    return 0n;
  }
};

const toNum = (wei: bigint | undefined) => (wei === undefined ? null : Number(formatUnits(wei, 18)));

/**
 * Live wiring for the admin-only "Annihilate Antimatter (boost preview)" Forge
 * row: `AntimatterBooster.boostedAnnihilate(stable, recipient, amount, minPhUSDOut)`.
 *
 * Takes the pair and amount from the row's own `useForgeAnnihilate` instance
 * (which still drives the boost-off path) and adds the booster's reads,
 * approvals of BOTH Antimatter and the stable to the booster, a pre-sign
 * eligibility re-check, and the boosted write. There is no fallback to plain
 * annihilation: an ineligible stable blocks the boosted send.
 */
export function useForgeAnnihilateBoost(base: ForgeAnnihilateState): ForgeAnnihilateBoostState {
  const { address: wallet } = useAccount();
  const { addresses, networkType } = useContractAddresses();
  const { isPollingEnabled } = usePolling();
  const { addToast } = useToast();
  const { refreshWalletBalances } = useWalletBalances();
  const { approve: approveToken } = useTokenApproval();
  const queryClient = useQueryClient();

  const booster = liveAddress(addresses?.AntimatterBooster);
  const antimatter = liveAddress(addresses?.Antimatter);
  const live = !!booster;
  const refetchInterval = isPollingEnabled ? REFRESH_INTERVAL_MS : false;

  const { stable, amount } = base;
  const cfg = STABLES[stable];
  const tokenFor = (s: AnnihilateStableSymbol) => liveAddress(addresses?.[STABLES[s].addressKey]);
  const stableAddress = tokenFor(stable);

  const amountWei = safeParse(amount, ANTIMATTER_DECIMALS);
  const stableAmount = amountWei / 10n ** BigInt(18 - cfg.decimals);

  // ---- Reads --------------------------------------------------------------
  const { data: bpsRaw } = useReadContract({
    address: booster,
    abi: antimatterBoosterAbi,
    functionName: 'boostBps',
    query: { enabled: live, refetchInterval },
  });
  const { data: pausedRaw, refetch: refetchPaused } = useReadContract({
    address: booster,
    abi: antimatterBoosterAbi,
    functionName: 'paused',
    query: { enabled: live, refetchInterval },
  });
  const paused = pausedRaw === true;

  // Eligibility of every stable (`amount == 0` reports eligibility only).
  const { data: eligibilityReads, refetch: refetchEligibility } = useReadContracts({
    contracts: ANNIHILATE_STABLE_ORDER.map(
      (s) =>
        ({
          address: booster,
          abi: antimatterBoosterAbi,
          functionName: 'previewBoost',
          args: [tokenFor(s) ?? zeroAddress, 0n],
        }) as const,
    ),
    query: { enabled: live, refetchInterval },
  });

  // Live quote for the selected pair and amount.
  const quoteEnabled = live && !!stableAddress && amountWei > 0n;
  const { data: quoteRaw, refetch: refetchQuote } = useReadContract({
    address: booster,
    abi: antimatterBoosterAbi,
    functionName: 'previewBoost',
    args: stableAddress ? [stableAddress, amountWei] : undefined,
    query: { enabled: quoteEnabled, refetchInterval },
  });
  const quote = quoteEnabled ? (quoteRaw as PreviewTuple | undefined) : undefined;

  // Allowances to the booster: Antimatter (18 dec) and the selected stable (native dec).
  const { data: allowanceReads, refetch: refetchAllowances } = useReadContracts({
    contracts: [
      { address: antimatter, abi: erc20Abi, functionName: 'allowance', args: [wallet ?? zeroAddress, booster ?? zeroAddress] },
      { address: stableAddress, abi: erc20Abi, functionName: 'allowance', args: [wallet ?? zeroAddress, booster ?? zeroAddress] },
    ] as const,
    query: { enabled: live && !!wallet && !!antimatter && !!stableAddress, refetchInterval },
  });
  const allowanceAt = (i: number): bigint | undefined => {
    const r = allowanceReads?.[i];
    return r && r.status === 'success' ? (r.result as bigint) : undefined;
  };
  const amAllowance = allowanceAt(0);
  const stableAllowance = allowanceAt(1);

  // ---- Derived ------------------------------------------------------------
  const boostBps = bpsRaw !== undefined ? Number(bpsRaw) : null;
  const boostPct = boostBps !== null ? boostBps / 100 : null;

  const eligibilityFor = (s: AnnihilateStableSymbol): PreviewTuple | undefined => {
    const r = eligibilityReads?.[ANNIHILATE_STABLE_ORDER.indexOf(s)];
    return r && r.status === 'success' ? (r.result as unknown as PreviewTuple) : undefined;
  };
  const isEligible = (s: AnnihilateStableSymbol) =>
    live && !paused && !!tokenFor(s) && eligibilityFor(s)?.[0] === true;
  const reasonFor = (s: AnnihilateStableSymbol): string | null => {
    if (!live) return BOOST_NOT_LIVE;
    if (paused) return BOOST_PAUSED;
    const e = eligibilityFor(s);
    if (!tokenFor(s)) return boostReasonLabel(1);
    if (!e) return 'Checking boost eligibility…';
    return e[0] ? null : boostReasonLabel(Number(e[1]));
  };
  const eligibleStables = ANNIHILATE_STABLE_ORDER.filter(isEligible);

  let unavailableReason = reasonFor(stable);
  if (unavailableReason === null && quote && !quote[0]) unavailableReason = boostReasonLabel(Number(quote[1]));

  const quoteEligible = !!quote && quote[0];
  const expectedBaseWei = quoteEligible ? quote[4] : undefined;
  const expectedBonusWei = quoteEligible ? quote[5] : undefined;
  const minOutWei =
    expectedBaseWei !== undefined && expectedBonusWei !== undefined
      ? ((expectedBaseWei + expectedBonusWei) * (BPS - BigInt(FORGE_ANNIHILATE_SLIPPAGE_BPS))) / BPS
      : undefined;

  const needsAmApproval = amountWei > 0n && (amAllowance ?? 0n) < amountWei;
  const needsStableApproval = stableAmount > 0n && (stableAllowance ?? 0n) < stableAmount;

  // ---- Writes -------------------------------------------------------------
  const [pendingAction, setPendingAction] = useState<BoostPendingAction>(null);
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>();
  const [approveLabel, setApproveLabel] = useState('');
  const { isSuccess: approveDone, isError: approveFailed } = useWaitForTransactionReceipt({
    hash: approveHash,
    query: { enabled: !!approveHash },
  });
  const { data: boostHash, writeContractAsync } = useWriteContract();
  const {
    data: boostReceipt,
    isSuccess: boostDone,
    isError: boostFailed,
  } = useWaitForTransactionReceipt({ hash: boostHash, query: { enabled: !!boostHash } });

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

  const approveFor = async (token: `0x${string}` | undefined, label: string, action: BoostPendingAction) => {
    if (!wallet || !booster || !token) return;
    try {
      setPendingAction(action);
      setApproveLabel(label);
      addToast({ type: 'info', title: 'Confirm in Wallet', description: `Please confirm the ${label} approval in your wallet.`, duration: 30000 });
      const hash = await approveToken(token, booster, maxUint256);
      setApproveHash(hash);
      submittedToast(hash);
    } catch (error) {
      failToast(error, 'Approval Failed');
      setPendingAction(null);
    }
  };
  const approveAntimatter = () => approveFor(antimatter, 'Antimatter', 'approveAntimatter');
  const approveStable = () => approveFor(stableAddress, stable, 'approveStable');

  const boostedAnnihilate = async () => {
    if (base.gateReason || !wallet || !booster || !stableAddress || amountWei === 0n) return;
    try {
      setPendingAction('boostedAnnihilate');
      // Pre-sign re-check: eligibility can lapse between the last poll and the signature.
      const fresh = (await refetchQuote()).data as PreviewTuple | undefined;
      if (!fresh || !fresh[0]) {
        const reason = fresh ? boostReasonLabel(Number(fresh[1])) : 'The boost quote could not be refreshed';
        addToast({
          type: 'error',
          title: 'Boost No Longer Available',
          description: `${reason}. Nothing was sent. Switch the boost off to annihilate without it.`,
          duration: 16000,
        });
        refetchEligibility();
        refetchPaused();
        setPendingAction(null);
        return;
      }
      const freshMin = ((fresh[4] + fresh[5]) * (BPS - BigInt(FORGE_ANNIHILATE_SLIPPAGE_BPS))) / BPS;
      addToast({ type: 'info', title: 'Confirm Transaction', description: `Please confirm the boosted ${stable} annihilation in your wallet.`, duration: 30000 });
      const hash = await writeContractAsync({
        address: booster,
        abi: BOOSTER_WRITE_ABI,
        functionName: 'boostedAnnihilate',
        args: [stableAddress, wallet, amountWei, freshMin],
      });
      submittedToast(hash);
    } catch (error) {
      failToast(error, 'Boosted Annihilation Failed');
      setPendingAction(null);
    }
  };

  const refreshAll = () => {
    refetchAllowances();
    refetchEligibility();
    refetchQuote();
    refreshWalletBalances();
    // The row's own useForgeAnnihilate reads (Antimatter + stable balances) live in
    // the wagmi query cache; invalidating contract reads refetches them now.
    void queryClient.invalidateQueries({
      predicate: (q) => q.queryKey[0] === 'readContract' || q.queryKey[0] === 'readContracts',
    });
  };

  useEffect(() => {
    if (!approveHash) return;
    if (approveDone) {
      addToast({ type: 'success', title: 'Approval Successful', description: `${approveLabel} approved for boosted annihilation.`, duration: 12000 });
      refetchAllowances();
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
    if (!boostHash || pendingAction !== 'boostedAnnihilate') return;
    if (boostDone) {
      let description = 'Antimatter and stablecoin annihilated; boosted phUSD has been minted to your wallet.';
      try {
        const [event] = parseEventLogs({
          abi: antimatterBoosterAbi,
          eventName: 'BoostedAnnihilation',
          logs: boostReceipt?.logs ?? [],
        });
        if (event) {
          const fmt = (wei: bigint) =>
            Number(formatUnits(wei, 18)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          description = `Received ${fmt(event.args.basePhUSD)} phUSD + ${fmt(event.args.bonusPhUSD)} phUSD boost.`;
        }
      } catch (error) {
        log.warn('BoostedAnnihilation log could not be parsed:', error);
      }
      addToast({
        type: 'success',
        title: 'Boosted Annihilation Confirmed',
        description,
        duration: 30000,
        action: { label: 'View Transaction', onClick: () => window.open(explorerUrl(boostHash), '_blank') },
      });
      base.setAmount('');
    } else if (boostFailed) {
      addToast({ type: 'error', title: 'Boosted Annihilation Failed', description: 'The boosted annihilation transaction reverted.', duration: 16000 });
    } else {
      return;
    }
    refreshAll();
    setPendingAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boostDone, boostFailed, boostHash]);

  return {
    live,
    paused,
    boostBps,
    boostPct,
    eligibleStables,
    isEligible,
    reasonFor,
    unavailableReason,
    quoteLoading: quoteEnabled && quote === undefined,
    expectedBaseWei,
    expectedBonusWei,
    minOutWei,
    expectedBase: toNum(expectedBaseWei),
    expectedBonus: toNum(expectedBonusWei),
    minPhusdOut: toNum(minOutWei),
    needsAmApproval,
    needsStableApproval,
    pendingAction,
    approveAntimatter,
    approveStable,
    boostedAnnihilate,
  };
}
