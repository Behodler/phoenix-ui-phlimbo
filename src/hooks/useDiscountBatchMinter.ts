import { useMemo, useState } from 'react';
import type { Address, Hash } from 'viem';
import { parseEventLogs, zeroAddress } from 'viem';
import { useAccount, usePublicClient, useReadContracts, useWriteContract } from 'wagmi';
import { batchNftMinterNudgeDiscountAbi } from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { usePolling } from '../contexts/PollingContext';
import { useToast } from '../components/ui/ToastProvider';
import { useMinterPageView, type TokenMintData } from './useMinterPageView';
import { useTokenAllowance, useTokenApproval, useTokenBalance } from './useContractInteractions';
import {
  readBonusAmounts,
  useDiscountBonusTokens,
  type DiscountBonusTokensResult,
} from './useDiscountBonusTokens';
import { tokenPrefixToAddressKey } from '../data/nftMockData';
import { decodeContractError } from '../lib/decodeContractError';
import type { ContractAddresses } from '../types/contracts';
import { log } from '../utils/logger';

/** Re-read cadence while real-time updates are on. Matches the other NFT-tab heartbeats. */
const DISCOUNT_BATCH_REFRESH_INTERVAL_MS = 12_000;

/**
 * Headroom on top of `previewBatch().paidCost` when sizing `maxPayment` (and so
 * the approval). Same 2% as `useNudgePot`'s `MINT_BUDGET_HEADROOM_BPS`: the
 * price can ramp between our read and the transaction, and `batchMint` pulls
 * the whole `maxPayment` then refunds what it did not spend.
 */
export const MINT_BUDGET_HEADROOM_BPS = 200n; // 2%

export function maxPaymentFor(paidCostRaw: bigint): bigint {
  return (paidCostRaw * (10_000n + MINT_BUDGET_HEADROOM_BPS)) / 10_000n;
}

/** What the panel should render. */
export type DiscountBatchStatus =
  /** `NudgeDiscountBatchMinter` is the zero address on this network. */
  | 'unavailable'
  | 'loading'
  /** `previewBatch()` returned `free == 0` (or the minter is misconfigured). */
  | 'no-discount'
  | 'ready';

/** Why the CTA cannot send right now. `null` when it can. */
export type DiscountBatchBlocker =
  | 'paused'
  | 'no-discount'
  | 'disconnected'
  | 'insufficient-balance'
  | 'busy'
  | null;

/** Mint progress, for the CTA label. */
export type DiscountBatchPhase = 'idle' | 'checking' | 'approving' | 'minting';

/** One coherent `previewBatch` + `previewBoost` read. */
export interface DiscountBatchQuote {
  /** Pass to `batchMint` verbatim as `expectedTotal`. */
  totalRaw: bigint;
  freeRaw: bigint;
  paidRaw: bigint;
  /** Authoritative caller cost (payment-token units). */
  paidCostRaw: bigint;
  /** Pass to `batchMint` verbatim as `quotedBoost`. */
  boost: number;
  /** `previewBoost().effectivePercent`, or `discountPercent` when the boost is 0. */
  effectivePercent: number;
  /** Display-only conversions. */
  total: number;
  free: number;
  paid: number;
}

export interface DiscountBatchConfig {
  discountPercent: number;
  maxFreePerBatch: number;
  overflowNFTsPerBoostPoint: number;
  maxBoost: number;
  dispatcherIndex: number;
  paused: boolean;
  bonusTokens: readonly Address[];
}

/** The discount fund, from `previewBatch()` / `previewBoost()`. Admin display only. */
export interface DiscountFund {
  /** `previewBatch().potUSD`: the pot in USD (18 dp), net of the PSM `tin`. */
  potUsdRaw: bigint;
  /** `previewBatch().nextStepUSDC`: extra USDC (6 dp) for `free` to grow by one. */
  nextStepUsdcRaw: bigint;
  /** `previewBoost().reservedUSDC`: USDC (6 dp) already reserved for `buyAndBurn`. */
  reservedUsdcRaw: bigint;
}

export interface DiscountBatchPayment {
  address: Address | undefined;
  /** `useMinterPageView` row key, e.g. `USDS`. */
  symbol: string;
  decimals: number;
  /** Current per-NFT price on the minter's pinned dispatcher. */
  priceRaw: bigint;
  growthBps: number;
}

