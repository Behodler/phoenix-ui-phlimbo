import { useReadContract, useAccount } from 'wagmi';
import { keccak256, toBytes } from 'viem';
import { depositPageViewV3Abi, viewRouterAbi } from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { log } from '../utils/logger';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/** ViewRouter page key for the deposit view — mirrors MINT_PAGE_KEY in useMinterPageView. */
const DEPOSIT_PAGE_KEY = keccak256(toBytes('deposit'));

/** DepositPageViewV3 exposes exactly this many fields. A shorter array is a stale view. */
const FIELD_COUNT = 23;

/** The stable reward token (USDC) is 6-decimal, unlike the 18-decimal phUSD side. */
const STABLE_DECIMALS = 6;

/**
 * Promo lifecycle, as encoded in field 16.
 *
 * There is no "dormant" phase — a promo whose balance has drained still reads
 * `Active`. `Flushing` implies the contract is paused (field 10 == 1) and that
 * `pendingPromoRewards` is frozen.
 */
export const PromoPhase = {
  None: 0,
  Active: 1,
  Flushing: 2,
} as const;
export type PromoPhase = (typeof PromoPhase)[keyof typeof PromoPhase];

/**
 * Decoded `DepositPageViewV3.getData(user)`.
 *
 * Indices 0-6 are byte-identical to the retired `DepositView`; 7-22 are new.
 * Every scaling decision lives in this module so no component ever sees a raw
 * index — fields 1, 2 and 13 sit adjacent and disagree by a factor of 1e18.
 */
export interface DepositPageViewData {
  /** The untouched array, for debugging / admin surfaces. */
  raw: readonly bigint[];

  // --- 0-6: unchanged from DepositView ------------------------------------
  /** [0] Wallet phUSD balance, 18dp. */
  userPhUSDBalance: bigint;
  /**
   * [1] phUSD emission rate. RAW wei/sec — **not** PRECISION-scaled. Do not
   * divide this by `precision`; that is the trap this field is famous for.
   */
  phUSDRewardsPerSecondRaw: bigint;
  /** [2] Stable emission rate, PRECISION-scaled. Use `stableRewardsPerSecond` for the human rate. */
  stableRewardsPerSecondScaled: bigint;
  /** [3] Claimable-now phUSD, 18dp. Not the full entitlement — see `entitlementPhUSD`. */
  pendingPhUSDRewards: bigint;
  /** [4] Claimable-now stable, 6dp. Not the full entitlement — see `entitlementStable`. */
  pendingStableRewards: bigint;
  /** [5] Staked phUSD, 18dp. */
  stakedBalance: bigint;
  /** [6] phUSD allowance toward the farm, 18dp. */
  userAllowance: bigint;

  // --- 7-10: pool config ---------------------------------------------------
  /** [7] The farm's PRECISION constant (1e18). Used rather than a hardcoded literal. */
  precision: bigint;
  /** [8] Minimum stake, 18dp. */
  minimumStake: bigint;
  /** [9] Total staked across all users, 18dp. */
  totalStaked: bigint;
  /** [10] Pause flag. Always true while the promo is Flushing. */
  paused: boolean;

  // --- 11-19: promo --------------------------------------------------------
  /** [11] Promo reward token, or the zero address when no promo has ever run. */
  promoToken: `0x${string}`;
  /** [12] Decimals of `promoToken`; 0 when there is no promo token. */
  promoTokenDecimals: number;
  /** [13] Promo emission rate, PRECISION-scaled. Use `promoRewardPerSecond` for the human rate. */
  promoRewardPerSecondScaled: bigint;
  /** [14] Promo tokens left to distribute, in `promoTokenDecimals`. */
  promoRewardBalance: bigint;
  /** [15] Seconds over which the promo balance depletes. */
  promoDepletionDuration: bigint;
  /** [16] Promo lifecycle phase. */
  promoPhase: PromoPhase;
  /** [17] How far a Flushing promo has walked the staker set. */
  flushCursor: bigint;
  /** [18] Number of stakers. */
  stakerCount: bigint;
  /** [19] Claimable-now promo, in `promoTokenDecimals`. Frozen while Flushing. */
  pendingPromoRewards: bigint;

  // --- 20-22: banked, i.e. the part `pendingX` hides ------------------------
  /** [20] Promo banked after a failed transfer, in `promoTokenDecimals`. */
  unclaimablePromo: bigint;
  /** [21] Stable banked after a failed transfer, 6dp. */
  unclaimableStable: bigint;
  /** [22] phUSD banked after a failed mint, 18dp. */
  unclaimablePhUSD: bigint;

  // --- derived -------------------------------------------------------------
  /**
   * True entitlement = claimable-now + banked. V3 banks failed transfers and
   * mints per user, after which `pendingX` reads zero by design; showing
   * `pendingX` alone tells a banked user they have nothing.
   */
  entitlementPhUSD: bigint;
  entitlementStable: bigint;
  entitlementPromo: bigint;
  /** Human stable emission, tokens/sec (field 2 descaled by field 7, then by 1e6). */
  stableRewardsPerSecond: number;
  /** Human promo emission, tokens/sec (field 13 descaled by field 7, then by promo decimals). */
  promoRewardPerSecond: number;
  /** Whether a promo token has ever been configured. */
  hasPromo: boolean;
}

