/**
 * useUniMarket — the single seam behind the "Market (uni)" tab (story 087,
 * replacing story 084/085's mock hook behind the same return shape).
 *
 * Reads:
 *   - quotes from the UniswapHelper `quote*` functions (exact-in only; the ETH
 *     quotes are non-view and go through `useSimulateContract`)
 *   - reserves, token0 and LP totalSupply from the phUSD/sUSDS V2 pair
 *   - the sUSDS share price (`convertToAssets(1e18)`), previewDeposit/previewRedeem
 *   - every token balance + allowance to UniswapHelper, the native ETH balance
 *     and the LP (pair) balance + allowance
 * Writes:
 *   - ERC20 approvals to UniswapHelper (the only spender), then one helper call
 *
 * Zero-address guard: while `UniswapHelper` or `PhusdSusdsPair` is missing or
 * the zero address (mainnet / Sepolia until the cutover) every read is
 * disabled, no write is ever sent, and the CTA reads "Not available on this
 * network".
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useAccount,
  useBalance,
  useChainId,
  useReadContract,
  useSimulateContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { erc20Abi, erc4626Abi, formatUnits, maxUint256, zeroAddress, type Address, type Hash } from 'viem';
import { uniswapHelperAbi } from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../contexts/ContractAddressContext';
import { useToast } from '../components/ui/ToastProvider';
import { useWalletBalances } from '../contexts/WalletBalancesContext';
import { useTokenApproval } from './useContractInteractions';
import { uniV2PairAbi } from '../lib/uniboostPoolMath';
import { decodeContractError } from '../lib/decodeContractError';
import { log } from '../utils/logger';
import {
  ADD_TOKENS,
  DEADLINE_MINUTES,
  DEFAULT_ADD_TOKEN,
  DEFAULT_REMOVE_OUT,
  DEFAULT_SLIPPAGE,
  ETH_GAS_RESERVE_WEI,
  LP_DECIMALS,
  LP_DP,
  LP_SYMBOL,
  ORDER,
  REMOVE_OUT_TOKENS,
  REMOVE_PCTS,
  SLIPPAGE_OPTIONS,
  TOKENS,
  UNISWAP_TRADE_URL,
  explorerTxUrl,
  metaOf,
  type AddTokenSymbol,
  type ApprovableSymbol,
  type HelperMethod,
  type MarketSymbol,
  type RemoveOutSymbol,
  type SwapTokenSymbol,
} from '../data/uniMarketConfig';
import {
  UNAVAILABLE_CTA,
  WAD,
  addCta,
  addModalStats,
  addQuote,
  addSteps,
  balText,
  clean,
  decimalsOf,
  dpOf,
  fmt,
  fmtUnits,
  parseAmount,
  pct,
  poolPrice,
  positionView,
  rawUnits,
  removeCta,
  removeModalStats,
  removePctAmount,
  removePctLabel,
  removePctSelected,
  removeQuote,
  removeSteps,
  routeHint,
  routeSummary,
  short,
  swapCta,
  swapModalStats,
  swapQuote,
  swapSteps,
  toNum,
  usd,
  type AddEditedSide,
  type Direction,
  type PoolState,
  type ReviewStep,
  type Stat,
} from '../lib/uniV2Math';

export type MarketMode = 'swap' | 'add' | 'remove';
/** The two liquidity sub-modes behind the Add / Remove toggle. */
export type LiquidityAction = 'add' | 'remove';
/** The top Swap / Liquidity control. */
export type TopMode = 'swap' | 'liquidity';

/** Quotes fire this long after the last keystroke. */
export const QUOTE_DEBOUNCE_MS = 300;

export interface ReviewLeg {
  caption: string;
  sym: MarketSymbol;
  amount: string;
}

export interface PctOptionView {
  /** Fraction of the position (1 = Max). */
  p: number;
  label: string;
  selected: boolean;
}

export interface OutOptionView {
  sym: RemoveOutSymbol;
  selected: boolean;
}

export interface ReceiveRowView {
  sym: MarketSymbol;
  amount: string;
}

export interface TokenRowView {
  sym: SwapTokenSymbol;
  name: string;
  hint: string;
  balText: string;
  selected: boolean;
}

/** The one helper call a review ends in. Amounts are frozen when the review opens. */
export type ActionPlan =
  | { method: 'swapToPhUSD' | 'swapFromPhUSD'; token: SwapTokenSymbol; amountIn: bigint; min: bigint }
  | { method: 'swapETHToPhUSD' | 'swapPhUSDToETH'; amountIn: bigint; min: bigint }
  | { method: 'addLiquiditySUSDS' | 'addLiquidityUSDS'; a: bigint; b: bigint; aMin: bigint; bMin: bigint }
  | { method: 'removeLiquiditySUSDS' | 'removeLiquidityUSDS'; liquidity: bigint; outMin: bigint; phMin: bigint };

