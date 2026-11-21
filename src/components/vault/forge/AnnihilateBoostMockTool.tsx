import { useCallback, useState } from 'react';
import AmountInput from '../../ui/AmountInput';
import ActionButton from '../../ui/ActionButton';
import ForgeTokenSelectorModal, { type ForgeTokenOption } from './ForgeTokenSelectorModal';
import { Glyph, PreviewCell, PreviewRow } from './AnnihilateTool';
import { ANTIMATTER_LAVENDER, STABLE_META } from './annihilateMeta';
import { AMOUNT_INPUT_PATTERN, floorTo, fmt2, toInputString } from './forgeFormat';
import {
  ANNIHILATE_STABLE_ORDER,
  type AnnihilateStableSymbol,
  type ForgeAnnihilateState,
} from '../../../hooks/useForgeAnnihilate';
import type { ForgeAnnihilateBoostState } from '../../../hooks/useForgeAnnihilateBoost';

// Boost accents are amber, as in the approved design. Inline rgba: Tailwind opacity modifiers on hex tokens emit no CSS.
const BOOST_AMBER = '#fbbf24';
const BOOST_TINT = { color: BOOST_AMBER, borderColor: 'rgba(245,158,11,.4)', background: 'rgba(245,158,11,.14)' };

function BoltIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={BOOST_AMBER}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0"
      aria-hidden="true"
    >
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  );
}

export interface AnnihilateBoostMockToolProps {
  /**
   * The row's own `useForgeAnnihilate` instance, so its pair and amount are
   * independent of the real row. Drives the boost-off path (approve the stable
   * to Antimatter, then `Antimatter.annihilate`).
   */
  state: ForgeAnnihilateState;
  /** `useForgeAnnihilateBoost(state)`: the AntimatterBooster reads and writes. */
  boost: ForgeAnnihilateBoostState;
}

/**
 * Body of the admin-only "Annihilate Antimatter (boost preview)" Forge row.
 * Presentational. With the boost off it is a complete plain annihilate row; with
 * it on it routes through `AntimatterBooster.boostedAnnihilate`. Eligibility,
 * percentage and the boosted quote are all live `AntimatterBooster` reads.
 */
