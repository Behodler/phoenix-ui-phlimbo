import { useEffect, useState } from 'react';
import {
  useAccount,
  useChainId,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { parseUnits, maxUint256, erc20Abi, zeroAddress } from 'viem';
import {
  stableStakerV2Abi,
  antimatterAbi,
  erc4626MarketYieldStrategyAbi,
} from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { useToast } from '../components/ui/ToastProvider';
import { useWalletBalances } from '../contexts/WalletBalancesContext';
import { usePolling } from '../contexts/PollingContext';
import { useTokenApproval } from './useContractInteractions';
import { useBalancerPrice } from './useBalancerPrice';
import { STABLE_POOLS, type StablePoolConfig, type StablePoolId } from '../data/stableStakerPools';
import { ANTIMATTER_DECIMALS, ANTIMATTER_DISPLAY_NAME } from '../data/antimatterData';
import { computeAntimatterApy, SECONDS_PER_YEAR } from '../utils/stakingMath';
import { log } from '../utils/logger';

/**
 * Heartbeat for re-reading on-chain stable-pool data while real-time updates
 * are on. Mirrors the phUSD pool's cadence.
 */
const STAKE_REFRESH_INTERVAL_MS = 12_000;

/**
 * phUSD spot price at or below which annihilation destroys more principal
 * value than the phUSD it returns.
 *
 * Annihilation burns one unit of staked stablecoin per unit of Antimatter and
 * pays phUSD worth both sides together, so the net value to the user is
 * `2p - 1` per unit. At `p == 0.5` that is exactly zero and below it negative,
 * hence `<=` rather than `<`.
 */
export const ANNIHILATE_PRICE_FLOOR = 0.5;

export type StableStakeAction = 'stake' | 'withdraw' | 'claim' | 'approve' | 'annihilate';

/**
 * A single StableStakerV2 pool. Stable pools stake USDC/USDe/DOLA and accrue
 * **Antimatter** (18 decimals), which is annihilated against the user's own
 * staked principal rather than claimed as ordinary yield.
 */
export interface AntimatterStakeRow {
  id: StablePoolId;
  /** Display symbol of the stake token. */
  symbol: string;
  stakeIcon: string;
  /** Native decimals of the stake token (USDC 6, USDe/DOLA 18). */
  decimals: number;

  walletBalance: number;
  stakedBalance: number;
  /**
   * Total Antimatter this user has accrued in the pool, read from
   * `claimableReward` — the settled `unclaimedReward` backlog plus the live
   * `pendingReward` projection.
   *
   * `pendingReward` alone is the wrong figure and reads as zero at exactly the
   * wrong moment: `stake()` and `withdraw()` settle the outstanding projection
   * into `unclaimedReward` and reset `rewardDebt`, so a user who has just
   * staked has a full backlog and a `pendingReward` of nothing.
   * `autoAnnihilate` consumes `unclaimedReward + pending`, so `claimableReward`
   * is also the figure the annihilation preview has to be built on.
   */
  pendingAntimatter: number;
  /** Antimatter accruing to this user per second, for the live counter. */
  ratePerSecond: number;
  /**
   * Stake-token amount the accrued Antimatter would match against, in human
   * units. Derived from the contract's own `toStableAmount` view (which owns
   * the 18-dec → native-dec conversion) and capped by the staked balance —
   * never hand-rolled decimal scaling.
   */
  matchedStable: number;
  /**
   * Antimatter that exceeds the staked principal and so cannot be matched.
   * Minted straight to the caller by the contract (its `excess`).
   */
  surplusAntimatter: number;

  /**
   * Increments once each time an annihilation on THIS pool is confirmed on
   * chain. It carries no value of its own: the row keys its burst animation on
   * it, so a change restarts the CSS keyframes and a steady number leaves them
   * alone. Starts at `0`, which is the "nothing has happened yet" state and
   * plays nothing.
   */
  annihilationCount: number;

  /**
   * Net-yield APY (percent), or `null` when genuinely unknown — which this repo
   * renders as an em dash, never `0`.
   *
   * This is **not** an ordinary yield: Antimatter is annihilated against the
   * user's own staked principal, so the figure is
   * `min(A_annual, principal) / principal x (2p - 1) x 100` and turns
   * **negative** below phUSD $0.50, where annihilation destroys more value than
   * it returns. See `computeAntimatterApy` for the derivation. Negative is
   * displayed honestly; `annihilateDisabledReason` closes the action off in
   * exactly that regime.
   */
  apy: number | null;

  /** Global pause — gates ALL actions for this pool. */
  disabled: boolean;
  /** Per-pool underwater flag — gates ONLY this pool's withdraw. */
  withdrawDisabled: boolean;
  /**
   * Set-aside buffer (human units): stake tokens held directly on the
   * StableStakerV2. While underwater the contract still pays withdrawals that
   * fit entirely within this buffer, so only larger amounts are paused.
   */
  withdrawBuffer: number;
  /**
   * True when `StableStakerV2` has not been deployed on this network (the
   * address resolves to the zero address). No reads are issued and the row
   * renders inactive rather than producing a wall of failed calls.
   */
  inactive: boolean;

  /**
   * `claimEnabled()` on the staker. Closed by default, so accrued Antimatter
   * banks rather than pays until an owner opens the gate. A UI that offers a
   * claim button without reading this lies to the user.
   */
  claimEnabled: boolean;
  /** `autoAnnihilateAvailable(token)` — the contract's own readiness flag. */
  annihilateAvailable: boolean;
  /**
   * Human-readable reason the annihilate action is unavailable, or `null` when
   * it is available. Covers the phUSD price gates as well as the contract's
   * own flags. `stake` and `withdraw` are never gated by this.
   */
  annihilateDisabledReason: string | null;

  needsApproval: (amount: string) => boolean;
  tagline: string;
  /**
   * Max slippage (bps) of the pool's ERC4626Market yield strategy, when it has
   * one (USDe). Deposits pay exactly this haircut; withdrawals pay between
   * zero and this depending on the strategy's buffer. Undefined for pools
   * without an AMM-routed strategy (and while the value is loading).
   */
  conversionBps?: number;
}

export interface UseStableStakerPools {
  pools: AntimatterStakeRow[];
  pendingAction: { id: StablePoolId; action: StableStakeAction } | null;
  stake: (id: StablePoolId, amount: string) => Promise<void>;
  withdraw: (id: StablePoolId, amount: string) => Promise<void>;
  claim: (id: StablePoolId) => Promise<void>;
  annihilate: (id: StablePoolId) => Promise<void>;
  approve: (id: StablePoolId) => Promise<void>;
  /**
   * What the accrual token is called on screen. The literal word
   * **"Antimatter"**, not the `AM` ticker the ERC20's `symbol()` returns: the
   * whole surface is built around the annihilation metaphor and a two-letter
   * abbreviation throws it away.
   */
  antimatterSymbol: string;
  /**
   * `claimEnabled()` on the staker, which is one global flag rather than a
   * per-pool one. Exposed at the top level as well as on each row because the
   * tab's header strip is global and has to gate on it.
   */
  claimEnabled: boolean;
  /** Antimatter held loose in the connected wallet (human units). */
  walletAntimatter: number;
  /** phUSD held in the connected wallet (human units). */
  walletPhUSD: number;
  /**
   * Raw `useBalancerPrice()` result on mainnet, `null` elsewhere. Deliberately
   * NOT the `?? 1.0` display clamp — see `ANNIHILATE_PRICE_FLOOR`.
   */
  phUsdRawPrice: number | null;
  /** Clamped price, safe for display math only. */
  phUsdDisplayPrice: number;
  isLoading: boolean;
}

/**
 * Per-token on-chain reads. Called exactly once per static pool config (a fixed
 * 3-entry list) so the rules of hooks are satisfied.
 */
interface PoolReads {
  walletBalance: number;
  stakedBalance: number;
  stakedRaw: bigint;
  /**
   * Pool-wide Antimatter emission rate (18 dec, per second), or `undefined`
   * while `poolInfo` is unresolved. The distinction matters: `0n` is a real
   * zero emission, `undefined` is an unknown APY.
   */
  antimatterPerSecond: bigint | undefined;
  /** Pool principal in the stake token's native decimals. */
  totalStakedRaw: bigint;
  /**
   * The annual emission expressed in the stake token's decimals by
   * `Antimatter.toStableAmount` — the APY numerator.
   */
  annualAntimatterAsStableRaw: bigint | undefined;
  /** `claimableReward` in human units — the backlog plus the live projection. */
  pendingAntimatter: number;
  /** The same figure, raw 18-dec. */
  pendingRaw: bigint;
  ratePerSecond: number;
  matchedStable: number;
  surplusAntimatter: number;
  withdrawDisabled: boolean;
  annihilateAvailable: boolean;
  bufferRaw: bigint;
  withdrawBuffer: number;
  allowanceRaw: bigint;
  conversionBps: number | undefined;
  isLoading: boolean;
  refresh: () => void;
}

function useStablePoolReads(
  config: StablePoolConfig,
  stableStaker: `0x${string}` | undefined,
  antimatterAddress: `0x${string}` | undefined,
  tokenAddress: `0x${string}` | undefined,
  strategyAddress: `0x${string}` | undefined,
  walletAddress: `0x${string}` | undefined,
  isActive: boolean,
  isPollingEnabled: boolean,
): PoolReads {
  const enabled = !!stableStaker && !!tokenAddress;
  const enabledUser = enabled && !!walletAddress;

  const { data: poolInfo, isLoading: poolInfoLoading, refetch: refetchPoolInfo } = useReadContract({
    address: stableStaker,
    abi: stableStakerV2Abi,
    functionName: 'poolInfo',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: { enabled },
  });

  const { data: userInfo, isLoading: userInfoLoading, refetch: refetchUserInfo } = useReadContract({
    address: stableStaker,
    abi: stableStakerV2Abi,
    functionName: 'userInfo',
    args: tokenAddress && walletAddress ? [tokenAddress, walletAddress] : undefined,
    query: { enabled: enabledUser },
  });

  // `claimableReward`, NOT `pendingReward`. The staker settles a position's
  // outstanding projection into `unclaimedReward` on every `stake` / `withdraw`
  // and resets `rewardDebt`, so `pendingReward` restarts from zero each time
  // the user touches the pool while the real accrual sits in the backlog.
  // `claimableReward` is `unclaimedReward + pendingReward`, which is exactly
  // the `owed` figure `autoAnnihilate` and `claim` both consume.
  const { data: pending, isLoading: pendingLoading, refetch: refetchPending } = useReadContract({
    address: stableStaker,
    abi: stableStakerV2Abi,
    functionName: 'claimableReward',
    args: tokenAddress && walletAddress ? [tokenAddress, walletAddress] : undefined,
    query: { enabled: enabledUser },
  });

  const { data: withdrawDisabledRaw, refetch: refetchWithdrawDisabled } = useReadContract({
    address: stableStaker,
    abi: stableStakerV2Abi,
    functionName: 'withdrawDisabled',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: { enabled },
  });

  const { data: annihilateAvailableRaw, refetch: refetchAnnihilateAvailable } = useReadContract({
    address: stableStaker,
    abi: stableStakerV2Abi,
    functionName: 'autoAnnihilateAvailable',
    args: tokenAddress ? [tokenAddress] : undefined,
    query: { enabled },
  });

  // Set-aside buffer: stake tokens held directly on the StableStakerV2, used to
  // pay withdrawals while the pool's yield strategy is underwater. A withdraw
  // that fits entirely within this buffer succeeds even when withdrawDisabled.
  const { data: bufferRaw, refetch: refetchBuffer } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: stableStaker ? [stableStaker] : undefined,
    query: { enabled },
  });

  const { data: walletBalanceRaw, isLoading: balanceLoading, refetch: refetchBalance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!tokenAddress && !!walletAddress },
  });

  const { data: allowanceRaw, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: walletAddress && stableStaker ? [walletAddress, stableStaker] : undefined,
    query: { enabled: !!tokenAddress && !!walletAddress && !!stableStaker },
  });

  const pendingRaw = (pending as bigint | undefined) ?? 0n;

  // Derived ahead of the remaining reads because the annual-emission
  // conversion below takes `antimatterPerSecond` as an argument.
  //
  // `antimatterPerSecond` stays `undefined` until `poolInfo` resolves, rather
  // than defaulting to `0n`: a zero emission rate and an unresolved read mean
  // different things to the APY helper (a real 0% versus an unknown em dash).
  const pool = poolInfo as [bigint, bigint, bigint, bigint] | undefined;
  const antimatterPerSecond = pool ? pool[0] : undefined;
  const totalStaked = pool ? pool[3] : 0n;
  const stakedRaw = userInfo ? (userInfo as [bigint, bigint])[0] : 0n;

  /**
   * Antimatter units per one raw unit of this stake token — the staker's own
   * `_antimatterScale`, `10 ** (18 - decimals)`.
   *
   * It is used ONLY to round an amount down to something the stake token can
   * express, never to perform the conversion itself. That distinction is
   * load-bearing, because `Antimatter.toStableAmount` **reverts** (it does not
   * round) on any amount finer than one stable unit, and an accrual figure is
   * essentially never an exact multiple of 1e12. Passing a live `pendingReward`
   * straight to it fails every call, which is what left the annihilation
   * preview and the APY column reading zero. The staker floors the same way:
   * `netWanted = capped / scale`.
   */
  const stableScale = 10n ** BigInt(ANTIMATTER_DECIMALS - config.decimals);
  const floorToStable = (amount: bigint) => (amount / stableScale) * stableScale;

  // Annual pool-wide Antimatter emission, converted into this pool's native
  // stable decimals by the contract that owns the conversion. This is the APY
  // numerator, and the conversion is what keeps USDC's 6 decimals from being
  // divided by an 18-decimal numerator (a 1e12 error).
  const annualAntimatterRaw = floorToStable(
    antimatterPerSecond !== undefined ? antimatterPerSecond * BigInt(SECONDS_PER_YEAR) : 0n,
  );
  const { data: annualAsStableRaw, refetch: refetchAnnualAsStable } = useReadContract({
    address: antimatterAddress,
    abi: antimatterAbi,
    functionName: 'toStableAmount',
    args: tokenAddress ? [tokenAddress, annualAntimatterRaw] : undefined,
    query: { enabled: !!antimatterAddress && !!tokenAddress && annualAntimatterRaw > 0n },
  });

  // Annihilation matches accrued Antimatter 1:1 against the user's OWN staked
  // principal; the remainder outruns the stake and is minted to them raw. Both
  // sides are capped in raw units first, mirroring `autoAnnihilate` exactly.
  const principalAsAntimatter = stakedRaw * stableScale;
  const cappedRaw = pendingRaw < principalAsAntimatter ? pendingRaw : principalAsAntimatter;
  const cappedFlooredRaw = floorToStable(cappedRaw);

  // The matched amount expressed in this pool's native stable decimals.
  // `toStableAmount` is the contract's own conversion — never hand-roll the
  // 18 → 6 scaling for USDC.
  const { data: pendingAsStableRaw, refetch: refetchPendingAsStable } = useReadContract({
    address: antimatterAddress,
    abi: antimatterAbi,
    functionName: 'toStableAmount',
    args: tokenAddress ? [tokenAddress, cappedFlooredRaw] : undefined,
    query: { enabled: !!antimatterAddress && !!tokenAddress && cappedFlooredRaw > 0n },
  });

  // Max slippage of the pool's ERC4626Market yield strategy, when it has one.
  // Admin-set and effectively static, so it's read once and deliberately left
  // out of the 12s heartbeat refresh.
  const { data: slippageBpsRaw } = useReadContract({
    address: strategyAddress,
    abi: erc4626MarketYieldStrategyAbi,
    functionName: 'slippageToleranceBps',
    query: { enabled: !!strategyAddress },
  });

  const refresh = () => {
    refetchPoolInfo();
    refetchUserInfo();
    refetchPending();
    refetchWithdrawDisabled();
    refetchAnnihilateAvailable();
    refetchBuffer();
    refetchBalance();
    refetchAllowance();
    refetchPendingAsStable();
    refetchAnnualAsStable();
  };

  // 12s heartbeat, gated on tab-active + the global Live toggle.
  useEffect(() => {
    if (!isActive || !isPollingEnabled) return;
    const interval = setInterval(() => refresh(), STAKE_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isPollingEnabled, enabled, enabledUser]);

  const walletBalance = walletBalanceRaw ? Number(walletBalanceRaw) / 10 ** config.decimals : 0;
  const stakedBalance = stakedRaw ? Number(stakedRaw) / 10 ** config.decimals : 0;
  const pendingAntimatter = pendingRaw ? Number(pendingRaw) / 10 ** ANTIMATTER_DECIMALS : 0;

  // User's Antimatter/s share of emissions = antimatterPerSecond * stakedRaw / totalStaked.
  // Both stakedRaw and totalStaked are in token decimals, so the ratio is
  // dimensionless; antimatterPerSecond is 18-dec Antimatter/s. Guard
  // totalStaked == 0. Hold the counter still when polling is paused (rate 0).
  const ratePerSecond =
    isPollingEnabled && antimatterPerSecond !== undefined && totalStaked > 0n && stakedRaw > 0n
      ? (Number(antimatterPerSecond) / 10 ** ANTIMATTER_DECIMALS) *
        (Number(stakedRaw) / Number(totalStaked))
      : 0;

  // The contract stays the authority on the conversion; the local floor is the
  // fallback for the window before the read resolves, and for the case where
  // the token's live `decimals()` disagrees with the static config (the staker
  // reads it live, this config does not). Both produce the same number.
  const matchedRaw = (pendingAsStableRaw as bigint | undefined) ?? cappedFlooredRaw / stableScale;
  const matchedStable = matchedRaw ? Number(matchedRaw) / 10 ** config.decimals : 0;
  // The contract's `excess`: reward with no principal left to annihilate it
  // against, minted straight to the caller. Whatever is under one stable unit
  // stays banked on the staker and is neither matched nor paid.
  const surplusAntimatter = Number(pendingRaw - cappedRaw) / 10 ** ANTIMATTER_DECIMALS;

  return {
    walletBalance,
    stakedBalance,
    stakedRaw,
    antimatterPerSecond,
    totalStakedRaw: totalStaked,
    annualAntimatterAsStableRaw: annualAsStableRaw as bigint | undefined,
    pendingAntimatter,
    pendingRaw,
    ratePerSecond,
    matchedStable,
    surplusAntimatter,
    withdrawDisabled: withdrawDisabledRaw === true,
    annihilateAvailable: annihilateAvailableRaw === true,
    bufferRaw: (bufferRaw as bigint | undefined) ?? 0n,
    withdrawBuffer: bufferRaw ? Number(bufferRaw) / 10 ** config.decimals : 0,
    allowanceRaw: (allowanceRaw as bigint | undefined) ?? 0n,
    conversionBps:
      strategyAddress && slippageBpsRaw !== undefined ? Number(slippageBpsRaw as bigint) : undefined,
    isLoading: poolInfoLoading || userInfoLoading || pendingLoading || balanceLoading,
    refresh,
  };
}