/** Everything the review modal shows, frozen at `startReview()`. */
interface Review {
  mode: MarketMode;
  steps: ReviewStep[];
  action: ActionPlan;
  legs: [ReviewLeg, ReviewLeg];
  stats: Stat[];
  successText: string;
}

interface UniMarketState {
  mode: MarketMode;
  dir: Direction;
  tok: SwapTokenSymbol;
  pay: string;
  addSym: AddTokenSymbol;
  aTok: string;
  aPh: string;
  aEdited: AddEditedSide;
  slip: number;
  settingsOpen: boolean;
  pickerOpen: boolean;
  addPickerOpen: boolean;
  review: Review | null;
  stepIdx: number;
  pending: boolean;
  success: boolean;
  exactApprove: boolean;
  /** Tx awaiting its receipt for the current step. */
  txHash: Hash | undefined;
  /** Final tx of a completed review (explorer link). */
  lastHash: Hash | undefined;
  /** Raw burn input on the Remove panel. */
  rLp: string;
  out: RemoveOutSymbol;
  /** Liquidity sub-mode to return to from Swap. */
  lastLiq: LiquidityAction;
}

const INITIAL_STATE: UniMarketState = {
  mode: 'swap',
  dir: 'buy',
  tok: 'USDC',
  pay: '',
  addSym: DEFAULT_ADD_TOKEN,
  aTok: '',
  aPh: '',
  aEdited: 'tok',
  slip: DEFAULT_SLIPPAGE,
  settingsOpen: false,
  pickerOpen: false,
  addPickerOpen: false,
  review: null,
  stepIdx: 0,
  pending: false,
  success: false,
  exactApprove: false,
  txHash: undefined,
  lastHash: undefined,
  rLp: '',
  out: DEFAULT_REMOVE_OUT,
  lastLiq: 'add',
};

const CLOSE_POPOVERS = { pickerOpen: false, settingsOpen: false, addPickerOpen: false } as const;

/** Resolve an address to `undefined` when missing or zero, so dependent reads disable at source. */
export function liveAddress(value: unknown): Address | undefined {
  const addr = value as Address | undefined;
  return typeof addr === 'string' && addr.startsWith('0x') && addr.toLowerCase() !== zeroAddress ? addr : undefined;
}

/** Unix-seconds deadline, computed at submit time for each write. */
export function deadlineFromNow(minutes: number = DEADLINE_MINUTES, nowMs: number = Date.now()): bigint {
  return BigInt(Math.floor(nowMs / 1000) + minutes * 60);
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Wallet balance + allowance to the helper for one ERC20. Disabled unless every address is live. */
function useErc20State(token: Address | undefined, owner: Address | undefined, spender: Address | undefined) {
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: owner ? [owner] : undefined,
    query: { enabled: !!token && !!owner },
  });
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: owner && spender ? [owner, spender] : undefined,
    query: { enabled: !!token && !!owner && !!spender },
  });
  const refetch = useCallback(() => {
    void refetchBalance();
    void refetchAllowance();
  }, [refetchBalance, refetchAllowance]);
  return {
    balance: typeof balance === 'bigint' ? balance : undefined,
    allowance: typeof allowance === 'bigint' ? allowance : undefined,
    refetch,
  };
}

const asBig = (v: unknown): bigint | undefined => (typeof v === 'bigint' ? v : undefined);

