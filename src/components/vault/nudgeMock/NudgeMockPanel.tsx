import { useMemo, useState } from 'react';
import type { Toast } from '../../../types/toast';
import {
  NUDGE_MOCK,
  NUDGE_MOCK_CYAN,
  type NudgeMockToken,
} from '../../../data/nudgeMockData';

type AddToast = (toast: Omit<Toast, 'id'>) => string;

export interface NudgeMockPanelProps {
  /** Toast dispatcher, used only for the stubbed "coming soon" CTA. */
  addToast: AddToast;
}

/**
 * Multi-token nudge reward banner — PURE MOCK, admin-only design preview.
 *
 * Renders the redesigned Whale Mint banner in which the single-token "Pot"
 * figure is replaced by a horizontally-scrolling strip of reward chips (the
 * NFT chip first, then one chip per reward token) plus an aggregate USD pot
 * value in the header.
 *
 * Everything here is driven by `src/data/nudgeMockData.ts`. There are
 * deliberately **no wagmi hooks, no `useReadContract`, no contract addresses**
 * — the multi-token nudge contracts (`nft-staking:022` / `:025`) are not
 * deployed. The CTA is stubbed with an informational toast.
 *
 * Unlike `WhaleMintPanel`, this panel never self-hides: it is a design preview
 * and must always render for an admin.
 *
 * Theme note: the `pxusd-*` colour tokens resolve to raw hex CSS variables, so
 * Tailwind opacity modifiers on them (`bg-pxusd-yellow-400/10`) emit no CSS at
 * all. Every translucent fill/border below therefore uses an explicit `rgba()`
 * arbitrary value or an inline style.
 */
/**
 * The pared-back pot the preview switch falls back to. Mock-only: it exists so
 * the chip strip can be eyeballed at two token counts (2 vs the full fixture).
 */
const MINIMAL_POT_SYMBOLS = ['USDC', 'KENDU'];

