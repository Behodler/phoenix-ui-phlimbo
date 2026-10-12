/**
 * useUniMarketMock — the single seam behind the mocked "Market (uni)" tab
 * (stories 084, 085).
 *
 * Owns all tab state (mode, direction, token, inputs, slippage, popovers,
 * review modal, step machine, approvals, LP position) and exposes derived
 * quotes plus actions. The components under src/components/vault/marketUni/ hold no maths
 * and no mock constants; they render whatever this hook returns.
 *
 * NOTHING HERE TOUCHES A CHAIN. Approve / swap / supply / remove steps
 * resolve on a timer, and the LP balance is plain React state. The live-wiring story replaces this hook (and
 * src/data/uniMarketMockData.ts) with real reads and writes behind the same
 * return shape.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ADD_TOKENS,
  DEADLINE_MINUTES,
  DEFAULT_ADD_TOKEN,
  DEFAULT_REMOVE_OUT,
  DEFAULT_SLIPPAGE,
  ETHERSCAN_URL,
  ETH_GAS_RESERVE,
  INITIAL_APPROVALS,
  LP_BAL,
  LP_SYMBOL,
  MOCK_STEP_MS,
  ORDER,
  PH_BAL,
  POOL,
  REMOVE_OUT_TOKENS,
  REMOVE_PCTS,
  SLIPPAGE_OPTIONS,
  TOKENS,
  UNISWAP_TRADE_URL,
  type AddTokenSymbol,
  type MarketSymbol,
  type RemoveOutSymbol,
  type SwapTokenSymbol,
} from '../data/uniMarketMockData';
import {
  addCta,
  addModalStats,
  addQuote,
  addSteps,
  balText,
  clean,
  dpOf,
  fmt,
  pct,
  phPrice,
  positionView,
  raw,
  removeCta,
  removeModalStats,
  removePctInput,
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
  usd,
  type AddEditedSide,
  type Direction,
  type EditedSide,
  type ReviewStep,
} from '../lib/uniV2MockMath';

export type MarketMode = 'swap' | 'add' | 'remove';
/** The two liquidity sub-modes behind the Add / Remove toggle. */
export type LiquidityAction = 'add' | 'remove';
/** The top Swap / Liquidity control. */
export type TopMode = 'swap' | 'liquidity';

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

interface UniMarketState {
  mode: MarketMode;
  dir: Direction;
  tok: SwapTokenSymbol;
  pay: string;
  recv: string;
  edited: EditedSide;
  addSym: AddTokenSymbol;
  aTok: string;
  aPh: string;
  aEdited: AddEditedSide;
  slip: number;
  settingsOpen: boolean;
  pickerOpen: boolean;
  addPickerOpen: boolean;
  modal: MarketMode | null;
  steps: ReviewStep[] | null;
  stepIdx: number;
  pending: boolean;
  success: boolean;
  exactApprove: boolean;
  approvals: Record<string, boolean>;
  /** UNI-V2 held (mock; moves when an add or removal completes). */
  lp: number;
  /** Raw burn input on the Remove panel. */
  rLp: string;
  out: RemoveOutSymbol;
  /** Liquidity sub-mode to return to from Swap. */
  lastLiq: LiquidityAction;
  /** LP balance frozen when the review modal opened (removal stats read it). */
  modalLp: number;
  /** LP change applied when the frozen review steps complete. */
  modalLpDelta: number;
}

const INITIAL_STATE: UniMarketState = {
  mode: 'swap',
  dir: 'buy',
  tok: 'USDC',
  pay: '',
  recv: '',
  edited: 'pay',
  addSym: DEFAULT_ADD_TOKEN,
  aTok: '',
  aPh: '',
  aEdited: 'tok',
  slip: DEFAULT_SLIPPAGE,
  settingsOpen: false,
  pickerOpen: false,
  addPickerOpen: false,
  modal: null,
  steps: null,
  stepIdx: 0,
  pending: false,
  success: false,
  exactApprove: false,
  approvals: { ...INITIAL_APPROVALS },
  lp: LP_BAL,
  rLp: '',
  out: DEFAULT_REMOVE_OUT,
  lastLiq: 'add',
  modalLp: LP_BAL,
  modalLpDelta: 0,
};

const CLOSE_POPOVERS = { pickerOpen: false, settingsOpen: false, addPickerOpen: false } as const;

