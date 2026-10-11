/**
 * useUniMarketMock — the single seam behind the mocked "Market (uni)" tab
 * (story 084).
 *
 * Owns all tab state (mode, direction, token, inputs, slippage, popovers,
 * review modal, step machine, approvals) and exposes derived quotes plus
 * actions. The components under src/components/vault/marketUni/ hold no maths
 * and no mock constants; they render whatever this hook returns.
 *
 * NOTHING HERE TOUCHES A CHAIN. Approve / swap / supply steps resolve on a
 * timer. The live-wiring story replaces this hook (and
 * src/data/uniMarketMockData.ts) with real reads and writes behind the same
 * return shape.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ADD_TOKENS,
  DEADLINE_MINUTES,
  DEFAULT_ADD_TOKEN,
  DEFAULT_SLIPPAGE,
  ETHERSCAN_URL,
  ETH_GAS_RESERVE,
  INITIAL_APPROVALS,
  MOCK_STEP_MS,
  ORDER,
  PH_BAL,
  POOL,
  SLIPPAGE_OPTIONS,
  TOKENS,
  UNISWAP_TRADE_URL,
  type AddTokenSymbol,
  type MarketSymbol,
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
  phPrice,
  raw,
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

export type MarketMode = 'swap' | 'add';

export interface ReviewLeg {
  caption: string;
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
};

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

  const isSwap = state.mode === 'swap';
  const cta = isSwap ? swapCta(swap) : addCta(add);
  const steps = state.steps ?? [];
  const currentStep: ReviewStep | undefined = steps[state.stepIdx] ?? steps[steps.length - 1];

  // Amount the "approve exact amount" checkbox refers to.
  let exactAmount = 0;
  if (currentStep?.kind === 'approve') {
    if (isSwap) exactAmount = swap.inA;
    else exactAmount = currentStep.sym === 'phUSD' ? add.b : add.a;
  }

  // ---- input display strings (the non-edited side shows the computed value)
  const payStr = swap.exactIn ? state.pay : raw(swap.inA, dpOf(swap.inSym));
  const recvStr = swap.exactIn ? raw(swap.outA, dpOf(swap.outSym)) : state.recv;
  const aTokStr = state.aEdited === 'tok' ? state.aTok : raw(add.a, 6);
  const aPhStr = state.aEdited === 'tok' ? raw(add.b, 2) : state.aPh;

  // ---- actions
  const setMode = useCallback((mode: MarketMode) => patch({ mode, pickerOpen: false, settingsOpen: false, addPickerOpen: false }), [patch]);
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
    patch({
      modal: state.mode,
      steps: state.mode === 'swap' ? swapSteps(swap) : addSteps(add),
      stepIdx: 0,
      success: false,
      pending: false,
      settingsOpen: false,
      addPickerOpen: false,
    });
  }, [patch, cta.enabled, state.mode, swap, add]);

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
          return { ...prev, pending: false, success: true, approvals };
        }
        return { ...prev, pending: false, stepIdx: prev.stepIdx + 1, approvals };
      });
    }, MOCK_STEP_MS);
  }, [patch, clearTimer, state.pending, state.steps, state.success]);

  const cancel = useCallback(() => {
    clearTimer();
    patch({ modal: null, steps: null, stepIdx: 0, pending: false, success: false });
  }, [patch, clearTimer]);

  const done = useCallback(() => {
    clearTimer();
    patch({ modal: null, steps: null, stepIdx: 0, pending: false, success: false, pay: '', recv: '', aTok: '', aPh: '' });
  }, [patch, clearTimer]);

  const toggleExactApprove = useCallback(() => setState((p) => ({ ...p, exactApprove: !p.exactApprove })), []);

  // ---- display strings (formatting lives here so components stay dumb)
  const price = phPrice(POOL.rS, POOL.rPh);
  const isAddModal = state.modal === 'add';
  const legs: [ReviewLeg, ReviewLeg] = isAddModal
    ? [
        { caption: 'Deposit', sym: add.depositSym, amount: fmt(add.a, dpOf(add.depositSym)) },
        { caption: 'Deposit', sym: 'phUSD', amount: fmt(add.b, 2) },
      ]
    : [
        { caption: 'You pay', sym: swap.inSym, amount: fmt(swap.inA, dpOf(swap.inSym)) },
        { caption: swap.exactIn ? 'You receive (estimated)' : 'You receive (exact)', sym: swap.outSym, amount: fmt(swap.outA, dpOf(swap.outSym)) },
      ];
  const exactSym = currentStep?.kind === 'approve' ? currentStep.sym : undefined;
  const exactLabel = exactSym
    ? `Approve exact amount only (${fmt(exactAmount, dpOf(exactSym))} ${exactSym}) instead of unlimited`
    : '';
  const modalTitle = state.success
    ? (isAddModal ? 'Liquidity added' : 'Swap complete')
    : (isAddModal ? 'Review supply' : 'Review swap');
  const modalActionLabel = state.pending
    ? 'Confirm in wallet…'
    : currentStep?.kind === 'approve'
      ? `Approve ${currentStep.sym}`
      : isAddModal ? 'Confirm supply' : 'Confirm swap';
  const successText = isAddModal
    ? `Supplied liquidity · ${fmt(add.lp, 4)} UNI-V2 received`
    : `Swapped ${fmt(swap.inA, dpOf(swap.inSym))} ${swap.inSym} for ${fmt(swap.outA, dpOf(swap.outSym))} ${swap.outSym}`;
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
    modalStats: state.modal === 'add' ? addModalStats(add) : swapModalStats(swap),

    // actions
    setMode,
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