export default function NudgeMockPanel({ addToast }: NudgeMockPanelProps) {
  const {
    nftCount,
    nftCollectionName,
    mintCostFormatted,
    mintCostUsd,
    mintTokenLogo,
    whaleArt,
    tokens: allTokens,
  } = NUDGE_MOCK;

  // Design-review affordance, NOT product behaviour: swap between the full pot
  // and a two-leg pot so the chip strip can be eyeballed at both counts. The
  // switch lives outside the banner and disappears with the whole admin-gated
  // sub-tab — nothing here should survive into the wired version.
  const [showFullPot, setShowFullPot] = useState(true);
  const tokens = useMemo(
    () =>
      showFullPot
        ? allTokens
        : allTokens.filter((t) => MINIMAL_POT_SYMBOLS.includes(t.symbol)),
    [allTokens, showFullPot]
  );

  // The fixture ships the cost as one "<amount> <UNIT>" string. Split on the
  // last space so the amount can carry the big mono weight and the unit sits
  // beside it as a small suffix — matching the "$" the pot figure gets for
  // free. A cost string with no space degrades to amount-only, no unit.
  const [mintCostAmount, mintCostUnit] = useMemo(() => {
    const cut = mintCostFormatted.lastIndexOf(' ');
    return cut === -1
      ? [mintCostFormatted, '']
      : [mintCostFormatted.slice(0, cut), mintCostFormatted.slice(cut + 1)];
  }, [mintCostFormatted]);

  // Aggregate pot value is derived from the ordered token legs, never
  // hard-coded, so the figure stays honest if the fixture changes.
  const totalUsd = useMemo(
    () => tokens.reduce((sum, t) => sum + t.usd, 0),
    [tokens]
  );
  const totalUsdFormatted = `$${totalUsd.toLocaleString('en-US')}`;

  // Net cost = what you pay minus the sweetener, with the USD-stable payment
  // token valued at $1. The pot is an incentive, not arbitrage: it is expected
  // to be SMALLER than the mint cost, so this is normally positive. A pot worth
  // more than the mint would be a protocol mispricing rather than a normal
  // state, so it is surfaced as an explicit "net credit" instead of a
  // nonsensical negative cost.
  const netUsd = mintCostUsd - totalUsd;
  const isCredit = netUsd < 0;
  const netUsdFormatted = `$${Math.abs(netUsd).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const handleClaim = () => {
    addToast({
      type: 'info',
      title: 'Coming soon',
      description:
        'The multi-token nudge reward is a design preview — the contracts are not deployed yet.',
    });
  };

  return (
    <div className="mt-6" data-testid="nudge-mock-panel">
      {/* Preview-only control — sits outside the banner so it can never be
          mistaken for part of the design. */}
      <div className="flex items-center justify-end gap-2.5 mb-2">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Preview: full pot
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={showFullPot}
          aria-label={`Show the full reward pot instead of just ${MINIMAL_POT_SYMBOLS.join(
            ' + '
          )}`}
          onClick={() => setShowFullPot((on) => !on)}
          className="relative w-9 h-5 rounded-full transition-colors"
          style={{
            background: showFullPot
              ? NUDGE_MOCK_CYAN
              : 'rgba(255,255,255,0.18)',
          }}
          data-testid="nudge-mock-pot-size-switch"
        >
          <span
            className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
            style={{ left: showFullPot ? 18 : 2 }}
          />
        </button>
        <span
          className="font-mono text-[11px] tabular-nums text-muted-foreground w-[74px]"
          data-testid="nudge-mock-token-count"
        >
          {tokens.length} tokens
        </span>
      </div>

      <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr]">
          {/* Whale art */}
          <div
            className="grid place-items-center border-b sm:border-b-0 sm:border-r border-pxusd-teal-600 p-5"
            style={{
              background:
                'radial-gradient(ellipse at 50% 50%, #1a2440 0%, #050a14 75%)',
            }}
          >
            <img
              src={whaleArt}
              alt="Whale Phoenix"
              className="w-full aspect-square"
              style={{
                imageRendering: 'pixelated',
                filter: 'drop-shadow(0 0 18px oklch(60% 0.15 30 / 0.3))',
              }}
            />
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 flex flex-col gap-4 min-w-0">
            {/* Header: meta + aggregate pot value */}
            <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
              <div className="flex-1 min-w-0 basis-64">
                <div
                  className="flex items-center gap-2 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: NUDGE_MOCK_CYAN }}
                  data-testid="nudge-mock-eyebrow"
                >
                  <span
                    className="inline-block nudge-mock-dot"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: NUDGE_MOCK_CYAN,
                      boxShadow: `0 0 8px ${NUDGE_MOCK_CYAN}`,
                      flex: 'none',
                    }}
                  />
                  Whale Mint · Phoenix ×{nftCount}
                </div>
                <h2 className="m-0 mb-1.5 text-[22px] font-bold tracking-tight text-foreground">
                  Claim the nudge reward
                </h2>
                {/*
                  The explainer lives here rather than beside the CTA: it fills
                  the space the old "Pay … once" paragraph left behind, and the
                  footer collapses to a left-aligned button.
                */}
                <p
                  className="m-0 text-sm leading-relaxed text-muted-foreground max-w-[52ch]"
                  data-testid="nudge-mock-footer"
                >
                  NFTs can be used to claim yield from the yield funnel. On top
                  of the NFTs, you receive the entire pot of nudge reward
                  tokens, totaling {totalUsdFormatted}.
                </p>
              </div>

              {/*
                Cost, pot and net stack as line items on one side so they read
                as a subtraction: what you pay, less the sweetener, equals the
                real outlay. Same font and size throughout so the figures stay
                directly comparable; the rule above Net cost is the sum line.
              */}
              <div className="flex-none flex flex-col gap-2.5 min-w-[190px]">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
                    Mint cost
                  </div>
                  <div
                    className="flex items-baseline gap-1.5 font-mono text-[19px] font-semibold tracking-tight text-foreground leading-none tabular-nums"
                    data-testid="nudge-mock-mint-cost"
                  >
                    {mintCostAmount}
                    {mintCostUnit && (
                      <span className="text-[11px] font-sans font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        {mintCostUnit}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
                    Pot value
                  </div>
                  <div
                    className="flex items-baseline gap-1.5 font-mono text-[19px] font-semibold tracking-tight leading-none tabular-nums"
                    style={{ color: NUDGE_MOCK_CYAN }}
                    data-testid="nudge-mock-pot-total"
                  >
                    {totalUsdFormatted}
                  </div>
                </div>

                <div className="pt-2.5 border-t border-[rgba(255,255,255,0.12)]">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
                    {isCredit ? 'Net credit' : 'Net mint cost'}
                  </div>
                  <div
                    className="font-mono text-[19px] font-semibold tracking-tight text-foreground leading-none tabular-nums"
                    data-testid="nudge-mock-net-cost"
                  >
                    {netUsdFormatted}
                  </div>
                </div>
              </div>
            </div>

            {/*
              "You pay" mirrors the receive strip with a single payment-token
              chip, so the trade reads as two symmetrical rows rather than a
              reward list with the cost buried in a stat block. Pay sits ABOVE
              receive to match every swap UI (and the stat column's
              cost → pot → net order), and so the reward strip is the last
              thing read before the CTA.
            */}
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2.5">
                You pay
              </div>
              <div className="flex items-stretch">
                <div
                  className="flex-none flex items-center gap-2.5 rounded-[10px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] py-2.5 pl-2.5 pr-3.5"
                  data-testid="nudge-mock-chip-pay"
                >
                  {mintTokenLogo ? (
                    <img
                      src={mintTokenLogo}
                      alt=""
                      className="flex-none w-[26px] h-[26px] rounded-full object-cover bg-[#050a14]"
                    />
                  ) : (
                    <span
                      className="flex-none grid place-items-center w-[26px] h-[26px] rounded-full bg-[rgba(255,255,255,0.08)] text-[11px] font-bold uppercase text-foreground"
                      data-testid="nudge-mock-pay-logo-fallback"
                    >
                      {mintCostUnit.charAt(0)}
                    </span>
                  )}
                  <div className="flex flex-col gap-[3px]">
                    <span className="font-mono text-[15px] font-semibold leading-none text-foreground tabular-nums whitespace-nowrap">
                      {mintCostAmount}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground whitespace-nowrap">
                      {mintCostUnit}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* "You receive" strip */}
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2.5">
                You receive
              </div>

              {/*
                Chips wrap onto further rows rather than scrolling: at the
                widened desktop column the full pot nearly fits on one line,
                and a hidden overflow row is worse than a second visible one.
              */}
              <div
                className="flex flex-wrap items-stretch gap-2.5"
                data-testid="nudge-mock-chip-strip"
              >
                {/* NFT chip — visually distinguished with the cyan tint */}
                <div
                  className="flex-none flex items-center gap-2.5 rounded-[10px] border py-2.5 pl-2.5 pr-3.5"
                  style={{
                    borderColor: 'oklch(78% 0.13 220 / 0.45)',
                    background: 'oklch(78% 0.13 220 / 0.08)',
                  }}
                  data-testid="nudge-mock-chip-nft"
                >
                  <img
                    src={whaleArt}
                    alt=""
                    className="flex-none w-[26px] h-[26px] rounded-md object-cover bg-[#050a14]"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <div className="flex flex-col gap-[3px]">
                    <span className="font-mono text-[15px] font-semibold leading-none text-foreground tabular-nums whitespace-nowrap">
                      {nftCount} NFTs
                    </span>
                    <span
                      className="text-[10px] uppercase tracking-[0.08em] whitespace-nowrap"
                      style={{ color: NUDGE_MOCK_CYAN }}
                    >
                      {nftCollectionName}
                    </span>
                  </div>
                </div>

                {/*
                  One chip per reward token, in whitelist order. The `+` sits
                  BEFORE each token chip and after the always-present NFT chip,
                  so there is never a dangling separator — including the
                  single-token and empty-pot cases.
                */}
                {tokens.map((token: NudgeMockToken, index: number) => (
                  <div
                    key={`${token.symbol}-${index}`}
                    className="flex-none flex items-center gap-2.5"
                    data-testid={`nudge-mock-chip-${token.symbol}`}
                  >
                    <span
                      aria-hidden="true"
                      className="flex-none grid place-items-center w-3.5 text-[15px] font-semibold text-[rgba(240,245,248,0.45)]"
                    >
                      +
                    </span>
                    <div className="flex-none flex items-center gap-2.5 rounded-[10px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] py-2.5 pl-2.5 pr-3.5">
                      {token.logo ? (
                        <img
                          src={token.logo}
                          alt=""
                          className="flex-none w-[26px] h-[26px] rounded-full object-cover bg-[#050a14]"
                        />
                      ) : (
                        // Lettered-circle fallback. Unused by the fixture (all
                        // five tokens ship real art) but required once the
                        // live version hits whitelisted tokens with no
                        // bundled logo.
                        <span
                          className="flex-none grid place-items-center w-[26px] h-[26px] rounded-full bg-[rgba(255,255,255,0.08)] text-[11px] font-bold uppercase text-foreground"
                          data-testid={`nudge-mock-logo-fallback-${token.symbol}`}
                        >
                          {token.symbol.charAt(0)}
                        </span>
                      )}
                      <div className="flex flex-col gap-[3px]">
                        <span className="font-mono text-[15px] font-semibold leading-none text-foreground tabular-nums whitespace-nowrap">
                          {token.amountFormatted}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground whitespace-nowrap">
                          {token.symbol}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer CTA — the explainer moved up into the header block. */}
            <div className="flex flex-wrap items-center gap-3.5 pt-4 border-t border-[rgba(255,255,255,0.12)]">
              <button
                type="button"
                onClick={handleClaim}
                className="phoenix-btn-primary whitespace-nowrap !rounded-md !text-[13px]"
                data-testid="nudge-mock-cta"
              >
                Mint {nftCount} — Claim Reward
              </button>
            </div>
          </div>
        </div>
      </div>

      {/*
        Component-local styles so we don't touch global CSS: the eyebrow pulse
        keyframes. (The chip strip's custom scrollbar went away with the switch
        from horizontal scrolling to wrapping.)
      */}
      <style>{`
        @keyframes nudge-mock-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.4); }
        }
        .nudge-mock-dot {
          animation: nudge-mock-pulse 1.6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
