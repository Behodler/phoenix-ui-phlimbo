import { useEffect, useRef, useState } from 'react';
import { fmtAmount } from '../stake/formatStake';
import {
  ANTIMATTER_ACCENT,
  ANTIMATTER_IRREVERSIBLE_NOTE,
  PHUSD_ACCENT,
  PHUSD_ARROW_ACCENT,
  antimatterExplainerEvocative,
  antimatterSplit,
} from '../../../data/antimatterData';
import antimatterIcon from '../../../assets/antimatter.png';
import phUSDIcon from '../../../assets/phUSD-nobackground.png';

/**
 * The **annihilate** sub-tab of a stablecoin pool row: the live preview of the
 * trade, the gate's explanation when it is shut, and the button itself.
 *
 * It is a component of its own rather than a branch inside
 * `AntimatterAccordionRow` because every figure on it ticks, and the ticker
 * needs hooks. The row is deliberately hook-free — it renders inside a `.map()`
 * over the pools — so the hooks live down here, where there is exactly one
 * instance: a single row is open at a time, and only its annihilate sub-tab
 * mounts this.
 *
 * One `requestAnimationFrame` loop drives the whole panel, so the accrued
 * Antimatter, the stake it is matched against and the phUSD that comes out are
 * always three views of the same number rather than three counters that can
 * disagree between frames.
 */
export interface AnnihilatePanelProps {
  /** Stake-token symbol, e.g. `USDC`. */
  symbol: string;
  icon: string;
  antimatterSymbol: string;

  /** Staked principal (human units) — the cap on what can be matched. */
  staked: number;
  /**
   * Total accrued Antimatter at the last chain read (`claimableReward`). The
   * extrapolation rebases on this every time it changes, which is the 12 s
   * heartbeat, a confirmed transaction, or a manual refresh.
   */
  pending: number;
  /** Antimatter accruing to this user per second, from `poolInfo`. */
  ratePerSecond: number;
  /**
   * Block-attested matched amount, from the contract's own `toStableAmount`.
   * The button's enabled/disabled decision is taken on this, never on the
   * extrapolation — see the note on `canAnn` below.
   */
  matchedStable: number;
  /** Block-attested surplus, the contract's `excess`. */
  surplusAntimatter: number;

  walletPhusd: number;
  walletAntimatter: number;
  /** phUSD spot for the value line. Display math only. */
  phUsdDisplayPrice: number;

  /** Confirmed annihilations on this pool — the burst animation's key. */
  annihilationCount: number;
  disabled: boolean;
  inactive: boolean;
  annihilateDisabledReason: string | null;
  pendingAction: 'stake' | 'withdraw' | 'claim' | 'approve' | 'annihilate' | null;
  onAnnihilate: () => void;
}

/**
 * Extrapolates `base` forward at `ratePerSecond` on a `requestAnimationFrame`
 * clock, rebasing whenever either argument changes.
 *
 * **Display only.** Antimatter accrues continuously on chain but is only
 * *read* on the 12 s heartbeat, so without this the preview would sit still for
 * twelve seconds and then jump — which is what the pool's own pending counter
 * already avoids the same way. The extrapolation costs nothing on the network:
 * the rate it multiplies is `poolInfo.antimatterPerSecond` scaled by the
 * user's share, both of which are already read for the row's header.
 *
 * A rate of zero skips the loop entirely rather than ticking a value that never
 * changes. That is the state the global Live toggle produces when polling is
 * paused, and holding the figure still is the honest rendering of it.
 */