/**
 * Real on-chain layer for the three stablecoin pools on the Stake tab
 * (story 082). Reads `poolInfo` / `userInfo` / `pendingReward` /
 * `unclaimedReward` / wallet balance / allowance per token from the deployed
 * **StableStakerV2**, plus the global `paused()` / `claimEnabled()` flags and
 * the per-pool `withdrawDisabled(token)` / `autoAnnihilateAvailable(token)`
 * flags, and exposes approve / stake / withdraw / claim / annihilate writes.
 *
 * StableStakerV2 pays **Antimatter**, not phUSD. Antimatter is normally not
 * claimed at all — it is annihilated against the user's own staked principal,
 * destroying one unit of each and emitting phUSD worth both sides together.
 *
 * `apy` is the Antimatter **net-yield** APY: annihilation destroys one unit of
 * principal per unit of Antimatter, so the ordinary yield ratio carries a
 * `(2 x phUSDprice - 1)` factor and goes negative below $0.50. `null` (an em
 * dash, never `0`) whenever the price or the emission rate is unknown.
 *
 * The address resolves through `useContractAddresses()` (local server on dev,
 * `contracts.ts` on mainnet/sepolia). When it resolves to the zero address —
 * the expected, transient state on mainnet until the deploy-cutover script has
 * run — no reads are issued at all and every row reports `inactive`.
 *
 * @param isActive whether the Stake tab is currently active (gates polling)
 */