export default function AnnihilateBoostMockTool({ state, boost }: AnnihilateBoostMockToolProps) {
  const {
    amount,
    setAmount,
    stable,
    setStable,
    walletAntimatter: antimatterBalance,
    stableBalances,
    price,
    gateReason,
    priceGated,
    phusdOut: quotedOut,
    minPhusdOut,
    needsApproval,
    pendingAction: basePending,
  } = state;
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [boostOn, setBoostOn] = useState(false);

  const bps = boost.boostBps ?? 0;
  const pctLabel = boost.boostPct !== null ? `+${boost.boostPct}%` : '+…%';
  const isEligible = boost.isEligible;
  const selectedEligible = isEligible(stable);
  const boostTarget = boost.eligibleStables[0];
  const unavailable = boost.unavailableReason;
  // The toggle can always be switched OFF; it can only be switched ON while the boost is available.
  const switchDisabled = !boostOn && unavailable !== null;
  const boostActive = boostOn;

  const stableBalance = stableBalances[stable];
  const meta = STABLE_META[stable];
  const gated = gateReason !== null;

  const parsed = Number.parseFloat(amount);
  const amt = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  const maxAmount = floorTo(Math.min(antimatterBalance, stableBalance), 4);
  const overAntimatter = amt > antimatterBalance;
  const overStable = amt > stableBalance;
  const over = overAntimatter || overStable;

  // Every displayed phUSD figure is floored: round in favour of the protocol.
  const plainBase = amt > 0 ? (quotedOut ?? 2 * amt) : 0;
  const base = floorTo(amt > 0 ? (boost.expectedBase ?? plainBase) : 0, 2);
  const potentialBonus = floorTo(amt > 0 ? (boost.expectedBonus ?? (base * bps) / 10_000) : 0, 2);
  const bonus = boostActive ? potentialBonus : 0;
  const out = boostActive ? floorTo(base + bonus, 2) : floorTo(plainBase, 2);
  const displayPrice = price ?? 1;
  const netValue = out * displayPrice - amt;
  const plainMin = amt > 0 && minPhusdOut !== null ? minPhusdOut : 0;
  const boostMin = amt > 0 && boost.minPhusdOut !== null ? boost.minPhusdOut : 0;
  const minReceived = floorTo(boostActive ? boostMin : plainMin, 2);

  // Hint: a client-side estimate of what the boost would add on this amount if paired with the target.
  const hintBase =
    boostTarget !== undefined ? Math.min(amt, antimatterBalance, stableBalances[boostTarget]) : 0;
  const hintBonus = floorTo((Math.max(0, hintBase) * 2 * bps) / 10_000, 2);
  const showHint = boostTarget !== undefined && !selectedEligible;
  // As in the approved design, the boost card exists only for a boostable pair. It also stays while the
  // switch is on, so a user whose pair lost eligibility mid-session can still switch the boost off.
  const showBoostCard = selectedEligible || boostOn;

  const selectStable = (s: AnnihilateStableSymbol) => {
    setStable(s);
    // The boost is opt-in per selection: leaving an eligible stable turns it off.
    if (!isEligible(s)) setBoostOn(false);
  };
  const acceptHint = () => {
    if (boostTarget === undefined) return;
    setStable(boostTarget);
    setBoostOn(true);
  };

  const handleAmountChange = (value: string) => {
    const trimmed = value.trim();
    if (AMOUNT_INPUT_PATTERN.test(trimmed)) setAmount(trimmed);
  };
  const fillMax = () => setAmount(maxAmount > 0 ? toInputString(maxAmount) : '');
  const closeSelector = useCallback(() => setSelectorOpen(false), []);

  const busy = basePending !== null || boost.pendingAction !== null;
  const noop = () => {};

  let button: { label: string; disabled: boolean; variant: 'primary' | 'approve'; onAction: () => void };
  if (gated) button = { label: gateReason, disabled: true, variant: 'primary', onAction: noop };
  else if (amt <= 0) button = { label: 'Enter Amount', disabled: true, variant: 'primary', onAction: noop };
  else if (over) button = { label: 'Insufficient Balance', disabled: true, variant: 'primary', onAction: noop };
  else if (boostActive) {
    if (unavailable !== null) {
      // No silent fallback to plain annihilation: the user switches the boost off themselves.
      button = { label: `Boost unavailable: ${unavailable}`, disabled: true, variant: 'primary', onAction: noop };
    } else if (boost.needsAmApproval) {
      button = {
        label: boost.pendingAction === 'approveAntimatter' ? 'Approving Antimatter…' : 'Approve Antimatter',
        disabled: busy,
        variant: 'approve',
        onAction: () => void boost.approveAntimatter(),
      };
    } else if (boost.needsStableApproval) {
      button = {
        label: boost.pendingAction === 'approveStable' ? `Approving ${stable}…` : `Approve ${stable}`,
        disabled: busy,
        variant: 'approve',
        onAction: () => void boost.approveStable(),
      };
    } else if (boost.quoteLoading || boost.minOutWei === undefined) {
      button = { label: 'Fetching quote…', disabled: true, variant: 'primary', onAction: noop };
    } else {
      button = {
        label:
          boost.pendingAction === 'boostedAnnihilate'
            ? 'Annihilating…'
            : `Annihilate with ${pctLabel} boost → receive ${fmt2(out)} phUSD`,
        disabled: busy,
        variant: 'primary',
        onAction: () => void boost.boostedAnnihilate(),
      };
    }
  } else if (needsApproval) {
    button = {
      label: basePending === 'approve' ? `Approving ${stable}…` : `Approve ${stable}`,
      disabled: busy,
      variant: 'approve',
      onAction: () => void state.approve(),
    };
  } else if (quotedOut === null) {
    button = { label: 'Fetching quote…', disabled: true, variant: 'primary', onAction: noop };
  } else {
    button = {
      label: basePending === 'annihilate' ? 'Annihilating…' : `Annihilate → receive ${fmt2(out)} phUSD`,
      disabled: busy,
      variant: 'primary',
      onAction: () => void state.annihilate(),
    };
  }

  const tokenOptions: ForgeTokenOption<AnnihilateStableSymbol>[] = ANNIHILATE_STABLE_ORDER.map((symbol) => ({
    symbol,
    name: STABLE_META[symbol].name,
    icon: STABLE_META[symbol].icon,
    balance: stableBalances[symbol],
    badge: isEligible(symbol) ? `${pctLabel} boost` : undefined,
  }));

  const fieldLabel = 'text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground';

  return (
    <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
      {/* Left column: inputs */}
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-col gap-2">
          <span className={fieldLabel}>Pair with</span>
          <div>
            <button
              type="button"
              onClick={() => setSelectorOpen(true)}
              aria-label={`Pair with ${stable}`}
              className="flex items-center gap-3 px-4 py-2 bg-card border border-border rounded-xl hover:bg-pxusd-teal-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <img src={meta.icon} alt={`${stable} icon`} className="h-8 w-8 rounded-full flex-shrink-0 object-cover" />
              <span className="text-base font-semibold text-foreground">{stable}</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>

          {showHint && (
            <button
              type="button"
              data-testid="boost-hint"
              onClick={acceptHint}
              className="flex items-center gap-2.5 rounded-xl border border-dashed px-3 py-2.5 text-left text-[13px] leading-[1.45] text-foreground transition-colors"
              style={{ borderColor: 'rgba(245,158,11,.55)', background: 'rgba(245,158,11,.07)' }}
            >
              <BoltIcon />
              <span className="flex-grow">
                <span className="font-bold" style={{ color: BOOST_AMBER }}>
                  {boostTarget} is boosted right now:
                </span>{' '}
                pair with it for {pctLabel} phUSD
                {hintBonus > 0 && ` (+${fmt2(hintBonus)} on this amount)`}
              </span>
              <span className="whitespace-nowrap font-bold" style={{ color: BOOST_AMBER }}>
                Switch →
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className={fieldLabel}>Antimatter to annihilate</span>
          <button
            type="button"
            onClick={fillMax}
            className="whitespace-nowrap text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Max: {fmt2(maxAmount)}
          </button>
        </div>

        <div>
          <AmountInput amount={amount} onAmountChange={handleAmountChange} onMaxClick={fillMax} isInvalid={over} />
          <p className="-mt-3 text-xs text-muted-foreground">
            ≈ ${fmt2(amt)} of {stable} leaves your wallet
            {over && (
              <>
                {' · '}
                <span className="text-pxusd-pink-400">
                  {overAntimatter ? 'Insufficient Antimatter' : `Insufficient ${stable}`}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-col gap-1.5 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Your Antimatter</span>
            <span className="font-mono tabular-nums" style={{ color: ANTIMATTER_LAVENDER }}>
              {fmt2(antimatterBalance)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Your {stable}</span>
            <span className="font-mono tabular-nums text-pxusd-white">{fmt2(stableBalance)}</span>
          </div>
        </div>

        {showBoostCard && (
          <div
            data-testid="boost-card"
            className="rounded-xl border p-3.5 transition-colors"
            style={
              boostOn
                ? { borderColor: '#d97706', background: 'rgba(245,158,11,.10)' }
                : { borderColor: '#2a4356', background: '#0f2029' }
            }
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BoltIcon size={18} />
                <span className="text-sm font-bold text-foreground">phUSD boost</span>
                <span
                  className="whitespace-nowrap rounded-full border px-2 py-[1px] text-[10.5px] font-bold tracking-[0.04em]"
                  style={BOOST_TINT}
                >
                  {pctLabel}
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={boostOn}
                aria-label="Apply phUSD boost"
                disabled={switchDisabled}
                onClick={() => setBoostOn((on) => !on)}
                className="relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                style={
                  boostOn
                    ? { background: '#d97706', borderColor: '#f59e0b' }
                    : { background: '#1b2e3a', borderColor: '#3a5468' }
                }
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full shadow-md transition-transform duration-200 ease-in-out ${
                    boostOn ? 'translate-x-6 bg-white' : 'translate-x-1 bg-slate-400'
                  }`}
                />
              </button>
            </div>
            {unavailable === null ? (
              <p className="mt-2 text-[12.5px] leading-[1.5] text-muted-foreground">
                {stable} is running low in protocol-owned liquidity. Pair with it now and receive {boost.boostPct ?? '…'}% extra
                phUSD. Optional: the boosted route uses more gas.
              </p>
            ) : (
              <p data-testid="boost-unavailable" className="mt-2 text-[12.5px] leading-[1.5] text-muted-foreground">
                {unavailable}
                {boostOn && '. Switch the boost off to annihilate without it.'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Right column: preview + action */}
      <div className="flex min-w-0 flex-col">
        <div
          className="rounded-[14px] border p-4"
          style={{
            borderColor: 'rgba(196,174,234,.28)',
            background: 'linear-gradient(180deg, rgba(196,174,234,.09), rgba(10,28,40,0) 85%)',
          }}
        >
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-pxusd-purple-300">
            Annihilation preview
          </div>
          <div
            data-testid="boost-mock-preview"
            className="grid grid-cols-1 items-center gap-2.5 sm:grid-cols-[1fr_auto_1fr_auto_1fr]"
          >
            <PreviewCell label="Antimatter" labelColor={ANTIMATTER_LAVENDER} value={fmt2(amt)} />
            <Glyph>+</Glyph>
            <PreviewCell label={stable} labelColor="rgba(240,245,248,.72)" value={fmt2(amt)} />
            <Glyph>=</Glyph>
            <div className="relative min-w-0">
              <PreviewCell label="phUSD" labelColor="#FFB566" value={fmt2(out)} emphasised />
              {boostActive && (
                <span
                  data-testid="boost-out-badge"
                  className="absolute right-2 top-2 whitespace-nowrap rounded-full px-1.5 py-[1px] text-[10px] font-bold"
                  style={{ background: BOOST_AMBER, color: '#0b161d' }}
                >
                  {pctLabel}
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 space-y-2.5 text-sm">
            {boostActive && (
              <>
                <PreviewRow label="Base (2×)">{fmt2(base)} phUSD</PreviewRow>
                <PreviewRow label={`${stable} boost (${pctLabel})`}>
                  <span style={{ color: BOOST_AMBER }}>+{fmt2(bonus)} phUSD</span>
                </PreviewRow>
              </>
            )}
            {unavailable === null && !boostOn && amt > 0 && (
              <div data-testid="boost-not-applied" className="flex items-center justify-between gap-3 opacity-60">
                <span className="text-muted-foreground">Boost available, not applied</span>
                <span className="text-right font-mono tabular-nums text-muted-foreground">
                  +{fmt2(potentialBonus)} phUSD
                </span>
              </div>
            )}
            <PreviewRow label="phUSD price">
              <span className={priceGated ? 'text-pxusd-pink-400' : undefined}>
                {price === null ? '—' : `$${fmt2(price)}`}
              </span>
            </PreviewRow>
            <PreviewRow label="Net value change">
              <span className={netValue >= 0 ? 'text-green-400' : 'text-pxusd-pink-400'}>
                {/* Real minus sign (U+2212), not a hyphen. */}
                {netValue >= 0 ? '+' : '−'}${fmt2(Math.abs(netValue))}
              </span>
            </PreviewRow>
            <PreviewRow label="Minimum received">{fmt2(minReceived)} phUSD</PreviewRow>
          </div>
        </div>

        {priceGated && (
          <div
            role="alert"
            className="mt-4 rounded-xl border p-3.5 text-[12.5px] leading-[1.5] text-muted-foreground"
            style={{ borderColor: 'rgba(255,77,109,.35)', background: 'rgba(255,77,109,.07)' }}
          >
            <strong className="text-pxusd-pink-400">Annihilation disabled.</strong> phUSD is at ${fmt2(displayPrice)}. At
            $0.50 or less, the phUSD you receive is worth less than the {stable} you put in.
          </div>
        )}

        <ActionButton
          disabled={button.disabled}
          onAction={button.onAction}
          label={button.label}
          variant={button.variant}
        />
        <p className="mt-2 text-center text-[11.5px] text-muted-foreground">
          {boostActive
            ? `Irreversible. Boosted route: higher gas, ${boost.boostPct ?? '…'}% more phUSD.`
            : 'Irreversible. Both halves are consumed in one transaction.'}
        </p>
      </div>

      <ForgeTokenSelectorModal
        isOpen={selectorOpen}
        onClose={closeSelector}
        tokens={tokenOptions}
        activeSymbol={stable}
        onSelect={selectStable}
        footerNote="Only stablecoins registered with the phUSD minter can be annihilated."
      />
    </div>
  );
}