function useLiveAccrual(base: number, ratePerSecond: number): number {
  const [value, setValue] = useState(base);
  const startRef = useRef(0);
  const baseRef = useRef(base);

  useEffect(() => {
    startRef.current = performance.now();
    baseRef.current = base;
    setValue(base);
  }, [base, ratePerSecond]);

  useEffect(() => {
    if (ratePerSecond <= 0) return;
    let raf: number | null = null;
    const tick = () => {
      const elapsed = (performance.now() - startRef.current) / 1000;
      setValue(baseRef.current + elapsed * ratePerSecond);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [ratePerSecond]);

  return value;
}

/**
 * One operand of the annihilation preview.
 *
 * `burst` plays the confirmation animation over the cell: `annihilate` is the
 * white detonation the two destroyed operands share, `create` the phUSD-orange
 * bloom that follows it. The two are sequenced by a CSS `animation-delay` on
 * `create`, never by a timer.
 */
function PreviewCell({
  eyebrow,
  eyebrowColor,
  icon,
  iconAlt,
  head,
  tail,
  tailColor,
  emphasised,
  burst,
  burstKey,
  cue,
  cueOn,
  testId,
}: {
  eyebrow: string;
  eyebrowColor: string;
  icon: string;
  iconAlt: string;
  head: string;
  tail: string;
  tailColor: string;
  emphasised?: boolean;
  burst?: 'annihilate' | 'create';
  burstKey?: number;
  /** Which part of the idle "combine these" cue this cell plays, if any. */
  cue?: 'left' | 'right' | 'result';
  /** Whether the cue is currently playing. Off restarts it from idle when it returns. */
  cueOn?: boolean;
  testId?: string;
}) {
  return (
    <div
      data-cue={cue}
      data-cue-on={cue ? String(Boolean(cueOn)) : undefined}
      className={`relative overflow-hidden rounded-xl border p-3 ${cue ? `am-cue--${cue}` : ''} ${cue && cueOn ? 'am-cue--on' : ''}`}
      // Tinted surfaces are literal rgba throughout this file: a Tailwind
      // opacity modifier on a full-hex `pxusd-*` token compiles to the invalid
      // `rgb(#RRGGBB / a)` and the declaration is silently dropped.
      style={
        emphasised
          ? { borderColor: 'rgba(255,140,66,.35)', background: 'rgba(255,140,66,.08)' }
          : { borderColor: 'rgba(255,255,255,.1)', background: 'rgba(255,255,255,.03)' }
      }
    >
      {burst && burstKey ? (
        // Keyed on the confirmed-annihilation count: React remounts the node,
        // which is what restarts a CSS animation that has already run once.
        <span
          key={burstKey}
          aria-hidden="true"
          data-testid="am-burst"
          data-burst={burst}
          className={`am-burst am-burst--${burst}`}
        />
      ) : null}
      <div className="mb-1.5 flex items-center gap-2">
        <img src={icon} alt={iconAlt} className="h-5 w-5 rounded-full" />
        <span
          className="text-[11px] font-bold uppercase tracking-[0.08em]"
          style={{ color: eyebrowColor }}
        >
          {eyebrow}
        </span>
      </div>
      <div
        data-testid={testId}
        className="font-mono text-[20px] font-semibold tabular-nums tracking-[-0.02em] text-pxusd-white"
        style={{ overflowWrap: 'anywhere' }}
      >
        {head}
        <span style={{ color: tailColor }}>{tail}</span>
      </div>
    </div>
  );
}

/**
 * USD at four decimals. `fmtUSD` rounds to cents, so a small match — a fresh
 * stake a few minutes into accruing — rendered as `$0.00` even though the
 * figure is real and ticking.
 */
function fmtNetValue(n: number): string {
  return (
    (n < 0 ? '-$' : '+$') +
    Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })
  );
}

/**
 * One row of the before/after table: label, the figure now, and the figure once
 * the annihilation lands with its signed change beside it. Every column is
 * left-aligned and sized to its content, so the figures sit close to their
 * labels at any width.
 *
 * The change is muted rather than red or green. A falling stake is not a loss
 * here — that principal is converted into phUSD, and the net-value footer is
 * where gain or loss is actually judged — so a red figure would misreport it.
 */