export function useUniMarket() {
  const [state, setState] = useState<UniMarketState>(INITIAL_STATE);
  const patch = useCallback((p: Partial<UniMarketState>) => setState((prev) => ({ ...prev, ...p })), []);

  const { address: wallet } = useAccount();
  const chainId = useChainId();
  const { addresses } = useContractAddresses();
  const { addToast } = useToast();
  const { refreshWalletBalances } = useWalletBalances();
  const { approve } = useTokenApproval();
  const { writeContractAsync } = useWriteContract();

  // ---- zero-address guard -------------------------------------------------
  const helperRaw = liveAddress(addresses?.UniswapHelper);
  const pairRaw = liveAddress(addresses?.PhusdSusdsPair);
  const available = !!helperRaw && !!pairRaw;
  const helper = available ? helperRaw : undefined;
  const pair = available ? pairRaw : undefined;
  const tokenAddresses: Record<ApprovableSymbol, Address | undefined> = useMemo(() => {
    const addrOf = (key: 'Dola' | 'USDC' | 'USDe' | 'USDS' | 'SUSDS' | 'PhUSD'): Address | undefined =>
      available ? liveAddress(addresses?.[key]) : undefined;
    return {
      DOLA: addrOf('Dola'),
      USDC: addrOf('USDC'),
      USDe: addrOf('USDe'),
      USDS: addrOf('USDS'),
      sUSDS: addrOf('SUSDS'),
      phUSD: addrOf('PhUSD'),
      ETH: undefined,
      [LP_SYMBOL]: pair,
    };
  }, [addresses, available, pair]);
  const owner = available ? wallet : undefined;
  const connected = !!wallet;

  // ---- pair + sUSDS -------------------------------------------------------
  const { data: reservesRaw, refetch: refetchReserves } = useReadContract({
    address: pair,
    abi: uniV2PairAbi,
    functionName: 'getReserves',
    query: { enabled: !!pair },
  });
  const { data: token0Raw } = useReadContract({
    address: pair,
    abi: uniV2PairAbi,
    functionName: 'token0',
    query: { enabled: !!pair },
  });
  const { data: totalSupplyRaw, refetch: refetchTotalSupply } = useReadContract({
    address: pair,
    abi: uniV2PairAbi,
    functionName: 'totalSupply',
    query: { enabled: !!pair },
  });
  const susds = tokenAddresses.sUSDS;
  const { data: spxRaw, refetch: refetchSpx } = useReadContract({
    address: susds,
    abi: erc4626Abi,
    functionName: 'convertToAssets',
    args: [WAD],
    query: { enabled: !!susds },
  });

  const phusdAddr = tokenAddresses.phUSD;
  const pool: PoolState | undefined = useMemo(() => {
    const r = reservesRaw as readonly [bigint, bigint, number] | undefined;
    const t0 = token0Raw as Address | undefined;
    const ts = asBig(totalSupplyRaw);
    const spx = asBig(spxRaw);
    if (!r || !t0 || ts === undefined || spx === undefined || !phusdAddr) return undefined;
    const phIs0 = t0.toLowerCase() === phusdAddr.toLowerCase();
    return { rPh: phIs0 ? r[0] : r[1], rS: phIs0 ? r[1] : r[0], totalSupply: ts, spx };
  }, [reservesRaw, token0Raw, totalSupplyRaw, spxRaw, phusdAddr]);

  // ---- balances + allowances (spender = UniswapHelper) --------------------
  const dola = useErc20State(tokenAddresses.DOLA, owner, helper);
  const usdc = useErc20State(tokenAddresses.USDC, owner, helper);
  const usde = useErc20State(tokenAddresses.USDe, owner, helper);
  const usdsT = useErc20State(tokenAddresses.USDS, owner, helper);
  const susdsT = useErc20State(tokenAddresses.sUSDS, owner, helper);
  const phusd = useErc20State(tokenAddresses.phUSD, owner, helper);
  const lpT = useErc20State(pair, owner, helper);
  const { data: ethBalRaw, refetch: refetchEth } = useBalance({
    address: owner,
    query: { enabled: !!owner },
  });
  const ethBal = ethBalRaw?.value;

  const balances: Record<ApprovableSymbol, bigint | undefined> = {
    DOLA: dola.balance, USDC: usdc.balance, USDe: usde.balance, USDS: usdsT.balance,
    sUSDS: susdsT.balance, phUSD: phusd.balance, ETH: ethBal, [LP_SYMBOL]: lpT.balance,
  };
  const allowances: Record<ApprovableSymbol, bigint | undefined> = {
    DOLA: dola.allowance, USDC: usdc.allowance, USDe: usde.allowance, USDS: usdsT.allowance,
    sUSDS: susdsT.allowance, phUSD: phusd.allowance, ETH: undefined, [LP_SYMBOL]: lpT.allowance,
  };
  const lpBal = lpT.balance ?? 0n;

  // ---- swap quote ---------------------------------------------------------
  const t = TOKENS[state.tok];
  const buy = state.dir === 'buy';
  const inSym: MarketSymbol = buy ? t.sym : 'phUSD';
  const inDec = metaOf(inSym).decimals;
  const inWei = parseAmount(state.pay, inDec);
  const debouncedPay = useDebounced(state.pay, QUOTE_DEBOUNCE_MS);
  const quoteIn = parseAmount(debouncedPay, inDec);
  const tokAddr = tokenAddresses[state.tok];
  const quoteOn = available && quoteIn > 0n && state.mode === 'swap';

  const stableBuy = useReadContract({
    address: helper,
    abi: uniswapHelperAbi,
    functionName: 'quoteToPhUSD',
    args: tokAddr ? [tokAddr, quoteIn] : undefined,
    query: { enabled: quoteOn && buy && !t.native && !!tokAddr },
  });
  const stableSell = useReadContract({
    address: helper,
    abi: uniswapHelperAbi,
    functionName: 'quoteFromPhUSD',
    args: tokAddr ? [tokAddr, quoteIn] : undefined,
    query: { enabled: quoteOn && !buy && !t.native && !!tokAddr },
  });
  // quoteETHToPhUSD / quotePhUSDToETH are nonpayable (they call the V3 quoter): simulate.
  const ethBuy = useSimulateContract({
    address: helper,
    abi: uniswapHelperAbi,
    functionName: 'quoteETHToPhUSD',
    args: [quoteIn],
    account: zeroAddress,
    query: { enabled: quoteOn && buy && t.native },
  });
  const ethSell = useSimulateContract({
    address: helper,
    abi: uniswapHelperAbi,
    functionName: 'quotePhUSDToETH',
    args: [quoteIn],
    account: zeroAddress,
    query: { enabled: quoteOn && !buy && t.native },
  });
  // phUSD per 1 ETH — the only ETH price source on Anvil.
  const ethUnit = useSimulateContract({
    address: helper,
    abi: uniswapHelperAbi,
    functionName: 'quoteETHToPhUSD',
    args: [WAD],
    account: zeroAddress,
    query: { enabled: available },
  });

  const activeQuote = t.native ? (buy ? ethBuy : ethSell) : buy ? stableBuy : stableSell;
  const quoteData = t.native
    ? asBig((activeQuote as typeof ethBuy).data?.result)
    : asBig((activeQuote as typeof stableBuy).data);
  const debouncing = inWei !== quoteIn;
  const quoteOut = !debouncing && quoteOn ? quoteData : undefined;
  const quoteLoading = debouncing || (quoteOn && (activeQuote.isLoading || activeQuote.isFetching) && quoteData === undefined);
  const quoteError = !debouncing && quoteOn && activeQuote.isError;

  const phPriceNum = poolPrice(pool);
  const ethUsd = toNum(asBig(ethUnit.data?.result), 18) * phPriceNum;

  // Pure and cheap: rebuilt every render from the live reads.
  const swap = swapQuote({
    tok: state.tok, dir: state.dir, inWei, quoteOut, quoteLoading, quoteError, slip: state.slip, pool,
    inBal: balances[inSym], allowance: allowances[inSym], ethUsd,
  });

  // ---- add quote ----------------------------------------------------------
  const addTokWei = parseAmount(state.aTok, 18);
  const addPhWei = parseAmount(state.aPh, 18);
  const previewDepositOn = !!susds && state.addSym === 'USDS' && state.aEdited === 'tok' && addTokWei > 0n;
  const { data: previewSharesRaw } = useReadContract({
    address: susds,
    abi: erc4626Abi,
    functionName: 'previewDeposit',
    args: [addTokWei],
    query: { enabled: previewDepositOn },
  });
  // Pure and cheap: rebuilt every render from the live reads.
  const add = addQuote({
    depositSym: state.addSym, edited: state.aEdited, tokWei: addTokWei, phWei: addPhWei,
    previewShares: previewDepositOn ? asBig(previewSharesRaw) : undefined,
    slip: state.slip, pool,
    tokBal: balances[state.addSym], phBal: balances.phUSD,
    tokAllowance: allowances[state.addSym], phAllowance: allowances.phUSD,
  });

  // ---- remove quote -------------------------------------------------------
  const burnWei = parseAmount(state.rLp, LP_DECIMALS);
  const sShare = pool && pool.totalSupply > 0n ? (burnWei * pool.rS) / pool.totalSupply : 0n;
  const previewRedeemOn = !!susds && state.out === 'USDS' && sShare > 0n;
  const { data: previewUsdsRaw } = useReadContract({
    address: susds,
    abi: erc4626Abi,
    functionName: 'previewRedeem',
    args: [sShare],
    query: { enabled: previewRedeemOn },
  });
  // Pure and cheap: rebuilt every render from the live reads.
  const remove = removeQuote({
    burnWei, lpBal, out: state.out, previewUsds: previewRedeemOn ? asBig(previewUsdsRaw) : undefined,
    slip: state.slip, pool, allowance: allowances[LP_SYMBOL],
  });
  const position = positionView(lpBal, pool);

  // ---- CTA ----------------------------------------------------------------
  const isSwap = state.mode === 'swap';
  const isRemove = state.mode === 'remove';
  const cta = !available
    ? UNAVAILABLE_CTA
    : isSwap ? swapCta(swap, connected) : isRemove ? removeCta(remove, connected) : addCta(add, connected);

  const review = state.review;
  const steps = review?.steps ?? [];
  const currentStep: ReviewStep | undefined = steps[state.stepIdx] ?? steps[steps.length - 1];

  // ---- refetch after every confirmed receipt ------------------------------
  const refetchAll = useCallback(() => {
    void refetchReserves();
    void refetchTotalSupply();
    void refetchSpx();
    dola.refetch(); usdc.refetch(); usde.refetch(); usdsT.refetch(); susdsT.refetch(); phusd.refetch(); lpT.refetch();
    void refetchEth();
    void stableBuy.refetch(); void stableSell.refetch(); void ethBuy.refetch(); void ethSell.refetch();
    refreshWalletBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetchReserves, refetchTotalSupply, refetchSpx, refetchEth, refreshWalletBalances,
    dola.refetch, usdc.refetch, usde.refetch, usdsT.refetch, susdsT.refetch, phusd.refetch, lpT.refetch]);

  // ---- input display strings ----------------------------------------------
  const outSym: MarketSymbol = buy ? 'phUSD' : t.sym;
  const payStr = state.pay;
  const recvStr = rawUnits(swap.outWei, metaOf(outSym).decimals, metaOf(outSym).decimals === 6 ? 6 : 8);
  const aTokStr = state.aEdited === 'tok' ? state.aTok : rawUnits(add.a, 18, 6);
  const aPhStr = state.aEdited === 'tok' ? rawUnits(add.b, 18, 2) : state.aPh;

  // ---- actions --------------------------------------------------------------
  const toSwap = useCallback(() => setState((p) => ({
    ...p,
    ...CLOSE_POPOVERS,
    mode: 'swap',
    lastLiq: p.mode === 'swap' ? p.lastLiq : p.mode,
  })), []);
  const toLiquidity = useCallback(() => setState((p) => ({
    ...p,
    ...CLOSE_POPOVERS,
    mode: p.mode === 'swap' ? p.lastLiq : p.mode,
  })), []);
  const setTopMode = useCallback((v: TopMode) => (v === 'swap' ? toSwap() : toLiquidity()), [toSwap, toLiquidity]);
  const setLiqAction = useCallback((a: LiquidityAction) => patch({ ...CLOSE_POPOVERS, mode: a, lastLiq: a }), [patch]);
  const setRemoveLp = useCallback((v: string) => patch({ rLp: clean(v) }), [patch]);
  const pickRemovePct = useCallback(
    (p: number) => patch({ rLp: lpBal > 0n ? formatUnits(removePctAmount(lpBal, p), LP_DECIMALS) : '' }),
    [patch, lpBal],
  );
  const setRemoveOut = useCallback((out: RemoveOutSymbol) => patch({ out }), [patch]);
  const toggleSettings = useCallback(() => setState((p) => ({ ...p, settingsOpen: !p.settingsOpen, pickerOpen: false, addPickerOpen: false })), []);
  const setSlippage = useCallback((slip: number) => patch({ slip }), [patch]);
  const openPicker = useCallback(() => patch({ pickerOpen: true, settingsOpen: false }), [patch]);
  const closePicker = useCallback(() => patch({ pickerOpen: false }), [patch]);
  const selectToken = useCallback((tok: SwapTokenSymbol) => patch({ tok, pickerOpen: false }), [patch]);
  const setPay = useCallback((v: string) => patch({ pay: clean(v) }), [patch]);

  // MAX on native ETH leaves ETH_GAS_RESERVE behind for gas.
  const payMaxBal = buy
    ? t.native
      ? ethBal !== undefined ? (ethBal > ETH_GAS_RESERVE_WEI ? ethBal - ETH_GAS_RESERVE_WEI : 0n) : undefined
      : balances[t.sym]
    : balances.phUSD;
  const payMax = useCallback(() => {
    if (payMaxBal === undefined) return;
    patch({ pay: payMaxBal > 0n ? formatUnits(payMaxBal, inDec) : '0' });
  }, [patch, payMaxBal, inDec]);

  const flip = useCallback(() => {
    patch({ dir: state.dir === 'buy' ? 'sell' : 'buy', pay: recvStr });
  }, [patch, state.dir, recvStr]);

  const toggleAddPicker = useCallback(() => setState((p) => ({ ...p, addPickerOpen: !p.addPickerOpen, settingsOpen: false })), []);
  const selectAddToken = useCallback((addSym: AddTokenSymbol) => patch({ addSym, addPickerOpen: false }), [patch]);
  const setAddTok = useCallback((v: string) => patch({ aTok: clean(v), aEdited: 'tok' }), [patch]);
  const setAddPh = useCallback((v: string) => patch({ aPh: clean(v), aEdited: 'ph' }), [patch]);
  const addTokBal = balances[state.addSym];
  const phBal = balances.phUSD;
  const addTokMax = useCallback(() => {
    if (addTokBal !== undefined) patch({ aTok: formatUnits(addTokBal, 18), aEdited: 'tok' });
  }, [patch, addTokBal]);
  const addPhMax = useCallback(() => {
    if (phBal !== undefined) patch({ aPh: formatUnits(phBal, 18), aEdited: 'ph' });
  }, [patch, phBal]);

  /** Steps are derived here, from live allowances against the parsed bigint amounts. */
  const startReview = useCallback(() => {
    if (!cta.enabled || !available) return;
    const mode = state.mode;
    let next: Review;
    if (mode === 'swap') {
      const q = swap;
      const action: ActionPlan = q.token.native
        ? { method: q.method as 'swapETHToPhUSD' | 'swapPhUSDToETH', amountIn: q.inWei, min: q.minOutWei }
        : { method: q.method as 'swapToPhUSD' | 'swapFromPhUSD', token: q.token.sym, amountIn: q.inWei, min: q.minOutWei };
      const inD = metaOf(q.inSym);
      const outD = metaOf(q.outSym);
      next = {
        mode,
        steps: swapSteps(q),
        action,
        legs: [
          { caption: 'You pay', sym: q.inSym, amount: fmtUnits(q.inWei, inD.decimals, inD.dp) },
          { caption: 'You receive (estimated)', sym: q.outSym, amount: fmtUnits(q.outWei, outD.decimals, outD.dp) },
        ],
        stats: swapModalStats(q),
        successText: `Swapped ${fmtUnits(q.inWei, inD.decimals, inD.dp)} ${q.inSym} for ${fmtUnits(q.outWei, outD.decimals, outD.dp)} ${q.outSym}`,
      };
    } else if (mode === 'add') {
      const q = add;
      const dpA = dpOf(q.depositSym);
      next = {
        mode,
        steps: addSteps(q),
        action: { method: q.method as 'addLiquiditySUSDS' | 'addLiquidityUSDS', a: q.a, b: q.b, aMin: q.aMin, bMin: q.bMin },
        legs: [
          { caption: 'Deposit (up to)', sym: q.depositSym, amount: fmtUnits(q.a, 18, dpA) },
          { caption: 'Deposit (up to)', sym: 'phUSD', amount: fmtUnits(q.b, 18, 2) },
        ],
        stats: addModalStats(q),
        successText: `Supplied liquidity · ≈ ${fmtUnits(q.lp, LP_DECIMALS, LP_DP)} ${LP_SYMBOL} received`,
      };
    } else {
      const q = remove;
      next = {
        mode,
        steps: removeSteps(q),
        action: { method: q.method as 'removeLiquiditySUSDS' | 'removeLiquidityUSDS', liquidity: q.burn, outMin: q.outMin, phMin: q.phMin },
        legs: [
          { caption: 'You receive (estimated)', sym: q.outSym, amount: fmtUnits(q.outAmt, 18, q.outDp) },
          { caption: 'You receive (estimated)', sym: 'phUSD', amount: fmtUnits(q.phAmt, 18, 2) },
        ],
        stats: removeModalStats(q),
        successText: `Burned ${fmtUnits(q.burn, LP_DECIMALS, LP_DP)} ${LP_SYMBOL} · received ≈ ${fmtUnits(q.outAmt, 18, q.outDp)} ${q.outSym} + ${fmtUnits(q.phAmt, 18, 2)} phUSD`,
      };
    }
    patch({
      review: next,
      stepIdx: 0,
      success: false,
      pending: false,
      txHash: undefined,
      lastHash: undefined,
      settingsOpen: false,
      addPickerOpen: false,
    });
  }, [patch, cta.enabled, available, state.mode, swap, add, remove]);

  /** Send the frozen helper call. The deadline is computed now, at submit time. */
  const sendAction = useCallback(async (plan: ActionPlan, h: Address, recipient: Address): Promise<Hash> => {
    const deadline = deadlineFromNow();
    switch (plan.method) {
      case 'swapToPhUSD':
      case 'swapFromPhUSD': {
        const token = tokenAddresses[plan.token];
        if (!token) throw new Error(`${plan.token} address unavailable on this network`);
        return writeContractAsync({
          address: h, abi: uniswapHelperAbi, functionName: plan.method,
          args: [token, plan.amountIn, plan.min, recipient, deadline],
        });
      }
      case 'swapETHToPhUSD':
        return writeContractAsync({
          address: h, abi: uniswapHelperAbi, functionName: 'swapETHToPhUSD',
          args: [plan.min, recipient, deadline], value: plan.amountIn,
        });
      case 'swapPhUSDToETH':
        return writeContractAsync({
          address: h, abi: uniswapHelperAbi, functionName: 'swapPhUSDToETH',
          args: [plan.amountIn, plan.min, recipient, deadline],
        });
      case 'addLiquiditySUSDS':
      case 'addLiquidityUSDS':
        return writeContractAsync({
          address: h, abi: uniswapHelperAbi, functionName: plan.method,
          args: [plan.a, plan.b, plan.aMin, plan.bMin, recipient, deadline],
        });
      case 'removeLiquiditySUSDS':
      case 'removeLiquidityUSDS':
        return writeContractAsync({
          address: h, abi: uniswapHelperAbi, functionName: plan.method,
          args: [plan.liquidity, plan.outMin, plan.phMin, recipient, deadline],
        });
    }
  }, [writeContractAsync, tokenAddresses]);

  const reportError = useCallback((error: unknown, title: string) => {
    const d = decodeContractError(error);
    if (d.userRejected) {
      addToast({ type: 'info', title: 'Transaction Cancelled', description: 'You cancelled the transaction in your wallet.', duration: 6000 });
    } else {
      log.error(`${title}:`, error);
      addToast({ type: 'error', title, description: d.message, duration: 16000 });
    }
  }, [addToast]);

  const advanceStep = useCallback(async () => {
    if (state.pending || !review || state.success) return;
    const step = review.steps[state.stepIdx];
    if (!step) return;
    if (!helper || !available) {
      addToast({ type: 'info', title: 'Not Available', description: 'The Uniswap market is not deployed on this network.' });
      return;
    }
    if (!wallet) {
      addToast({ type: 'error', title: 'Wallet Not Connected', description: 'Please connect your wallet using the button in the header.' });
      return;
    }
    patch({ pending: true });
    addToast({ type: 'info', title: 'Confirm in Wallet', description: `Please confirm ${step.label.toLowerCase()} in your wallet.`, duration: 30000 });
    try {
      let hash: Hash;
      if (step.kind === 'approve') {
        const sym = step.sym as ApprovableSymbol;
        const token = tokenAddresses[sym];
        if (!token) throw new Error(`${sym} address unavailable on this network`);
        const amount = state.exactApprove && step.amount !== undefined ? step.amount : maxUint256;
        hash = await approve(token, helper, amount);
      } else {
        hash = await sendAction(review.action, helper, wallet);
      }
      const url = explorerTxUrl(chainId, hash);
      addToast({
        type: 'info',
        title: 'Transaction Submitted',
        description: 'Waiting for blockchain confirmation...',
        duration: 30000,
        ...(url ? { action: { label: 'View on Etherscan', onClick: () => window.open(url, '_blank') } } : {}),
      });
      patch({ txHash: hash });
    } catch (error) {
      reportError(error, step.kind === 'approve' ? 'Approval Failed' : 'Transaction Failed');
      patch({ pending: false });
    }
  }, [state.pending, state.success, state.stepIdx, state.exactApprove, review, helper, available, wallet, chainId,
    tokenAddresses, patch, addToast, approve, sendAction, reportError]);

  const receipt = useWaitForTransactionReceipt({ hash: state.txHash, query: { enabled: !!state.txHash } });
  useEffect(() => {
    if (!state.txHash || !review) return;
    const step = review.steps[state.stepIdx];
    if (receipt.isSuccess && receipt.data) {
      if (receipt.data.status === 'reverted') {
        addToast({ type: 'error', title: 'Transaction Reverted', description: 'The transaction was mined but reverted.', duration: 16000 });
        patch({ pending: false, txHash: undefined });
        return;
      }
      refetchAll();
      const last = state.stepIdx >= review.steps.length - 1;
      if (last) {
        addToast({ type: 'success', title: 'Transaction Confirmed', description: review.successText, duration: 16000 });
        patch({ pending: false, success: true, txHash: undefined, lastHash: state.txHash });
      } else {
        addToast({ type: 'success', title: 'Approval Confirmed', description: `${step?.sym ?? ''} approved for UniswapHelper.`, duration: 8000 });
        patch({ pending: false, stepIdx: state.stepIdx + 1, txHash: undefined });
      }
    } else if (receipt.isError) {
      reportError(receipt.error, 'Transaction Failed');
      patch({ pending: false, txHash: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt.isSuccess, receipt.isError, receipt.data, state.txHash]);

  const cancel = useCallback(() => {
    patch({ review: null, stepIdx: 0, pending: false, success: false, txHash: undefined });
  }, [patch]);

  const done = useCallback(() => {
    patch({ review: null, stepIdx: 0, pending: false, success: false, txHash: undefined, pay: '', aTok: '', aPh: '', rLp: '' });
  }, [patch]);

  const toggleExactApprove = useCallback(() => setState((p) => ({ ...p, exactApprove: !p.exactApprove })), []);

  // ---- display strings -----------------------------------------------------
  const isAddModal = review?.mode === 'add';
  const isRemoveModal = review?.mode === 'remove';
  const removeLegs: [ReviewLeg, ReviewLeg] = [
    { caption: 'You receive (estimated)', sym: remove.outSym, amount: fmtUnits(remove.outAmt, 18, remove.outDp) },
    { caption: 'You receive (estimated)', sym: 'phUSD', amount: fmtUnits(remove.phAmt, 18, 2) },
  ];
  const exactSym = currentStep?.kind === 'approve' ? currentStep.sym : undefined;
  const exactLabel = exactSym && currentStep?.amount !== undefined
    ? `Approve exact amount only (${fmtUnits(currentStep.amount, decimalsOf(exactSym), exactSym === LP_SYMBOL ? LP_DP : dpOf(exactSym))} ${exactSym}) instead of unlimited`
    : '';
  const modalTitle = state.success
    ? (isRemoveModal ? 'Liquidity removed' : isAddModal ? 'Liquidity added' : 'Swap complete')
    : (isRemoveModal ? 'Review removal' : isAddModal ? 'Review supply' : 'Review swap');
  const modalActionLabel = state.pending
    ? (state.txHash ? 'Confirming…' : 'Confirm in wallet…')
    : currentStep?.kind === 'approve'
      ? `Approve ${currentStep.sym}`
      : isRemoveModal ? 'Confirm removal' : isAddModal ? 'Confirm supply' : 'Confirm swap';
  const pctOptions: PctOptionView[] = REMOVE_PCTS.map((p) => ({
    p,
    label: removePctLabel(p),
    selected: removePctSelected(lpBal, burnWei, p),
  }));
  const outOptions: OutOptionView[] = REMOVE_OUT_TOKENS.map((sym) => ({ sym, selected: sym === remove.outSym }));
  const tokenRows: TokenRowView[] = ORDER.map((sym) => ({
    sym,
    name: TOKENS[sym].name,
    hint: routeHint(sym),
    balText: balText(sym, balances[sym]),
    selected: sym === state.tok,
  }));
  const addTokUsd = add.a > 0n ? usd(add.aUsd) : '';
  const addPhUsd = add.b > 0n ? usd(add.bUsd) : '';

  return {
    // header / ticker / links
    tickerPair: pool
      ? `phUSD/sUSDS pool · ${short(toNum(pool.rPh, 18))} phUSD / ${short(toNum(pool.rS, 18))} sUSDS`
      : 'phUSD/sUSDS pool',
    tickerPrice: pool && phPriceNum > 0 ? `$${fmt(phPriceNum, 6)}` : '—',
    priceAtOrAboveDollar: phPriceNum >= 1,
    uniswapUrl: UNISWAP_TRADE_URL,
    /** Per-tx explorer link for the completed review; '' on Anvil (hidden). */
    etherscanUrl: explorerTxUrl(chainId, state.lastHash),
    available,
    connected,

    // settings
    slippageOptions: SLIPPAGE_OPTIONS,
    deadlineMinutes: DEADLINE_MINUTES,

    // shared state
    mode: state.mode,
    topMode: (isSwap ? 'swap' : 'liquidity') as TopMode,
    slip: state.slip,
    settingsOpen: state.settingsOpen,

    // swap (exact-in only: the receive side is read-only)
    dir: state.dir,
    token: state.tok,
    swap,
    payStr,
    recvStr,
    payBalText: balText(swap.inSym, balances[swap.inSym]),
    recvBalText: balText(swap.outSym, balances[swap.outSym]),
    payUsd: swap.valid ? usd(swap.inUsd) : '',
    recvUsd: swap.valid ? usd(swap.outUsd) : '',
    routeSummary: routeSummary(swap.syms),
    pickerOpen: state.pickerOpen,
    tokenRows,

    // add liquidity
    addSym: state.addSym,
    add,
    addTokens: ADD_TOKENS,
    aTokStr,
    aPhStr,
    addTokBalText: balText(state.addSym, balances[state.addSym]),
    phBalText: balText('phUSD', balances.phUSD),
    aTokUsd: addTokUsd,
    aPhUsd: addPhUsd,
    addPickerOpen: state.addPickerOpen,

    // LP position (Liquidity mode)
    lpSymbol: LP_SYMBOL,
    hasPosition: lpBal > 0n,
    positionLp: fmtUnits(position.lp, LP_DECIMALS, LP_DP),
    positionShare: pct(position.share),
    positionS: fmtUnits(position.s, 18, 4),
    positionPh: fmtUnits(position.ph, 18, 2),
    positionValue: usd(position.value),

    // remove liquidity
    remove,
    rLpStr: state.rLp,
    lpBalText: fmtUnits(lpBal, LP_DECIMALS, LP_DP),
    pctOptions,
    outOptions,
    receiveRows: removeLegs.map(({ sym, amount }): ReceiveRowView => ({ sym, amount })),
    removeNote: remove.usds ? 'sUSDS redeemed to USDS in the same transaction' : 'Paid out at the pool ratio',
    removeUsd: remove.valid ? usd(remove.value) : '',

    // CTA
    cta,

    // review modal
    modal: review?.mode ?? null,
    steps,
    stepIdx: state.stepIdx,
    currentStep,
    pending: state.pending,
    success: state.success,
    exactApprove: state.exactApprove,
    exactLabel,
    legs: review?.legs ?? removeLegs,
    modalTitle,
    modalActionLabel,
    successText: review?.successText ?? '',
    modalStats: review?.stats ?? [],

    // actions
    setTopMode,
    toSwap,
    toLiquidity,
    setLiqAction,
    setRemoveLp,
    pickRemovePct,
    setRemoveOut,
    toggleSettings,
    setSlippage,
    openPicker,
    closePicker,
    selectToken,
    setPay,
    payMax,
    flip,
    toggleAddPicker,
    selectAddToken,
    setAddTok,
    setAddPh,
    addTokMax,
    addPhMax,
    startReview,
    advanceStep,
    cancel,
    done,
    toggleExactApprove,
  };
}

export type UniMarket = ReturnType<typeof useUniMarket>;
/** Helper method names, re-exported for tests. */
export type { HelperMethod };