export interface DiscountBatchMinterState {
  status: DiscountBatchStatus;
  minter: Address | undefined;
  quote: DiscountBatchQuote | undefined;
  config: DiscountBatchConfig | undefined;
  fund: DiscountFund | undefined;
  /** Bonus tokens the batch pays out on top of the NFTs (polled, display only). */
  bonus: DiscountBonusTokensResult;
  payment: DiscountBatchPayment | undefined;
  /** `paidCost` + 2%: what gets approved and passed as `maxPayment`. */
  maxPaymentRaw: bigint;
  balanceRaw: bigint | undefined;
  blocker: DiscountBatchBlocker;
  phase: DiscountBatchPhase;
  /** Re-reads, approves if needed, and sends `batchMint`. */
  mint: () => Promise<void>;
}

type ReadTuple = readonly [
  readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint],
  readonly [bigint, number, number, bigint],
  number,
  bigint,
  bigint,
  number,
  bigint,
  boolean,
  readonly Address[],
];

const liveAddress = (value: unknown): Address | undefined => {
  const addr = value as Address | undefined;
  return addr && addr.toLowerCase() !== zeroAddress ? addr : undefined;
};

function toQuote(reads: ReadTuple): DiscountBatchQuote {
  const [[freeRaw, totalRaw, paidRaw, paidCostRaw], [, boost, effective], discountPercent] = reads;
  return {
    totalRaw,
    freeRaw,
    paidRaw,
    paidCostRaw,
    boost,
    effectivePercent: boost > 0 ? effective : discountPercent,
    total: Number(totalRaw),
    free: Number(freeRaw),
    paid: Number(paidRaw),
  };
}

/**
 * Live wiring for nft-staking `BatchNFTMinterNudgeDiscount` (the Whale-mock
 * sub-tab).
 *
 * Reads the batch (`previewBatch`), its cap/boost terms (`previewBoost`) and
 * the config getters in one multicall, polled on the 12 s heartbeat and gated
 * on a non-zero address. The payment token and its price ramp come from
 * `dispatcherIndex()` matched against `useMinterPageView` rows, exactly as
 * `useNudgePot` does — never assumed.
 *
 * `mint()` re-reads before signing. If `total` or `boost` moved from what the
 * user was looking at, it stops (the display has already updated) and the user
 * must click again: no silent re-quote. The same applies to the bonus tokens:
 * it re-reads each payout (`readBonusAmounts`) and stops if any is below what
 * the panel showed. Otherwise it approves `maxPayment` if needed and calls the
 * 6-arg `batchMint` with the live bonus-token order and those fresh payouts as
 * `bonusMinRewards`, so a batch that lands after someone else's pays the full
 * advertised bonus or reverts.
 *
 * The fund figures (`potUSD`, `nextStepUSDC`, `reservedUSDC`) are returned as
 * `fund` for the admin-only panel.
 */