function BalanceRow({
  label,
  now,
  after,
  delta,
  decimals,
  afterColor,
}: {
  label: string;
  now: number;
  after: number;
  delta: number;
  decimals: number;
  afterColor: string;
}) {
  // No change reads as no parenthetical: a bare "(+0)" before anything has
  // accrued is noise.
  const deltaText = fmtAmount(Math.abs(delta), decimals);
  const showDelta = deltaText !== '0';
  return (
    <tr>
      <th scope="row" className="py-1 pr-6 text-left font-normal text-muted-foreground">
        {label}
      </th>
      <td className="py-1 pr-6 text-left font-mono tabular-nums text-pxusd-white">
        {fmtAmount(now, decimals)}
      </td>
      <td className="py-1 text-left font-mono tabular-nums">
        <span style={{ color: afterColor }}>{fmtAmount(after, decimals)}</span>
        {showDelta && (
          <span className="ml-1.5 text-muted-foreground">
            ({delta < 0 ? '−' : '+'}
            {deltaText})
          </span>
        )}
      </td>
    </tr>
  );
}

export default function AnnihilatePanel({
  symbol,
  icon,
  antimatterSymbol,
  staked,
  pending,
  ratePerSecond,
  matchedStable,
  surplusAntimatter,
  walletPhusd,
  walletAntimatter,
  phUsdDisplayPrice,
  annihilationCount,
  disabled,
  inactive,
  annihilateDisabledReason,
  pendingAction,
  onAnnihilate,
}: AnnihilatePanelProps) {
  // ---- the live figures --------------------------------------------------
  // One extrapolation, three views of it. Antimatter and the stake token are
  // 1:1 by the staker's own `_antimatterScale`, so the same number reads as
  // both, and `min` against the staked principal reproduces the contract's cap
  // continuously instead of only at each read. (The chain's `matchedStable` is
  // additionally floored to whole stable units, a sub-1e-6 difference on USDC
  // that no display at four decimals can show.)
  const accrued = useLiveAccrual(pending, ratePerSecond);
  const matched = Math.min(accrued, staked);
  const receive = matched * 2;
  const leftover = Math.max(accrued - staked, 0);
  // The epsilon matters: accrual makes exact equality unreachable, so a bare
  // `> 0` produces a phantom surplus line the instant the two sides cross.
  const capped = leftover > 1e-9;
  const netValue = receive * phUsdDisplayPrice - matched;

  const [pendingHead, pendingTail] = antimatterSplit(accrued, 6);
  const [matchHead, matchTail] = antimatterSplit(matched, 6);
  const [receiveHead, receiveTail] = antimatterSplit(receive, 6);

  /**
   * The count this panel mounted with. The burst is keyed on the count, and a
   * freshly mounted node plays its keyframes, so without this baseline every
   * reopen of the accordion (or return to this sub-tab) replayed the flash for
   * an annihilation the user already watched. Only a receipt that lands while
   * the panel is open lifts the count above it.
   */
  const mountedCountRef = useRef(annihilationCount);
  const burstKey = annihilationCount > mountedCountRef.current ? annihilationCount : 0;

  const busy = pendingAction !== null;
  /**
   * The enable decision is taken on the BLOCK-ATTESTED figures, never on the
   * extrapolation above. The same rule the repo applies to `minRewards` in the
   * whale-mint flow: a number invented between reads may drive what is drawn,
   * never what is signed. Here the cost of getting it wrong is only a button
   * that stays disabled for one more heartbeat, and the contract's own
   * `require(netWanted > 0 || excess > 0)` is evaluated at execution time
   * against a figure at least as large.
   */
  const canAnn =
    !disabled &&
    !busy &&
    annihilateDisabledReason === null &&
    (matchedStable > 0 || surplusAntimatter > 0);

  /**
   * The "combine these" cue plays only while there is a real annihilation to
   * encourage. `canAnn` is already false for the whole of a pending
   * transaction (`busy`), so the cells hold still from the click until the
   * receipt or the failure, and the cue restarts from its idle opening once
   * the flash has the stage.
   */
  const cueOn = canAnn;

  const annLabel = inactive
    ? 'Not live on this network yet'
    : matched <= 0 && leftover <= 0
      ? `Stake ${symbol} to accrue ${antimatterSymbol}`
      : matched <= 0
        ? `Claim ${fmtAmount(leftover, 4)} ${antimatterSymbol} — your accrual has outrun your stake`
        : // Only the phUSD figure goes on the button. The operands are already
          // in the preview directly above it, and repeating them made the
          // label wrap to three lines.
          capped
          ? `Annihilate ${antimatterSymbol} with ${symbol} → receive ${fmtAmount(receive, 4)} phUSD + surplus ${antimatterSymbol}`
          : `Annihilate ${antimatterSymbol} with ${symbol} → receive ${fmtAmount(receive, 4)} phUSD`;

  return (
    <div>
      {/*
        The confirmation animation, component-local so global CSS stays
        untouched, and rendered only here: a single row is open at a time and
        only its annihilate panel ever shows a burst, so this block exists at
        most once in the document.

        The sequence is the event itself, told in order. Both destroyed
        operands detonate white together, and the phUSD bloom is held back by
        an `animation-delay` so creation reads as a consequence of the
        annihilation rather than as a third thing happening alongside it.
      */}
      <style>{`
        .am-burst {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 44px;
          height: 44px;
          margin: -22px 0 0 -22px;
          border-radius: 9999px;
          pointer-events: none;
          opacity: 0;
        }
        /* The shockwave: a thin ring that outruns the core of the flash, which
           is what makes the bloom read as an explosion rather than as a fade. */
        .am-burst::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          border: 2px solid currentColor;
        }

        /* The ring outruns the core — scale 11 against the core's 7 — which is
           what gives the flash a direction. Both are clipped to the cell by its
           overflow:hidden, so the explosion consumes exactly the operand it
           belongs to. */
        @keyframes am-burst-core {
          0%   { transform: scale(0.15); opacity: 0; }
          12%  { opacity: 1; }
          100% { transform: scale(7); opacity: 0; }
        }
        @keyframes am-burst-ring {
          0%   { transform: scale(0.3); opacity: 0.9; }
          100% { transform: scale(11); opacity: 0; }
        }

        .am-burst--annihilate {
          color: rgba(255,255,255,.9);
          background: radial-gradient(
            circle,
            rgba(255,255,255,.98) 0%,
            rgba(255,255,255,.6) 36%,
            rgba(255,255,255,0) 70%
          );
          animation: am-burst-core 720ms cubic-bezier(.16,.84,.44,1) forwards;
        }
        .am-burst--annihilate::after {
          animation: am-burst-ring 720ms cubic-bezier(.16,.84,.44,1) forwards;
        }

        /* 300ms behind the white flash, which is a little under half way
           through it: the two overlap heavily and read as a single event with
           a direction, rather than as one thing finishing and another
           starting. */
        .am-burst--create {
          color: ${PHUSD_ARROW_ACCENT};
          background: radial-gradient(
            circle,
            rgba(255,181,102,.98) 0%,
            rgba(255,140,66,.62) 40%,
            rgba(255,140,66,0) 72%
          );
          animation: am-burst-core 860ms cubic-bezier(.16,.84,.44,1) 300ms forwards;
        }
        .am-burst--create::after {
          animation: am-burst-ring 860ms cubic-bezier(.16,.84,.44,1) 300ms forwards;
        }

        /* The idle cue: "combine these two, get that". One 6.5s cycle shared
           by all three cells, so they stay in step without any JS clock.

           The cycle OPENS idle, and that is load-bearing. The cue class is
           dropped while annihilation is not available — including the whole
           of a pending transaction — and re-added in the same commit the
           receipt lands and the burst mounts. Re-adding restarts the
           animation from 0%, so the first 40% (2.6s) of stillness is what
           lets the ~1.16s white-then-orange flash play through untouched.

           The two operands hop twice while drifting toward each other, then
           ease back apart as the phUSD cell takes its own hop — the result
           answering the combination. The drift direction is a custom property:
           horizontal when the preview is a row (sm+), vertical when stacked. */
        .am-cue--left  { --am-cue-dx: 0px;  --am-cue-dy: 5px; }
        .am-cue--right { --am-cue-dx: 0px;  --am-cue-dy: -5px; }
        @media (min-width: 640px) {
          .am-cue--left  { --am-cue-dx: 7px;  --am-cue-dy: 0px; }
          .am-cue--right { --am-cue-dx: -7px; --am-cue-dy: 0px; }
        }

        @keyframes am-cue-operand {
          0%, 40%  { transform: translate(0, 0); }
          45%      { transform: translate(calc(var(--am-cue-dx) * .4), calc(var(--am-cue-dy) * .4 - 7px)); }
          50%      { transform: translate(calc(var(--am-cue-dx) * .75), var(--am-cue-dy)); }
          54%      { transform: translate(calc(var(--am-cue-dx) * .9), calc(var(--am-cue-dy) * .9 - 4px)); }
          58%      { transform: translate(var(--am-cue-dx), var(--am-cue-dy)); }
          70%, 100% { transform: translate(0, 0); }
        }
        @keyframes am-cue-result {
          0%, 58%  { transform: translateY(0) scale(1); }
          64%      { transform: translateY(-9px) scale(1.035); }
          70%      { transform: translateY(0) scale(1); }
          74%      { transform: translateY(-3px) scale(1.01); }
          78%, 100% { transform: translateY(0) scale(1); }
        }

        .am-cue--left.am-cue--on,
        .am-cue--right.am-cue--on {
          animation: am-cue-operand 6.5s ease-in-out infinite;
        }
        .am-cue--result.am-cue--on {
          animation: am-cue-result 6.5s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .am-burst { display: none; }
          .am-cue--on { animation: none !important; }
        }
      `}</style>

      <div
        className="mb-3.5 rounded-[14px] border p-4"
        style={{
          borderColor: 'rgba(196,174,234,.28)',
          background: 'linear-gradient(180deg, rgba(196,174,234,.09), rgba(10,28,40,0) 85%)',
        }}
      >
        <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-pxusd-purple-300">
          Annihilation preview
        </div>

        {/* Five columns cannot fit at 375px, and every operand here is
            load-bearing, so the row stacks below `sm` with the `+` and `=`
            glyphs kept as full-width separators rather than dropping cells the
            way the app's tables do. */}
        <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <PreviewCell
            eyebrow={`${antimatterSymbol} accrued`}
            eyebrowColor="#C4AEEA"
            icon={antimatterIcon}
            iconAlt="Antimatter"
            head={pendingHead}
            tail={pendingTail}
            tailColor={ANTIMATTER_ACCENT}
            testId="preview-accrued"
            burst="annihilate"
            burstKey={burstKey}
            cue="left"
            cueOn={cueOn}
          />
          <div aria-hidden="true" className="text-center text-[22px] text-muted-foreground">
            +
          </div>
          <PreviewCell
            eyebrow={`${symbol} from your stake`}
            eyebrowColor="rgba(240,245,248,.72)"
            icon={icon}
            iconAlt={symbol}
            head={matchHead}
            tail={matchTail}
            tailColor={ANTIMATTER_ACCENT}
            testId="preview-matched"
            burst="annihilate"
            burstKey={burstKey}
            cue="right"
            cueOn={cueOn}
          />
          <div aria-hidden="true" className="text-center text-[22px] text-muted-foreground">
            =
          </div>
          <PreviewCell
            eyebrow="phUSD to you"
            eyebrowColor={PHUSD_ARROW_ACCENT}
            icon={phUSDIcon}
            iconAlt="phUSD"
            head={receiveHead}
            tail={receiveTail}
            tailColor={PHUSD_ACCENT}
            testId="preview-receive"
            emphasised
            burst="create"
            burstKey={burstKey}
            cue="result"
            cueOn={cueOn}
          />
        </div>

        <p className="mt-3.5 text-[12.5px] leading-[1.55] text-muted-foreground">
          {antimatterExplainerEvocative(antimatterSymbol, symbol)}
        </p>

        {/* A real Now / After table, sized to its content rather than stretched
            to the panel, so on a wide screen the figures stay beside their
            labels instead of being flung to opposite edges. The accrued
            Antimatter row is deliberately absent: the preview cells above
            already show it going to zero. */}
        <div className="mt-3.5 border-t" style={{ borderColor: 'rgba(255,255,255,.1)' }}>
          <table className="text-[12.5px]">
            <thead>
              <tr className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                <th scope="col" className="pb-1 pr-6 pt-3 text-left font-bold">
                  <span className="sr-only">Balance</span>
                </th>
                <th scope="col" className="pb-1 pr-6 pt-3 text-left font-bold">
                  Now
                </th>
                <th scope="col" className="pb-1 pt-3 text-left font-bold">
                  After
                </th>
              </tr>
            </thead>
            <tbody>
              <BalanceRow
                label={`${symbol} staked`}
                now={staked}
                after={Math.max(staked - matched, 0)}
                delta={-Math.min(matched, staked)}
                decimals={4}
                afterColor="#C4AEEA"
              />
              <BalanceRow
                label="phUSD in wallet"
                now={walletPhusd}
                after={walletPhusd + receive}
                delta={receive}
                // Four, not two: a fresh accrual yields a gain well under a
                // cent, which two places rounds to "0" and so hides entirely.
                decimals={4}
                afterColor={PHUSD_ARROW_ACCENT}
              />
              {capped && (
                <BalanceRow
                  label={`${antimatterSymbol} in wallet`}
                  now={walletAntimatter}
                  after={walletAntimatter + leftover}
                  delta={leftover}
                  decimals={4}
                  afterColor="#C4AEEA"
                />
              )}
            </tbody>
            {/* Net value uses the phUSD spot: the pair is worth `2p - 1` per
                matched unit, so at p = 1 it is exactly the matched amount.
                Display math only — the annihilate gate reads the RAW, unclamped
                price. */}
            <tfoot className="border-t" style={{ borderColor: 'rgba(255,255,255,.1)' }}>
              <tr>
                <th scope="row" className="pr-6 pt-2.5 text-left font-semibold text-pxusd-white">
                  Net value
                </th>
                <td
                  colSpan={2}
                  className="pt-2.5 text-left font-mono font-semibold tabular-nums"
                  style={{ color: netValue < 0 ? '#FF4D6D' : PHUSD_ARROW_ACCENT }}
                >
                  {fmtNetValue(netValue)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {capped && (
          <div
            className="mt-3 rounded-xl border p-3 text-[12.5px] leading-[1.5] text-muted-foreground"
            style={{ borderColor: 'rgba(255,217,61,.3)', background: 'rgba(255,217,61,.06)' }}
          >
            <span className="font-semibold" style={{ color: '#FFD93D' }}>
              Surplus {antimatterSymbol}.
            </span>{' '}
            You hold more {antimatterSymbol} than staked {symbol}, so{' '}
            <span className="font-mono text-pxusd-white">
              {fmtAmount(matched, 6)} {symbol}
            </span>{' '}
            of principal annihilates and the surplus{' '}
            <span className="font-mono text-pxusd-white">
              {fmtAmount(leftover, 6)} {antimatterSymbol}
            </span>{' '}
            is paid straight to your wallet as an ordinary claim.
          </div>
        )}
      </div>

      {/* The gate must never be a silently dead button: when annihilation is
          unavailable the reason is rendered above it. */}
      {annihilateDisabledReason !== null && (
        <div
          data-testid={`annihilate-blocked-${symbol}`}
          className="mb-3 rounded-xl border p-3.5 text-[12.5px] leading-[1.5] text-muted-foreground"
          style={{ borderColor: 'rgba(255,77,109,.35)', background: 'rgba(255,77,109,.07)' }}
        >
          <span className="font-semibold text-pxusd-pink-400">Annihilation disabled.</span>{' '}
          {annihilateDisabledReason}
        </div>
      )}

      {/* Standard Phoenix orange, not a lavender gradient: Antimatter's
          identity is carried by the accent on figures, borders and the token
          pill, never by restyling buttons. The label is long by design — it
          states the whole trade — so it wraps rather than truncating on narrow
          screens. */}
      <button
        type="button"
        onClick={onAnnihilate}
        disabled={!canAnn}
        className={`phoenix-btn-primary w-full whitespace-normal text-left sm:text-center ${canAnn ? '' : 'opacity-40 cursor-not-allowed'}`}
      >
        {pendingAction === 'annihilate' ? 'Annihilating…' : annLabel}
      </button>
      <div className="mt-2.5 text-center text-[11.5px] text-muted-foreground">
        {ANTIMATTER_IRREVERSIBLE_NOTE(symbol)}
      </div>
    </div>
  );
}