export function useStableStakerPools(isActive: boolean): UseStableStakerPools {
  const chainId = useChainId();
  const isMainnet = chainId === 1;
  const { address: walletAddress } = useAccount();
  const { addresses, networkType } = useContractAddresses();
  const { addToast } = useToast();
  const { refreshWalletBalances } = useWalletBalances();
  const { approve } = useTokenApproval();
  const { isPollingEnabled } = usePolling();
  const { price: balancerPrice } = useBalancerPrice();

  /**
   * Zero-address guard. `StableStakerV2` and `Antimatter` are Anvil-only until
   * the cutover, and `contracts.ts` carries the zero address for both on
   * mainnet. Resolving them to `undefined` here disables every dependent read
   * at source, so a mid-cutover preview renders inactive rows instead of a wall
   * of failed calls. The phUSD farm row reads `PhlimboV3`, which is deployed
   * everywhere, and is unaffected.
   */
  const liveAddress = (value: unknown): `0x${string}` | undefined => {
    const addr = value as `0x${string}` | undefined;
    return addr && addr !== zeroAddress ? addr : undefined;
  };

  const stableStaker = liveAddress(addresses?.StableStakerV2);
  const antimatterAddress = liveAddress(addresses?.Antimatter);
  const inactive = !stableStaker;

  /**
   * RAW phUSD price — `null` when genuinely unknown. This is what the
   * annihilate gate must use: the repo's `price > 0 ? price : 1.0` clamp turns
   * a price-feed failure into `1.0` and would silently open the gate.
   */
  const phUsdRawPrice = isMainnet ? balancerPrice : null;
  /** Clamped price. Display math only — never the gate. */
  const phUsdDisplayPrice = phUsdRawPrice !== null && phUsdRawPrice > 0 ? phUsdRawPrice : 1.0;

  /**
   * Price fed to the APY calculation.
   *
   * Off mainnet there is no Balancer pool to read, so the repo's `1.0` fallback
   * stands: `(2p - 1)` becomes 1 and the APY reduces to the ordinary
   * `A_annual / principal` yield, which is the right number for an Anvil stack.
   *
   * On mainnet an absent or out-of-band price (the `> 0 && <= 2.0` sanity
   * clamp) resolves to `null`, NOT to `phUsdDisplayPrice`'s `1.0`. The whole
   * APY is the `(2p - 1)` factor, so substituting a fabricated price would
   * publish a fabricated APY; `null` renders the em dash this repo uses for an
   * unknown, and matches the annihilate gate, which is also shut whenever the
   * price cannot be established.
   */
  const phUsdApyPrice: number | null = !isMainnet
    ? 1.0
    : phUsdRawPrice !== null && phUsdRawPrice > 0 && phUsdRawPrice <= 2.0
      ? phUsdRawPrice
      : null;

  const tokenAddressFor = (cfg: StablePoolConfig): `0x${string}` | undefined =>
    addresses ? (addresses[cfg.addressKey] as `0x${string}`) : undefined;

  // ERC4626Market yield strategy address for pools that route deposits through
  // an AMM (USDe). Undefined (read disabled) for the others, and when the
  // address server reports the zero-address placeholder.
  const strategyAddressFor = (cfg: StablePoolConfig): `0x${string}` | undefined => {
    if (!addresses || !cfg.marketStrategyKey) return undefined;
    return liveAddress(addresses[cfg.marketStrategyKey]);
  };

  // ---- Global flags (gate all pools) --------------------------------------
  const { data: isPausedRaw } = useReadContract({
    address: stableStaker,
    abi: stableStakerV2Abi,
    functionName: 'paused',
    query: { enabled: !!stableStaker },
  });
  const isPaused = isPausedRaw === true;

  // Closed by default: accrued Antimatter banks rather than pays until an owner
  // opens the gate.
  const { data: claimEnabledRaw, refetch: refetchClaimEnabled } = useReadContract({
    address: stableStaker,
    abi: stableStakerV2Abi,
    functionName: 'claimEnabled',
    query: { enabled: !!stableStaker },
  });
  const claimEnabled = claimEnabledRaw === true;

  /**
   * The accrual token is called **Antimatter** on screen, everywhere, and the
   * ERC20's own `symbol()` is deliberately not read for this: it returns the
   * ticker `AM`, which reads as an abbreviation of nothing to a user meeting
   * the surface for the first time and discards the annihilation metaphor the
   * whole tab is built on.
   */
  const antimatterSymbol = ANTIMATTER_DISPLAY_NAME;

  const { data: walletAntimatterRaw, refetch: refetchWalletAntimatter } = useReadContract({
    address: antimatterAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!antimatterAddress && !!walletAddress },
  });
  const walletAntimatter = walletAntimatterRaw
    ? Number(walletAntimatterRaw) / 10 ** ANTIMATTER_DECIMALS
    : 0;

  const phUsdAddress = liveAddress(addresses?.PhUSD);
  const { data: walletPhUsdRaw, refetch: refetchWalletPhUsd } = useReadContract({
    address: phUsdAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!phUsdAddress && !!walletAddress },
  });
  const walletPhUSD = walletPhUsdRaw ? Number(walletPhUsdRaw) / 1e18 : 0;

  // ---- Per-token reads (fixed 3-entry static config) ----------------------
  // Iterated over the STATIC config, never over `getStakedTokens()`: one
  // `useStablePoolReads` call per fixed entry is what keeps the rules of hooks
  // satisfied.
  const usdcReads = useStablePoolReads(STABLE_POOLS[0], stableStaker, antimatterAddress, tokenAddressFor(STABLE_POOLS[0]), strategyAddressFor(STABLE_POOLS[0]), walletAddress, isActive, isPollingEnabled);
  const usdeReads = useStablePoolReads(STABLE_POOLS[1], stableStaker, antimatterAddress, tokenAddressFor(STABLE_POOLS[1]), strategyAddressFor(STABLE_POOLS[1]), walletAddress, isActive, isPollingEnabled);
  const dolaReads = useStablePoolReads(STABLE_POOLS[2], stableStaker, antimatterAddress, tokenAddressFor(STABLE_POOLS[2]), strategyAddressFor(STABLE_POOLS[2]), walletAddress, isActive, isPollingEnabled);
  const readsById: Record<StablePoolId, PoolReads> = {
    usdc: usdcReads,
    usde: usdeReads,
    dola: dolaReads,
  };

  const configById = (id: StablePoolId) => STABLE_POOLS.find((p) => p.id === id)!;

  const needsApprovalFor = (cfg: StablePoolConfig, allowanceRaw: bigint) => (amount: string): boolean => {
    if (!amount || amount === '' || amount === '0') return false;
    let amountWei = 0n;
    try {
      amountWei = parseUnits(amount, cfg.decimals);
    } catch {
      return false;
    }
    if (amountWei === 0n) return false;
    return allowanceRaw < amountWei;
  };

  /**
   * Why annihilation is unavailable, or `null` when it is available.
   *
   * Order matters: the price gates come first because they are the ones a user
   * most needs explained. ONLY annihilation is gated this way — `stake` and
   * especially `withdraw` stay available in every one of these states, because
   * a low phUSD price is a reason to stop annihilating, not a reason to trap
   * someone's principal.
   */
  const annihilateReasonFor = (r: PoolReads): string | null => {
    if (inactive) return 'Antimatter staking is not live on this network yet.';
    if (isPaused) return 'The staker is paused.';
    if (isMainnet && phUsdRawPrice === null) {
      return 'The phUSD price is currently unavailable, so the value of annihilating cannot be established. Annihilation stays disabled until the price feed recovers.';
    }
    if (isMainnet && phUsdRawPrice !== null && phUsdRawPrice <= ANNIHILATE_PRICE_FLOOR) {
      return `phUSD is trading at $${phUsdRawPrice.toFixed(4)}. Annihilation destroys one unit of your staked principal per unit of Antimatter and pays phUSD worth both sides, so at or below $${ANNIHILATE_PRICE_FLOOR.toFixed(2)} it returns less value than it destroys. Withdrawing is unaffected.`;
    }
    if (!r.annihilateAvailable) return 'The contract reports annihilation is not available for this pool right now.';
    return null;
  };

  /**
   * Confirmed annihilations per pool, the trigger for the row's burst
   * animation. Held here rather than in the row because the row is hook-free
   * by design, and because the event that should start the animation is the
   * transaction receipt, which only this hook sees.
   */
  const [annihilationCounts, setAnnihilationCounts] = useState<Record<string, number>>({});

  const pools: AntimatterStakeRow[] = STABLE_POOLS.map((cfg) => {
    const r = readsById[cfg.id];
    // A pool with no live staker has no emission rate to read, so its APY is
    // unknown rather than zero.
    const apy = inactive
      ? null
      : computeAntimatterApy({
          antimatterPerSecond: r.antimatterPerSecond ?? null,
          annualAntimatterAsStableRaw: r.annualAntimatterAsStableRaw,
          totalStaked: r.totalStakedRaw,
          stableDecimals: cfg.decimals,
          phUsdPrice: phUsdApyPrice,
          walletBalance: r.walletBalance,
        });
    return {
      id: cfg.id,
      symbol: cfg.symbol,
      stakeIcon: cfg.stakeIcon,
      decimals: cfg.decimals,
      walletBalance: r.walletBalance,
      stakedBalance: r.stakedBalance,
      pendingAntimatter: r.pendingAntimatter,
      ratePerSecond: r.ratePerSecond,
      matchedStable: r.matchedStable,
      surplusAntimatter: r.surplusAntimatter,
      annihilationCount: annihilationCounts[cfg.id] ?? 0,
      apy,
      disabled: isPaused || inactive,
      withdrawDisabled: r.withdrawDisabled,
      withdrawBuffer: r.withdrawBuffer,
      inactive,
      claimEnabled,
      annihilateAvailable: r.annihilateAvailable,
      annihilateDisabledReason: annihilateReasonFor(r),
      needsApproval: needsApprovalFor(cfg, r.allowanceRaw),
      tagline: cfg.tagline,
      conversionBps: r.conversionBps,
    };
  });

  // ---- Writes -------------------------------------------------------------
  const [pendingAction, setPendingAction] = useState<{ id: StablePoolId; action: StableStakeAction } | null>(null);
  // Track which pool each write hash belongs to so the success effect refreshes
  // the right pool.
  const [stakeCtx, setStakeCtx] = useState<{ id: StablePoolId; amount: string } | null>(null);
  const [withdrawCtx, setWithdrawCtx] = useState<{ id: StablePoolId; amount: string } | null>(null);
  const [claimCtx, setClaimCtx] = useState<{ id: StablePoolId } | null>(null);
  const [annihilateCtx, setAnnihilateCtx] = useState<{ id: StablePoolId } | null>(null);
  const [approveCtx, setApproveCtx] = useState<{ id: StablePoolId } | null>(null);

  const explorerUrl = (hash: string) =>
    networkType === 'mainnet'
      ? `https://etherscan.io/tx/${hash}`
      : `https://sepolia.etherscan.io/tx/${hash}`;

  const { data: stakeHash, writeContractAsync: writeStake } = useWriteContract();
  const { isSuccess: isStakeSuccess } = useWaitForTransactionReceipt({ hash: stakeHash, query: { enabled: !!stakeHash } });

  const { data: withdrawHash, writeContractAsync: writeWithdraw } = useWriteContract();
  const { isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawHash, query: { enabled: !!withdrawHash } });

  const { data: claimHash, writeContractAsync: writeClaim } = useWriteContract();
  const { isSuccess: isClaimSuccess } = useWaitForTransactionReceipt({ hash: claimHash, query: { enabled: !!claimHash } });

  const { data: annihilateHash, writeContractAsync: writeAnnihilate } = useWriteContract();
  const { isSuccess: isAnnihilateSuccess } = useWaitForTransactionReceipt({ hash: annihilateHash, query: { enabled: !!annihilateHash } });

  // Approval goes through the shared `useTokenApproval().approve` helper (its own
  // internal write), so we track the returned hash ourselves to await the receipt.
  const [approveHash, setApproveHash] = useState<`0x${string}` | undefined>(undefined);
  const { isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash, query: { enabled: !!approveHash } });

  function handleTxError(error: unknown, failTitle: string) {
    log.error(`${failTitle}:`, error);
    const msg = error instanceof Error ? error.message : 'Unknown error occurred';
    if (msg.toLowerCase().includes('user rejected') || msg.toLowerCase().includes('user denied')) {
      addToast({ type: 'error', title: 'Transaction Cancelled', description: 'You cancelled the transaction. Please try again when ready.', duration: 8000 });
    } else {
      addToast({ type: 'error', title: failTitle, description: msg, duration: 16000 });
    }
  }

  const ensureReady = (cfg: StablePoolConfig): `0x${string}` | undefined => {
    if (inactive) {
      addToast({ type: 'info', title: 'Not Live On This Network', description: 'Antimatter staking has not been deployed to this network yet.' });
      return undefined;
    }
    if (!walletAddress) {
      addToast({ type: 'error', title: 'Wallet Not Connected', description: 'Please connect your wallet using the button in the header.' });
      return undefined;
    }
    const tokenAddress = tokenAddressFor(cfg);
    if (!stableStaker || !tokenAddress) {
      addToast({ type: 'error', title: 'Contract Not Ready', description: 'Please wait for contract addresses to load.' });
      return undefined;
    }
    return tokenAddress;
  };

  const approveAction = async (id: StablePoolId): Promise<void> => {
    const cfg = configById(id);
    const tokenAddress = ensureReady(cfg);
    if (!tokenAddress) return;
    try {
      setPendingAction({ id, action: 'approve' });
      setApproveCtx({ id });
      addToast({ type: 'info', title: 'Confirm in Wallet', description: `Please confirm the ${cfg.symbol} approval in your wallet.`, duration: 30000 });
      const hash = await approve(tokenAddress, stableStaker!, maxUint256);
      setApproveHash(hash);
      addToast({ type: 'info', title: 'Transaction Submitted', description: 'Waiting for blockchain confirmation...', duration: 30000, action: { label: 'View on Etherscan', onClick: () => window.open(explorerUrl(hash), '_blank') } });
    } catch (error) {
      handleTxError(error, 'Approval Failed');
      setPendingAction(null);
      setApproveCtx(null);
    }
  };

  const stake = async (id: StablePoolId, amount: string): Promise<void> => {
    const cfg = configById(id);
    if (isPaused) {
      addToast({ type: 'info', title: 'Staking Paused', description: 'Staking is temporarily paused. Please try again later.' });
      return;
    }
    if (!amount || amount === '0' || amount === '') {
      addToast({ type: 'error', title: 'Invalid Amount', description: 'Please enter a valid amount greater than 0.' });
      return;
    }
    const tokenAddress = ensureReady(cfg);
    if (!tokenAddress) return;
    if (parseFloat(amount) > readsById[id].walletBalance) {
      addToast({ type: 'error', title: 'Insufficient Balance', description: `You only have ${readsById[id].walletBalance.toFixed(4)} ${cfg.symbol} available.` });
      return;
    }
    try {
      setPendingAction({ id, action: 'stake' });
      setStakeCtx({ id, amount });
      addToast({ type: 'info', title: 'Confirm Transaction', description: `Please confirm the ${cfg.symbol} stake in your wallet.`, duration: 30000 });
      const amountWei = parseUnits(amount, cfg.decimals);
      const hash = await writeStake({ address: stableStaker!, abi: stableStakerV2Abi, functionName: 'stake', args: [tokenAddress, amountWei] });
      addToast({ type: 'info', title: 'Transaction Submitted', description: 'Waiting for blockchain confirmation...', duration: 30000, action: { label: 'View on Etherscan', onClick: () => window.open(explorerUrl(hash), '_blank') } });
    } catch (error) {
      handleTxError(error, 'Stake Failed');
      setPendingAction(null);
      setStakeCtx(null);
    }
  };

  const withdraw = async (id: StablePoolId, amount: string): Promise<void> => {
    const cfg = configById(id);
    if (isPaused) {
      addToast({ type: 'info', title: 'Withdrawals Paused', description: 'Withdrawals are temporarily paused. Please try again later.' });
      return;
    }
    if (readsById[id].withdrawDisabled) {
      // While underwater the contract still pays withdrawals that fit entirely
      // within the set-aside buffer held on the StableStakerV2, so only block
      // amounts exceeding it. Raw-unit comparison mirrors the contract check.
      let amountWei = 0n;
      try {
        amountWei = parseUnits(amount || '0', cfg.decimals);
      } catch {
        amountWei = 0n;
      }
      if (amountWei > readsById[id].bufferRaw) {
        addToast({
          type: 'info',
          title: 'Amount Exceeds Buffer',
          description: `This pool's yield strategy is rebalancing, so withdrawals are limited to the set-aside buffer of ${readsById[id].withdrawBuffer.toFixed(2)} ${cfg.symbol}. Enter a smaller amount, or wait for it to settle.`,
          duration: 12000,
        });
        return;
      }
    }
    if (!amount || amount === '0' || amount === '') {
      addToast({ type: 'error', title: 'Invalid Amount', description: 'Please enter a valid amount greater than 0.' });
      return;
    }
    const tokenAddress = ensureReady(cfg);
    if (!tokenAddress) return;
    if (parseFloat(amount) > readsById[id].stakedBalance) {
      addToast({ type: 'error', title: 'Insufficient Staked Balance', description: `You only have ${readsById[id].stakedBalance.toFixed(4)} ${cfg.symbol} staked.` });
      return;
    }
    try {
      setPendingAction({ id, action: 'withdraw' });
      setWithdrawCtx({ id, amount });
      addToast({ type: 'info', title: 'Confirm Transaction', description: `Please confirm the ${cfg.symbol} withdrawal in your wallet.`, duration: 30000 });
      const amountWei = parseUnits(amount, cfg.decimals);
      const hash = await writeWithdraw({ address: stableStaker!, abi: stableStakerV2Abi, functionName: 'withdraw', args: [tokenAddress, amountWei] });
      addToast({ type: 'info', title: 'Transaction Submitted', description: 'Waiting for blockchain confirmation...', duration: 30000, action: { label: 'View on Etherscan', onClick: () => window.open(explorerUrl(hash), '_blank') } });
    } catch (error) {
      handleTxError(error, 'Withdrawal Failed');
      setPendingAction(null);
      setWithdrawCtx(null);
    }
  };

  /**
   * Ordinary claim of accrued Antimatter. Gated on-chain by `claimEnabled()`,
   * which is shut by default — offering this without reading the gate would
   * tell the user their rewards are claimable when they are not.
   */
  const claim = async (id: StablePoolId): Promise<void> => {
    const cfg = configById(id);
    if (isPaused) {
      addToast({ type: 'info', title: 'Claiming Paused', description: 'Claiming is temporarily paused. Please try again later.' });
      return;
    }
    if (!claimEnabled) {
      addToast({
        type: 'info',
        title: 'Claiming Not Open Yet',
        description: `${antimatterSymbol} is still accruing, but the claim gate is closed, so rewards bank on the contract rather than paying out. You can still annihilate them against your stake.`,
        duration: 12000,
      });
      return;
    }
    const tokenAddress = ensureReady(cfg);
    if (!tokenAddress) return;
    if (readsById[id].pendingAntimatter <= 0) {
      addToast({ type: 'info', title: 'Nothing to Claim', description: `No pending ${antimatterSymbol} in the ${cfg.symbol} pool.` });
      return;
    }
    try {
      setPendingAction({ id, action: 'claim' });
      setClaimCtx({ id });
      addToast({ type: 'info', title: 'Confirm Transaction', description: `Please confirm the ${cfg.symbol} pool claim in your wallet.`, duration: 30000 });
      const hash = await writeClaim({ address: stableStaker!, abi: stableStakerV2Abi, functionName: 'claim', args: [tokenAddress] });
      addToast({ type: 'info', title: 'Transaction Submitted', description: 'Waiting for blockchain confirmation...', duration: 30000, action: { label: 'View on Etherscan', onClick: () => window.open(explorerUrl(hash), '_blank') } });
    } catch (error) {
      handleTxError(error, 'Claim Failed');
      setPendingAction(null);
      setClaimCtx(null);
    }
  };

  /**
   * Annihilate: the contract matches accrued Antimatter against the user's own
   * staked principal, destroys both sides, and mints phUSD worth their sum.
   *
   * `autoAnnihilate(token)` on the staker is used rather than
   * `antimatterAbi.annihilate(...)` directly: the staker holds the position and
   * owns the matching, and the direct call would need a genuine `minPhUSDOut`
   * slippage floor this surface has no honest way to compute.
   */
  const annihilate = async (id: StablePoolId): Promise<void> => {
    const cfg = configById(id);
    const r = readsById[id];
    const reason = annihilateReasonFor(r);
    if (reason) {
      addToast({ type: 'info', title: 'Annihilation Unavailable', description: reason, duration: 14000 });
      return;
    }
    const tokenAddress = ensureReady(cfg);
    if (!tokenAddress) return;
    // `require(netWanted > 0 || excess > 0)` on the contract: a user whose
    // accrual has outrun their entire stake has nothing left to match but a
    // real surplus to be paid, and the call still succeeds for them.
    if (r.matchedStable <= 0 && r.surplusAntimatter <= 0) {
      addToast({ type: 'info', title: 'Nothing To Annihilate', description: `Stake ${cfg.symbol} to accrue ${antimatterSymbol} first.` });
      return;
    }
    try {
      setPendingAction({ id, action: 'annihilate' });
      setAnnihilateCtx({ id });
      addToast({ type: 'info', title: 'Confirm Transaction', description: `Please confirm the ${cfg.symbol} annihilation in your wallet.`, duration: 30000 });
      const hash = await writeAnnihilate({ address: stableStaker!, abi: stableStakerV2Abi, functionName: 'autoAnnihilate', args: [tokenAddress] });
      addToast({ type: 'info', title: 'Transaction Submitted', description: 'Waiting for blockchain confirmation...', duration: 30000, action: { label: 'View on Etherscan', onClick: () => window.open(explorerUrl(hash), '_blank') } });
    } catch (error) {
      handleTxError(error, 'Annihilation Failed');
      setPendingAction(null);
      setAnnihilateCtx(null);
    }
  };

  // ---- Post-tx success handlers -------------------------------------------
  useEffect(() => {
    if (isStakeSuccess && stakeHash && stakeCtx) {
      const cfg = configById(stakeCtx.id);
      addToast({ type: 'success', title: 'Stake Successful', description: `Successfully staked ${parseFloat(stakeCtx.amount || '0').toFixed(4)} ${cfg.symbol}`, duration: 30000, action: { label: 'View Transaction', onClick: () => window.open(explorerUrl(stakeHash), '_blank') } });
      readsById[stakeCtx.id].refresh();
      refreshWalletBalances();
      setPendingAction(null);
      setStakeCtx(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStakeSuccess, stakeHash]);

  useEffect(() => {
    if (isWithdrawSuccess && withdrawHash && withdrawCtx) {
      const cfg = configById(withdrawCtx.id);
      addToast({ type: 'success', title: 'Withdrawal Successful', description: `Successfully withdrew ${parseFloat(withdrawCtx.amount || '0').toFixed(4)} ${cfg.symbol}`, duration: 30000, action: { label: 'View Transaction', onClick: () => window.open(explorerUrl(withdrawHash), '_blank') } });
      readsById[withdrawCtx.id].refresh();
      refreshWalletBalances();
      setPendingAction(null);
      setWithdrawCtx(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWithdrawSuccess, withdrawHash]);

  useEffect(() => {
    if (isClaimSuccess && claimHash && claimCtx) {
      const cfg = configById(claimCtx.id);
      addToast({ type: 'success', title: 'Claim Successful', description: `Successfully claimed ${antimatterSymbol} from the ${cfg.symbol} pool`, duration: 30000, action: { label: 'View Transaction', onClick: () => window.open(explorerUrl(claimHash), '_blank') } });
      readsById[claimCtx.id].refresh();
      refetchClaimEnabled();
      refetchWalletAntimatter();
      refreshWalletBalances();
      setPendingAction(null);
      setClaimCtx(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClaimSuccess, claimHash]);

  useEffect(() => {
    if (isAnnihilateSuccess && annihilateHash && annihilateCtx) {
      const cfg = configById(annihilateCtx.id);
      addToast({ type: 'success', title: 'Annihilation Confirmed', description: `${antimatterSymbol} annihilated against your staked ${cfg.symbol}; phUSD has been minted to your wallet.`, duration: 30000, action: { label: 'View Transaction', onClick: () => window.open(explorerUrl(annihilateHash), '_blank') } });
      // Before the refresh, so the burst starts in the same commit that the
      // figures begin falling to zero rather than a beat after it.
      setAnnihilationCounts((cur) => ({ ...cur, [annihilateCtx.id]: (cur[annihilateCtx.id] ?? 0) + 1 }));
      readsById[annihilateCtx.id].refresh();
      refetchWalletAntimatter();
      refetchWalletPhUsd();
      refreshWalletBalances();
      setPendingAction(null);
      setAnnihilateCtx(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnnihilateSuccess, annihilateHash]);

  useEffect(() => {
    if (isApproveSuccess && approveHash && approveCtx) {
      const cfg = configById(approveCtx.id);
      addToast({ type: 'success', title: 'Approval Successful', description: `${cfg.symbol} spending approved for staking.`, duration: 30000, action: { label: 'View Transaction', onClick: () => window.open(explorerUrl(approveHash), '_blank') } });
      // Re-read allowance so the button flips from Approve to Stake.
      readsById[approveCtx.id].refresh();
      setPendingAction(null);
      setApproveCtx(null);
      setApproveHash(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApproveSuccess, approveHash]);

  const isLoading = !inactive && (usdcReads.isLoading || usdeReads.isLoading || dolaReads.isLoading);

  return {
    pools,
    pendingAction,
    stake,
    withdraw,
    claim,
    annihilate,
    approve: approveAction,
    claimEnabled,
    antimatterSymbol,
    walletAntimatter,
    walletPhUSD,
    phUsdRawPrice,
    phUsdDisplayPrice,
    isLoading,
  };
}
