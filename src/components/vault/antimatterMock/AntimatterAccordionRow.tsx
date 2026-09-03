import SegmentedControl from '../../ui/SegmentedControl';
import LiveYieldCounter from '../staking/LiveYieldCounter';
import { fmtAPY, fmtAmount, fmtUSD } from '../stake/formatStake';
import {
  ANTIMATTER_ACCENT,
  ANTIMATTER_EXPLAINER_EVOCATIVE,
  ANTIMATTER_IRREVERSIBLE_NOTE,
  PHUSD_ACCENT,
  PHUSD_ARROW_ACCENT,
  antimatterSplit,
} from '../../../data/antimatterMockData';
import type { AntimatterSubTab } from '../../../data/antimatterMockData';
import antimatterIcon from '../../../assets/antimatter.png';
import phUSDIcon from '../../../assets/phUSD-nobackground.png';

/**
 * A stable pool row on the **mock** Antimatter tab: the collapsed header plus
 * the expanded stake / withdraw / annihilate panel.
 *
 * Every figure passed in is simulated — see `src/data/antimatterMockData.ts`.
 * Nothing here touches a contract, a wagmi hook or an approval; the buttons
 * call back into the container's single `useState` and nothing else.
 *
 * **No hooks live in this component.** It is rendered inside a `.map()` over
 * the pools, so all state — including which sub-tab each pool is showing and
 * the raw text of each amount input — belongs to the container, exactly as
 * `StakeAccordionRow` does it.
 *
 * `StakeAccordionRow`'s `AmountField` would have been the natural thing to
 * reuse, but it is module-private and this story may not edit files outside
 * `antimatterMock/`, so the field is reproduced here as `MockAmountField`
 * (minus the contract-shaped `estimateTip` / `InfoTip` machinery, which a mock
 * has no use for).
 */
export interface AntimatterAccordionRowProps {
  symbol: string;
  icon: string;
  apy: number;
  staked: number;
  /** Antimatter accrued as of the last rebase — the counter's baseline. */
  pendingBase: number;
  /** Antimatter accrued per second, demo multiplier already applied. */
  ratePerSecond: number;
  /** Antimatter accrued *right now*, recomputed by the container each tick. */
  pending: number;
  antimatterSymbol: string;
  expanded: boolean;
  onToggle: () => void;

  /** One-line description of the pool, shown beside the sub-tab bar. */
  tagline: string;
  tab: AntimatterSubTab;
  onTabChange: (tab: AntimatterSubTab) => void;

  /** Mock wallet balance of this pool's stablecoin. */
  walletBalance: number;
  /** Mock wallet phUSD balance, for the before/after summary. */
  walletPhusd: number;
  /** Mock wallet Antimatter balance, for the surplus row of the summary. */
  walletAntimatter: number;

  stakeAmt: string;
  wdAmt: string;
  onStakeAmtChange: (value: string) => void;
  onWdAmtChange: (value: string) => void;
  onStake: () => void;
  onWithdraw: () => void;
  onAnnihilate: () => void;
}