export function useUniMarketMock() {
  const [state, setState] = useState<UniMarketState>(INITIAL_STATE);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // Mirrors the mockup's componentWillUnmount: never fire a step after unmount.
  useEffect(() => clearTimer, [clearTimer]);

  const patch = useCallback((p: Partial<UniMarketState>) => {
    setState((prev) => ({ ...prev, ...p }));
  }, []);

  const swap = useMemo(
    () => swapQuote({ tok: state.tok, dir: state.dir, edited: state.edited, pay: state.pay, recv: state.recv, slip: state.slip, approvals: state.approvals }),
    [state.tok, state.dir, state.edited, state.pay, state.recv, state.slip, state.approvals],
  );
  const add = useMemo(
    () => addQuote({ depositSym: state.addSym, aTok: state.aTok, aPh: state.aPh, edited: state.aEdited, slip: state.slip, approvals: state.approvals }),
    [state.addSym, state.aTok, state.aPh, state.aEdited, state.slip, state.approvals],
  );

  // While a removal is under review, quote against the LP balance frozen at
  // open, so the modal's "% of position" / "Remaining position" rows do not
  // jump when the completed removal decrements the balance.
  const quoteLp = state.modal === 'remove' ? state.modalLp : state.lp;
  const remove = useMemo(
    () => removeQuote({ rLp: state.rLp, lp: quoteLp, out: state.out, slip: state.slip, approvals: state.approvals }),
    [state.rLp, quoteLp, state.out, state.slip, state.approvals],
  );
  const position = positionView(state.lp);

  const isSwap = state.mode === 'swap';
  const isRemove = state.mode === 'remove';
  const cta = isSwap ? swapCta(swap) : isRemove ? removeCta(remove) : addCta(add);
  const steps = state.steps ?? [];
  const currentStep: ReviewStep | undefined = steps[state.stepIdx] ?? steps[steps.length - 1];

  // Amount the "approve exact amount" checkbox refers to.
  let exactAmount = 0;
  if (currentStep?.kind === 'approve') {
    if (state.modal === 'swap') exactAmount = swap.inA;
    else if (state.modal === 'remove') exactAmount = remove.burn;
    else exactAmount = currentStep.sym === 'phUSD' ? add.b : add.a;
  }

  // ---- input display strings (the non-edited side shows the computed value)
  const payStr = swap.exactIn ? state.pay : raw(swap.inA, dpOf(swap.inSym));
  const recvStr = swap.exactIn ? raw(swap.outA, dpOf(swap.outSym)) : state.recv;
  const aTokStr = state.aEdited === 'tok' ? state.aTok : raw(add.a, 6);
  const aPhStr = state.aEdited === 'tok' ? raw(add.b, 2) : state.aPh;

  // ---- actions
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
  const pickRemovePct = useCallback((p: number) => patch({ rLp: removePctInput(state.lp, p) }), [patch, state.lp]);
  const setRemoveOut = useCallback((out: RemoveOutSymbol) => patch({ out }), [patch]);
  const toggleSettings = useCallback(() => setState((p) => ({ ...p, settingsOpen: !p.settingsOpen, pickerOpen: false, addPickerOpen: false })), []);
  const setSlippage = useCallback((slip: number) => patch({ slip }), [patch]);
  const openPicker = useCallback(() => patch({ pickerOpen: true, settingsOpen: false }), [patch]);
  const closePicker = useCallback(() => patch({ pickerOpen: false }), [patch]);
  const selectToken = useCallback((tok: SwapTokenSymbol) => patch({ tok, pickerOpen: false }), [patch]);
  const setPay = useCallback((v: string) => patch({ pay: clean(v), edited: 'pay' }), [patch]);
  const setRecv = useCallback((v: string) => patch({ recv: clean(v), edited: 'recv' }), [patch]);

  const payMax = useCallback(() => {
    const t = TOKENS[state.tok];
    const bal = state.dir === 'buy' ? (t.native ? Math.max(0, t.bal - ETH_GAS_RESERVE) : t.bal) : PH_BAL;
    patch({ pay: String(bal), edited: 'pay' });
  }, [patch, state.tok, state.dir]);

  const flip = useCallback(() => {
    const carry = swap.exactIn ? raw(swap.outA, dpOf(swap.outSym)) : state.recv;
    patch({ dir: state.dir === 'buy' ? 'sell' : 'buy', pay: carry, recv: '', edited: 'pay' });
  }, [patch, swap, state.dir, state.recv]);

  const toggleAddPicker = useCallback(() => setState((p) => ({ ...p, addPickerOpen: !p.addPickerOpen, settingsOpen: false })), []);
  const selectAddToken = useCallback((addSym: AddTokenSymbol) => patch({ addSym, addPickerOpen: false }), [patch]);
  const setAddTok = useCallback((v: string) => patch({ aTok: clean(v), aEdited: 'tok' }), [patch]);
  const setAddPh = useCallback((v: string) => patch({ aPh: clean(v), aEdited: 'ph' }), [patch]);
  const addTokMax = useCallback(() => patch({ aTok: String(TOKENS[state.addSym].bal), aEdited: 'tok' }), [patch, state.addSym]);
  const addPhMax = useCallback(() => patch({ aPh: String(PH_BAL), aEdited: 'ph' }), [patch]);

  const startReview = useCallback(() => {
    if (!cta.enabled) return;
    const mode = state.mode;
    patch({
      modal: mode,
      steps: mode === 'swap' ? swapSteps(swap) : mode === 'remove' ? removeSteps(remove) : addSteps(add),
      modalLp: state.lp,
      modalLpDelta: mode === 'add' ? add.lp : mode === 'remove' ? -remove.burn : 0,
      stepIdx: 0,
      success: false,
      pending: false,
      settingsOpen: false,
      addPickerOpen: false,
    });
  }, [patch, cta.enabled, state.mode, state.lp, swap, add, remove]);

  const advanceStep = useCallback(() => {
    if (state.pending || !state.steps || state.success) return;
    const frozen = state.steps;
    patch({ pending: true });
    clearTimer();
    timer.current = setTimeout(() => {
      timer.current = null;
      setState((prev) => {
        const step = frozen[prev.stepIdx];
        const approvals = step?.kind === 'approve' && step.approvalKey
          ? { ...prev.approvals, [step.approvalKey]: true }
          : prev.approvals;
        if (prev.stepIdx >= frozen.length - 1) {
          // The frozen delta was quoted when the modal opened; floor at 0.
          const lp = Math.max(0, prev.lp + prev.modalLpDelta);
          return { ...prev, pending: false, success: true, approvals, lp, modalLpDelta: 0 };
        }
        return { ...prev, pending: false, stepIdx: prev.stepIdx + 1, approvals };
      });
    }, MOCK_STEP_MS);
  }, [patch, clearTimer, state.pending, state.steps, state.success]);

  const cancel = useCallback(() => {
    clearTimer();
    patch({ modal: null, steps: null, stepIdx: 0, pending: false, success: false, modalLpDelta: 0 });
  }, [patch, clearTimer]);

  const done = useCallback(() => {
    clearTimer();
    patch({ modal: null, steps: null, stepIdx: 0, pending: false, success: false, pay: '', recv: '', aTok: '', aPh: '', rLp: '' });
  }, [patch, clearTimer]);

  const toggleExactApprove = useCallback(() => setState((p) => ({ ...p, exactApprove: !p.exactApprove })), []);

  // ---- display strings (formatting lives here so components stay dumb)
  const price = phPrice(POOL.rS, POOL.rPh);
  const isAddModal = state.modal === 'add';
  const isRemoveModal = state.modal === 'remove';
  const removeLegs: [ReviewLeg, ReviewLeg] = [
    { caption: 'You receive (estimated)', sym: remove.outSym, amount: fmt(remove.outAmt, remove.outDp) },
    { caption: 'You receive (estimated)', sym: 'phUSD', amount: fmt(remove.phAmt, 2) },
  ];
  const legs: [ReviewLeg, ReviewLeg] = isRemoveModal
    ? removeLegs
    : isAddModal
    ? [
        { caption: 'Deposit', sym: add.depositSym, amount: fmt(add.a, dpOf(add.depositSym)) },
        { caption: 'Deposit', sym: 'phUSD', amount: fmt(add.b, 2) },
      ]
    : [
        { caption: 'You pay', sym: swap.inSym, amount: fmt(swap.inA, dpOf(swap.inSym)) },
        { caption: swap.exactIn ? 'You receive (estimated)' : 'You receive (exact)', sym: swap.outSym, amount: fmt(swap.outA, dpOf(swap.outSym)) },
      ];
  const exactSym = currentStep?.kind === 'approve' ? currentStep.sym : undefined;
  const exactDp = exactSym === LP_SYMBOL ? 4 : exactSym ? dpOf(exactSym) : 0;
  const exactLabel = exactSym
    ? `Approve exact amount only (${fmt(exactAmount, exactDp)} ${exactSym}) instead of unlimited`
    : '';
  const modalTitle = state.success
    ? (isRemoveModal ? 'Liquidity removed' : isAddModal ? 'Liquidity added' : 'Swap complete')
    : (isRemoveModal ? 'Review removal' : isAddModal ? 'Review supply' : 'Review swap');
  const modalActionLabel = state.pending
    ? 'Confirm in wallet…'
    : currentStep?.kind === 'approve'
      ? `Approve ${currentStep.sym}`
      : isRemoveModal ? 'Confirm removal' : isAddModal ? 'Confirm supply' : 'Confirm swap';
  const successText = isRemoveModal
    ? `Burned ${fmt(remove.burn, 4)} ${LP_SYMBOL} · received ${fmt(remove.outAmt, remove.outDp)} ${remove.outSym} + ${fmt(remove.phAmt, 2)} phUSD`
    : isAddModal
    ? `Supplied liquidity · ${fmt(add.lp, 4)} ${LP_SYMBOL} received`
    : `Swapped ${fmt(swap.inA, dpOf(swap.inSym))} ${swap.inSym} for ${fmt(swap.outA, dpOf(swap.outSym))} ${swap.outSym}`;
  const pctOptions: PctOptionView[] = REMOVE_PCTS.map((p) => ({
    p,
    label: removePctLabel(p),
    selected: removePctSelected(state.lp, remove.burn, p),
  }));
  const outOptions: OutOptionView[] = REMOVE_OUT_TOKENS.map((sym) => ({ sym, selected: sym === remove.outSym }));
  const modalStats = state.modal === 'remove'
    ? removeModalStats(remove)
    : state.modal === 'add' ? addModalStats(add) : swapModalStats(swap);
  const tokenRows: TokenRowView[] = ORDER.map((sym) => ({
    sym,
    name: TOKENS[sym].name,
    hint: routeHint(sym),
    balText: balText(sym),
    selected: sym === state.tok,
  }));

  return {
    // header / ticker / links
    tickerPair: `phUSD/sUSDS pool · ${short(POOL.rPh)} phUSD / ${short(POOL.rS)} sUSDS`,
    tickerPrice: `$${fmt(price, 6)}`,
    priceAtOrAboveDollar: price >= 1,
    uniswapUrl: UNISWAP_TRADE_URL,
    etherscanUrl: ETHERSCAN_URL,

    // settings
    slippageOptions: SLIPPAGE_OPTIONS,
    deadlineMinutes: DEADLINE_MINUTES,

    // shared state
    mode: state.mode,
    topMode: (isSwap ? 'swap' : 'liquidity') as TopMode,
    slip: state.slip,
    settingsOpen: state.settingsOpen,

    // swap
    dir: state.dir,
    token: state.tok,
    swap,
    payStr,
    recvStr,
    payBalText: balText(swap.inSym),
    recvBalText: balText(swap.outSym),
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
    addTokBalText: balText(state.addSym),
    phBalText: balText('phUSD'),
    aTokUsd: add.a > 0 ? usd(add.aUsd) : '',
    aPhUsd: add.b > 0 ? usd(add.bUsd) : '',
    addPickerOpen: state.addPickerOpen,

    // LP position (Liquidity mode)
    lpSymbol: LP_SYMBOL,
    hasPosition: state.lp > 1e-9,
    positionLp: fmt(position.lp, 4),
    positionShare: pct(position.share),
    positionS: fmt(position.s, 4),
    positionPh: fmt(position.ph, 2),
    positionValue: usd(position.value),

    // remove liquidity
    remove,
    rLpStr: state.rLp,
    lpBalText: fmt(state.lp, 4),
    pctOptions,
    outOptions,
    receiveRows: removeLegs.map(({ sym, amount }): ReceiveRowView => ({ sym, amount })),
    removeNote: remove.usds ? 'sUSDS redeemed to USDS in the same transaction' : 'Paid out at the pool ratio',
    removeUsd: remove.valid ? usd(remove.value) : '',

    // CTA
    cta,

    // review modal
    modal: state.modal,
    steps,
    stepIdx: state.stepIdx,
    currentStep,
    pending: state.pending,
    success: state.success,
    exactApprove: state.exactApprove,
    exactLabel,
    legs,
    modalTitle,
    modalActionLabel,
    successText,
    modalStats,

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
    setRecv,
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

export type UniMarketMock = ReturnType<typeof useUniMarketMock>;