export interface UseDepositPageViewReturn {
  data: DepositPageViewData | null;
  /**
   * The DepositPageViewV3 implementation address resolved from the router.
   *
   * Exposed because `getRetiredPromoBanks` is **not** proxied by ViewRouter —
   * the router only forwards `getNames`/`getData` — so callers that need it
   * must target the implementation directly.
   */
  depositPageViewAddress: `0x${string}` | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

function toAddress(value: bigint): `0x${string}` {
  return `0x${value.toString(16).padStart(40, '0')}` as `0x${string}`;
}

/**
 * Divide a PRECISION-scaled rate down to a human per-second figure.
 * Done in floating point because the true rate is routinely sub-1-wei once
 * descaled, which integer division would flatten to zero.
 */
function descaleRate(scaled: bigint, precision: bigint, decimals: number): number {
  if (scaled === 0n || precision === 0n) return 0;
  return Number(scaled) / Number(precision) / 10 ** decimals;
}

export function decodeDepositPageView(raw: readonly bigint[]): DepositPageViewData | null {
  if (raw.length !== FIELD_COUNT) {
    // A V1-typed decode against a V3 farm does not revert — Solidity's decoder
    // tolerates the extra trailing words — so a length mismatch is the only
    // signal that the router is pointing at a view we don't understand.
    log.error(
      `DepositPageView: expected ${FIELD_COUNT} fields, got ${raw.length}. Refusing to decode.`,
    );
    return null;
  }

  const precision = raw[7];
  const promoTokenDecimals = Number(raw[12]);

  const pendingPhUSDRewards = raw[3];
  const pendingStableRewards = raw[4];
  const pendingPromoRewards = raw[19];
  const unclaimablePromo = raw[20];
  const unclaimableStable = raw[21];
  const unclaimablePhUSD = raw[22];

  const promoToken = toAddress(raw[11]);

  return {
    raw,

    userPhUSDBalance: raw[0],
    phUSDRewardsPerSecondRaw: raw[1],
    stableRewardsPerSecondScaled: raw[2],
    pendingPhUSDRewards,
    pendingStableRewards,
    stakedBalance: raw[5],
    userAllowance: raw[6],

    precision,
    minimumStake: raw[8],
    totalStaked: raw[9],
    paused: raw[10] === 1n,

    promoToken,
    promoTokenDecimals,
    promoRewardPerSecondScaled: raw[13],
    promoRewardBalance: raw[14],
    promoDepletionDuration: raw[15],
    promoPhase: Number(raw[16]) as PromoPhase,
    flushCursor: raw[17],
    stakerCount: raw[18],
    pendingPromoRewards,

    unclaimablePromo,
    unclaimableStable,
    unclaimablePhUSD,

    entitlementPhUSD: pendingPhUSDRewards + unclaimablePhUSD,
    entitlementStable: pendingStableRewards + unclaimableStable,
    entitlementPromo: pendingPromoRewards + unclaimablePromo,
    stableRewardsPerSecond: descaleRate(raw[2], precision, STABLE_DECIMALS),
    promoRewardPerSecond: descaleRate(raw[13], precision, promoTokenDecimals),
    hasPromo: promoToken.toLowerCase() !== ZERO_ADDRESS,
  };
}

/**
 * Reads the deposit page through ViewRouter.
 *
 * Two steps, mirroring `useMinterPageView`: resolve the implementation with
 * `ViewRouter.pages(keccak256("deposit"))`, then call `getData(user)` on it.
 * There is deliberately no address-key fallback — a second resolution path
 * competing with the router is how a stale view goes unnoticed.
 */
export function useDepositPageView(enabled: boolean = true): UseDepositPageViewReturn {
  const { address: userAddress } = useAccount();
  const { addresses } = useContractAddresses();

  const viewRouterAddress = addresses?.ViewRouter as `0x${string}` | undefined;
  const viewRouterAvailable =
    !!viewRouterAddress && viewRouterAddress.toLowerCase() !== ZERO_ADDRESS;

  const {
    data: resolvedAddressRaw,
    isLoading: isResolveLoading,
    isError: isResolveError,
    error: resolveError,
  } = useReadContract({
    address: viewRouterAddress,
    abi: viewRouterAbi,
    functionName: 'pages',
    args: [DEPOSIT_PAGE_KEY],
    query: {
      enabled: enabled && viewRouterAvailable,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  });

  const depositPageViewAddress = resolvedAddressRaw as `0x${string}` | undefined;
  const depositPageViewAvailable =
    !!depositPageViewAddress && depositPageViewAddress.toLowerCase() !== ZERO_ADDRESS;

  const {
    data: rawData,
    isLoading: isGetDataLoading,
    isError: isGetDataError,
    error: getDataError,
    refetch,
  } = useReadContract({
    address: depositPageViewAddress,
    abi: depositPageViewV3Abi,
    functionName: 'getData',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: enabled && !!userAddress && depositPageViewAvailable,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  });

  const data =
    rawData && Array.isArray(rawData) ? decodeDepositPageView(rawData as readonly bigint[]) : null;

  return {
    data,
    depositPageViewAddress: depositPageViewAvailable ? depositPageViewAddress : undefined,
    isLoading: isResolveLoading || isGetDataLoading,
    isError: isResolveError || isGetDataError,
    error: (resolveError ?? getDataError) as Error | null,
    refetch,
  };
}