/** Chevron matching the live Stake tab's, rotated when the row is open. */
function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="justify-self-end text-muted-foreground transition-transform"
      style={{ transform: expanded ? 'rotate(180deg)' : 'none', display: 'inline-flex' }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M5 7.5l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/**
 * Amount input with a clickable balance, a MAX button and a token glyph.
 *
 * `pr-28` is load-bearing: it is the repo's equivalent of the mock's
 * `padding-right:112px`, and without it a long typed number runs underneath
 * the MAX button and the glyph.
 *
 * MAX floors to 4 decimals rather than passing the raw float — the label only
 * ever displays 4 decimals, and rounding a user-facing credit upward is never
 * the right direction.
 */
function MockAmountField({
  label,
  balanceLabel,
  balance,
  value,
  onChange,
  tokenSymbol,
  tokenIcon,
}: {
  label: string;
  balanceLabel: string;
  balance: number;
  value: string;
  onChange: (v: string) => void;
  tokenSymbol: string;
  tokenIcon: string;
}) {
  const parsed = parseFloat(value) || 0;
  const overBalance = parsed > balance + 1e-7;
  const handleMax = () => onChange(String(Math.floor(balance * 1e4) / 1e4));

  return (
    <div className="mb-3.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">{label}</span>
        <button
          type="button"
          className="text-[12px] text-muted-foreground hover:text-pxusd-white disabled:opacity-50"
          onClick={handleMax}
          disabled={balance <= 0}
        >
          {balanceLabel}: <span className="font-mono text-pxusd-white">{fmtAmount(balance, 4)}</span>
        </button>
      </div>
      <div className="relative">
        <input
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={[
            'w-full rounded-xl border bg-card px-4 py-3 pr-28 font-mono text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
            overBalance ? 'border-pxusd-pink-400/60' : 'border-input',
          ].join(' ')}
        />
        <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-secondary px-2.5 py-1 text-[11px] text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
            onClick={handleMax}
            disabled={balance <= 0}
          >
            MAX
          </button>
          <img src={tokenIcon} alt={tokenSymbol} className="h-5 w-5 rounded-full" />
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3 text-[12px] text-muted-foreground">
        {/* Every pool here is a stablecoin, so 1 unit ≈ $1 and no price feed
            is needed (nor available — this surface is entirely fake). */}
        <span>
          ≈ <span className={`font-mono ${parsed > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>{fmtUSD(parsed)}</span>
        </span>
        {overBalance && <span className="text-pxusd-pink-400">Insufficient balance</span>}
      </div>
    </div>
  );
}

/** One operand of the annihilation preview. */
function PreviewCell({
  eyebrow,
  eyebrowColor,
  icon,
  iconAlt,
  head,
  tail,
  tailColor,
  caption,
  emphasised,
}: {
  eyebrow: string;
  eyebrowColor: string;
  icon: string;
  iconAlt: string;
  head: string;
  tail: string;
  tailColor: string;
  caption: string;
  emphasised?: boolean;
}) {
  return (
    <div
      className="rounded-xl border p-3"
      // Tinted surfaces are literal rgba throughout this file: a Tailwind
      // opacity modifier on a full-hex `pxusd-*` token compiles to the invalid
      // `rgb(#RRGGBB / a)` and the declaration is silently dropped.
      style={
        emphasised
          ? { borderColor: 'rgba(255,140,66,.35)', background: 'rgba(255,140,66,.08)' }
          : { borderColor: 'rgba(255,255,255,.1)', background: 'rgba(255,255,255,.03)' }
      }
    >
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
        className="font-mono text-[20px] font-semibold tabular-nums tracking-[-0.02em] text-pxusd-white"
        style={{ overflowWrap: 'anywhere' }}
      >
        {head}
        <span style={{ color: tailColor }}>{tail}</span>
      </div>
      <div className="mt-1 text-[11.5px] text-muted-foreground">{caption}</div>
    </div>
  );
}

/** One `label → value` line of the before/after summary. */
function SummaryLine({
  label,
  before,
  after,
  afterColor,
}: {
  label: string;
  before: string;
  after?: string;
  afterColor?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-pxusd-white" style={{ overflowWrap: 'anywhere' }}>
        {after === undefined ? (
          before
        ) : (
          <>
            {before} → <span style={{ color: afterColor }}>{after}</span>
          </>
        )}
      </span>
    </div>
  );
}

export default function AntimatterAccordionRow({
  symbol,
  icon,
  apy,
  staked,
  pendingBase,
  ratePerSecond,
  pending,
  antimatterSymbol,
  expanded,
  onToggle,
  tagline,
  tab,
  onTabChange,
  walletBalance,
  walletPhusd,
  walletAntimatter,
  stakeAmt,
  wdAmt,
  onStakeAmtChange,
  onWdAmtChange,
  onStake,
  onWithdraw,
  onAnnihilate,
}: AntimatterAccordionRowProps) {
  // ---- derived annihilation figures -------------------------------------
  const matched = Math.min(pending, staked);
  const receive = matched * 2;
  const leftover = pending - matched;
  // The epsilon matters: accrual makes exact equality unreachable, so a bare
  // `pending > staked` produces a phantom surplus line the instant the two
  // sides cross.
  const capped = pending > staked + 1e-9;

  const [pendingHead, pendingTail] = antimatterSplit(pending, 6);
  const [matchHead, matchTail] = antimatterSplit(matched, 6);
  const [receiveHead, receiveTail] = antimatterSplit(receive, 6);

  const stakeParsed = parseFloat(stakeAmt) || 0;
  const wdParsed = parseFloat(wdAmt) || 0;
  const canStake = stakeParsed > 0 && stakeParsed <= walletBalance;
  const canWd = wdParsed > 0 && wdParsed <= staked;
  const canAnn = matched > 0;

  const annLabel = !canAnn
    ? `Stake ${symbol} to accrue ${antimatterSymbol}`
    : capped
      ? `Annihilate ${fmtAmount(matched, 4)} ${antimatterSymbol} with ${fmtAmount(matched, 4)} staked ${symbol} → receive ${fmtAmount(receive, 4)} phUSD + ${fmtAmount(leftover, 4)} ${antimatterSymbol}`
      : `Annihilate ${fmtAmount(matched, 4)} ${antimatterSymbol} with ${fmtAmount(matched, 4)} staked ${symbol} → receive ${fmtAmount(receive, 4)} phUSD`;

  const disabledCls = 'opacity-40 cursor-not-allowed';

  return (
    <div
      className="mb-2.5 rounded-2xl border bg-white/[0.02] transition-colors"
      // Tinted lavender borders must be literal rgba: a Tailwind opacity
      // modifier on a full-hex token (`border-pxusd-purple-300/45`) compiles to
      // the invalid `rgb(#C4AEEA / 0.45)` and silently drops the border.
      style={{ borderColor: expanded ? 'rgba(196,174,234,.45)' : 'rgba(255,255,255,.12)' }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`${symbol} pool`}
        className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-4 text-left sm:grid-cols-[auto_1.1fr_0.9fr_1fr_auto]"
      >
        {/* min-w-0 lets this cell shrink instead of forcing the grid wider than
            the viewport — the same requirement StakeAccordionRow documents. */}
        <div className="flex min-w-0 items-center gap-3.5">
          <img src={icon} alt={symbol} className="h-9 w-9 rounded-full" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[16px] font-bold text-pxusd-white">{symbol}</span>
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] text-muted-foreground">
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                Earn
                <img src={antimatterIcon} alt="" aria-hidden="true" className="h-3.5 w-3.5 rounded-full" />
                <span className="font-semibold text-pxusd-purple-300">{antimatterSymbol}</span>
              </span>
              {/* The APY column is dropped below sm, so re-surface it inline. */}
              <span className="flex items-center gap-1.5 whitespace-nowrap sm:hidden">
                ·
                <span className="font-mono font-semibold text-pxusd-purple-300">{fmtAPY(apy)} APY</span>
              </span>
            </span>
          </div>
        </div>

        <div className="hidden flex-col gap-0.5 sm:flex">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">APY</span>
          <span className="font-mono text-[18px] font-bold text-pxusd-purple-300">{fmtAPY(apy)}</span>
        </div>

        <div className="hidden flex-col gap-0.5 sm:flex">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Your stake</span>
          <span className="font-mono text-[14px] font-semibold text-pxusd-white">
            {fmtAmount(staked, 4)}{' '}
            <span className="text-[12px] font-normal text-muted-foreground">{symbol}</span>
          </span>
        </div>

        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Pending</span>
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            <LiveYieldCounter
              ratePerSecond={ratePerSecond}
              initial={pendingBase}
              decimals={6}
              size={14}
              weight={600}
              accentColor={ANTIMATTER_ACCENT}
            />
            <span className="text-[12px] font-normal text-muted-foreground">{antimatterSymbol}</span>
          </span>
        </div>

        <Chevron expanded={expanded} />
      </button>

      {expanded && (
        <div className="border-t border-border px-5 pb-5 pt-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl<AntimatterSubTab>
              ariaLabel={`${symbol} pool action`}
              value={tab}
              onChange={onTabChange}
              options={[
                { value: 'stake', label: 'Stake' },
                { value: 'withdraw', label: 'Withdraw' },
                { value: 'annihilate', label: 'Annihilate' },
              ]}
            />
            <span className="text-[12px] text-muted-foreground">{tagline}</span>
          </div>

          {tab === 'stake' && (
            <div>
              <MockAmountField
                label="Stake amount"
                balanceLabel="Wallet"
                balance={walletBalance}
                value={stakeAmt}
                onChange={onStakeAmtChange}
                tokenSymbol={symbol}
                tokenIcon={icon}
              />
              <button
                type="button"
                onClick={onStake}
                disabled={!canStake}
                className={`phoenix-btn-primary w-full ${canStake ? '' : disabledCls}`}
              >
                Stake {symbol} → Earn {antimatterSymbol}
              </button>
            </div>
          )}

          {tab === 'withdraw' && (
            <div>
              <MockAmountField
                label="Withdraw amount"
                balanceLabel="Staked"
                balance={staked}
                value={wdAmt}
                onChange={onWdAmtChange}
                tokenSymbol={symbol}
                tokenIcon={icon}
              />
              <button
                type="button"
                onClick={onWithdraw}
                disabled={!canWd}
                className={`phoenix-btn-ghost w-full ${canWd ? '' : disabledCls}`}
              >
                Withdraw {symbol}
              </button>
            </div>
          )}

          {tab === 'annihilate' && (
            <div>
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
                    load-bearing, so the row stacks below `sm` with the `+` and
                    `=` glyphs kept as full-width separators rather than
                    dropping cells the way the app's tables do. */}
                <div className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
                  <PreviewCell
                    eyebrow={`${antimatterSymbol} accrued`}
                    eyebrowColor="#C4AEEA"
                    icon={antimatterIcon}
                    iconAlt="Antimatter"
                    head={pendingHead}
                    tail={pendingTail}
                    tailColor={ANTIMATTER_ACCENT}
                    caption="accruing every second"
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
                    caption="matched 1:1, then destroyed"
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
                    caption="the sum of both sides"
                    emphasised
                  />
                </div>

                <p className="mt-3.5 text-[12.5px] leading-[1.55] text-muted-foreground">
                  {ANTIMATTER_EXPLAINER_EVOCATIVE}
                </p>

                <div
                  className="mt-3.5 grid grid-cols-1 gap-y-2.5 border-t pt-3 text-[12.5px] sm:grid-cols-2 sm:gap-x-6"
                  style={{ borderColor: 'rgba(255,255,255,.1)' }}
                >
                  <SummaryLine
                    label={`Your ${symbol} stake after`}
                    before={fmtAmount(staked, 4)}
                    after={fmtAmount(staked - matched, 4)}
                    afterColor="#C4AEEA"
                  />
                  <SummaryLine
                    label={`Your ${antimatterSymbol} after`}
                    before={fmtAmount(pending, 4)}
                    after="0"
                    afterColor="#C4AEEA"
                  />
                  <SummaryLine
                    label="Your phUSD wallet balance"
                    before={fmtAmount(walletPhusd, 2)}
                    after={fmtAmount(walletPhusd + receive, 2)}
                    afterColor={PHUSD_ARROW_ACCENT}
                  />
                  {capped && (
                    <SummaryLine
                      label={`Your ${antimatterSymbol} wallet balance`}
                      before={fmtAmount(walletAntimatter, 4)}
                      after={fmtAmount(walletAntimatter + leftover, 4)}
                      afterColor="#C4AEEA"
                    />
                  )}
                  <SummaryLine label="Net value received" before={fmtUSD(receive - matched)} />
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
                      {fmtAmount(matched, 6)} {antimatterSymbol}
                    </span>{' '}
                    annihilates against your principal and the surplus{' '}
                    <span className="font-mono text-pxusd-white">
                      {fmtAmount(leftover, 6)} {antimatterSymbol}
                    </span>{' '}
                    is paid straight to your wallet as an ordinary claim.
                  </div>
                )}
              </div>

              {/* Standard Phoenix orange, not the mock's lavender gradient:
                  Antimatter's identity is carried by the accent on figures,
                  borders and the token pill, never by restyling buttons. The
                  label is long by design — it states the whole trade — so it
                  wraps rather than truncating on narrow screens. */}
              <button
                type="button"
                onClick={onAnnihilate}
                disabled={!canAnn}
                className={`phoenix-btn-primary w-full whitespace-normal text-left sm:text-center ${canAnn ? '' : disabledCls}`}
              >
                {annLabel}
              </button>
              <div className="mt-2.5 text-center text-[11.5px] text-muted-foreground">
                {ANTIMATTER_IRREVERSIBLE_NOTE(symbol)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