export function useDiscountBatchMinter(): DiscountBatchMinterState {
  const { address: wallet } = useAccount();
  const { addresses, networkType } = useContractAddresses();
  const { isPollingEnabled } = usePolling();
  const { addToast } = useToast();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { approve } = useTokenApproval();
  const { data: minterData, refetch: refetchMinterView } = useMinterPageView();

  const minter = liveAddress(addresses?.NudgeDiscountBatchMinter);
  const active = !!minter;
  const refetchInterval = isPollingEnabled ? DISCOUNT_BATCH_REFRESH_INTERVAL_MS : false;

  const contract = { address: minter, abi: batchNftMinterNudgeDiscountAbi } as const;
  const { data: readsRaw, refetch: refetchReads } = useReadContracts({
    contracts: [
      { ...contract, functionName: 'previewBatch' },
      { ...contract, functionName: 'previewBoost' },
      { ...contract, functionName: 'discountPercent' },
      { ...contract, functionName: 'maxFreePerBatch' },
      { ...contract, functionName: 'overflowNFTsPerBoostPoint' },
      { ...contract, functionName: 'maxBoost' },
      { ...contract, functionName: 'dispatcherIndex' },
      { ...contract, functionName: 'paused' },
      { ...contract, functionName: 'getBonusTokens' },
    ],
    allowFailure: false,
    query: { enabled: active, refetchInterval },
  });
  const reads = readsRaw as ReadTuple | undefined;

  const config = useMemo<DiscountBatchConfig | undefined>(() => {
    if (!reads) return undefined;
    return {
      discountPercent: reads[2],
      maxFreePerBatch: Number(reads[3]),
      overflowNFTsPerBoostPoint: Number(reads[4]),
      maxBoost: reads[5],
      dispatcherIndex: Number(reads[6]),
      paused: reads[7],
      bonusTokens: reads[8],
    };
  }, [reads]);

  const quote = useMemo(() => (reads ? toQuote(reads) : undefined), [reads]);

  const fund = useMemo<DiscountFund | undefined>(
    () =>
      reads
        ? { potUsdRaw: reads[0][5], nextStepUsdcRaw: reads[0][6], reservedUsdcRaw: reads[1][3] }
        : undefined,
    [reads],
  );

  // Match the pinned dispatcher against MinterPageView's rows to recover the
  // payment token AND its live price ramp. Index 0 is the contract's own
  // "unconfigured" sentinel, so it can never match.
  const payment = useMemo<DiscountBatchPayment | undefined>(() => {
    if (!minterData || !config?.dispatcherIndex) return undefined;
    const rows = Object.entries(minterData) as [string, TokenMintData][];
    const match = rows.find(([, row]) => row?.dispatcherIndex === config.dispatcherIndex);
    if (!match) return undefined;
    const [prefix, row] = match;
    const addressKey = tokenPrefixToAddressKey[prefix] as keyof ContractAddresses | undefined;
    return {
      address: addressKey ? liveAddress(addresses?.[addressKey]) : undefined,
      symbol: prefix,
      decimals: row.decimals,
      priceRaw: row.priceRaw,
      growthBps: row.growthBasisPoints,
    };
  }, [minterData, config?.dispatcherIndex, addresses]);

  const bonus = useDiscountBonusTokens(minter, config?.bonusTokens);

  const maxPaymentRaw = quote ? maxPaymentFor(quote.paidCostRaw) : 0n;

  const { balance: balanceRaw, refetch: refetchBalance } = useTokenBalance(wallet, payment?.address);
  const { refetch: refetchAllowance } = useTokenAllowance(wallet, minter, payment?.address);

  let status: DiscountBatchStatus;
  if (!active) status = 'unavailable';
  else if (!reads || !quote || !payment || payment.priceRaw <= 0n) status = 'loading';
  else if (quote.total === 0) status = 'no-discount';
  else status = 'ready';

  const [phase, setPhase] = useState<DiscountBatchPhase>('idle');

  let blocker: DiscountBatchBlocker = null;
  if (config?.paused) blocker = 'paused';
  else if (status !== 'ready') blocker = 'no-discount';
  else if (!wallet) blocker = 'disconnected';
  else if (phase !== 'idle') blocker = 'busy';
  else if (balanceRaw !== undefined && balanceRaw < maxPaymentRaw) blocker = 'insufficient-balance';

  const explorerUrl = (hash: string) =>
    networkType === 'mainnet' ? `https://etherscan.io/tx/${hash}` : `https://sepolia.etherscan.io/tx/${hash}`;

  const refreshAll = () => {
    refetchReads();
    refetchAllowance();
    refetchBalance();
    refetchMinterView();
  };

  const failToast = (title: string, error: unknown) => {
    const decoded = decodeContractError(error);
    addToast(
      decoded.userRejected
        ? { type: 'error', title: 'Transaction Cancelled', description: 'You cancelled the transaction.', duration: 8000 }
        : { type: 'error', title, description: decoded.message, duration: 16000 },
    );
  };

  const waitFor = async (hash: Hash) => {
    if (!publicClient) throw new Error('No RPC client is available to wait for the transaction.');
    return publicClient.waitForTransactionReceipt({ hash });
  };

  const mint = async () => {
    if (blocker !== null || !minter || !wallet || !payment?.address || !quote) return;
    const shown = quote;
    const shownBonus = bonus.all;
    const token = payment.address;
    try {
      // 1. Pre-sign re-read. A changed quote stops here: the refetch has
      //    already updated the display, and the user must look and click again.
      setPhase('checking');
      const { data: freshRaw } = await refetchReads();
      const fresh = freshRaw as ReadTuple | undefined;
      if (!fresh) throw new Error('Could not re-read the discount batch. Try again.');
      const now = toQuote(fresh);
      if (fresh[7]) {
        addToast({ type: 'warning', title: 'Minting Paused', description: 'Discount batch minting is paused right now.' });
        return;
      }
      if (now.totalRaw === 0n) {
        addToast({ type: 'warning', title: 'Batch Unavailable', description: 'No discount batch is available right now.' });
        return;
      }
      if (now.totalRaw !== shown.totalRaw || now.boost !== shown.boost) {
        addToast({
          type: 'warning',
          title: 'Batch Updated',
          description: 'The discount batch changed. Check the new figures and click Mint again.',
          duration: 12000,
        });
        return;
      }
      const maxPayment = maxPaymentFor(now.paidCostRaw);
      const bonusTokens = fresh[8];

      // Bonus floors: the fresh payouts, signed verbatim. A payout below what
      // the panel showed means another batch took it: stop, like a changed quote.
      if (!publicClient) throw new Error('No RPC client is available to read the bonus tokens.');
      const bonusMinRewards = await readBonusAmounts(publicClient, minter, bonusTokens);
      const bonusShrank = bonusTokens.some((address, j) => {
        const seen = shownBonus.find((leg) => leg.address.toLowerCase() === address.toLowerCase());
        return seen !== undefined && bonusMinRewards[j] < seen.totalRaw;
      });
      if (bonusShrank) {
        addToast({
          type: 'warning',
          title: 'Bonus Updated',
          description: 'The bonus tokens changed. Check the new amounts and click Mint again.',
          duration: 12000,
        });
        return;
      }

      // 2. Approve the whole budget: `batchMint` pulls all of `maxPayment`.
      const { data: allowance } = await refetchAllowance();
      if ((allowance ?? 0n) < maxPayment) {
        setPhase('approving');
        addToast({
          type: 'info',
          title: 'Confirm in Wallet',
          description: `Please confirm the ${payment.symbol} approval in your wallet.`,
          duration: 30000,
        });
        const approvalHash = await approve(token, minter, maxPayment);
        addToast({ type: 'info', title: 'Transaction Submitted', description: 'Waiting for approval confirmation...' });
        const approval = await waitFor(approvalHash);
        if (approval.status !== 'success') throw new Error('The approval transaction reverted.');
        addToast({
          type: 'success',
          title: 'Approval Confirmed',
          description: `${payment.symbol} approval confirmed on-chain. Now confirm the mint.`,
        });
      }

      // 3. Mint.
      setPhase('minting');
      addToast({
        type: 'info',
        title: 'Confirm in Wallet',
        description: 'Please confirm the mint transaction in your wallet.',
        duration: 30000,
      });
      const hash = await writeContractAsync({
        address: minter,
        abi: batchNftMinterNudgeDiscountAbi,
        functionName: 'batchMint',
        args: [now.totalRaw, now.boost, wallet, maxPayment, bonusTokens, bonusMinRewards],
      });
      addToast({
        type: 'info',
        title: 'Transaction Submitted',
        description: 'Waiting for blockchain confirmation...',
        duration: 30000,
        action: { label: 'View on Etherscan', onClick: () => window.open(explorerUrl(hash), '_blank') },
      });
      const receipt = await waitFor(hash);
      if (receipt.status !== 'success') throw new Error('The mint transaction reverted. Nothing was minted.');
      const [event] = parseEventLogs({
        abi: batchNftMinterNudgeDiscountAbi,
        logs: receipt.logs,
        eventName: 'BatchMinted',
      });
      const free = event ? Number(event.args.free) : now.free;
      const paid = event ? Number(event.args.paid) : now.paid;
      addToast({
        type: 'success',
        title: 'Discount Batch Minted',
        description: `${free + paid} NFTs minted: ${free} covered by the discount fund, ${paid} paid.`,
        duration: 30000,
        action: { label: 'View Transaction', onClick: () => window.open(explorerUrl(hash), '_blank') },
      });
    } catch (error) {
      log.error('Discount batch mint failed:', error);
      failToast('Mint Failed', error);
    } finally {
      setPhase('idle');
      refreshAll();
    }
  };

  return {
    status,
    minter,
    quote,
    config,
    fund,
    bonus,
    payment,
    maxPaymentRaw,
    balanceRaw,
    blocker,
    phase,
    mint,
  };
}
