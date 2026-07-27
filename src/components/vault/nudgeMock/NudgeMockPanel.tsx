import { useMemo } from 'react';
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
export default function NudgeMockPanel({ addToast }: NudgeMockPanelProps) {
  const { nftCount, nftCollectionName, mintCostFormatted, whaleArt, tokens } =
    NUDGE_MOCK;

  // Aggregate pot value is derived from the ordered token legs, never
  // hard-coded, so the figure stays honest if the fixture changes.
  const totalUsdFormatted = useMemo(() => {
    const total = tokens.reduce((sum, t) => sum + t.usd, 0);
    return `$${total.toLocaleString('en-US')}`;
  }, [tokens]);

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
                <p className="m-0 text-sm leading-relaxed text-muted-foreground max-w-[52ch]">
                  Pay{' '}
                  <span className="font-mono text-[0.93em] font-semibold text-foreground whitespace-nowrap tabular-nums">
                    {mintCostFormatted}
                  </span>{' '}
                  once. You keep all {nftCount} {nftCollectionName} NFTs{' '}
                  <em className="not-italic text-[rgba(240,245,248,0.85)]">
                    and
                  </em>{' '}
                  the
                  whole reward pot — one transaction.
                </p>
              </div>

              <div className="flex-none min-w-[110px]">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
                  Pot value
                </div>
                <div
                  className="font-mono text-2xl font-semibold tracking-tight text-foreground leading-none tabular-nums"
                  data-testid="nudge-mock-pot-total"
                >
                  ≈ {totalUsdFormatted}
                </div>
              </div>
            </div>

            {/* "You receive" strip */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5 mb-2.5">
                <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  You receive
                </span>
                <span
                  className="text-[10px] tracking-[0.06em] whitespace-nowrap rounded-full px-2 py-0.5 bg-[rgba(255,255,255,0.07)] text-muted-foreground"
                  data-testid="nudge-mock-receive-pill"
                >
                  {nftCount} NFTs + ERC20 token reward pot
                </span>
              </div>

              <div
                className="nudge-mock-strip flex items-stretch gap-2.5 overflow-x-auto pb-1.5"
                style={{ scrollSnapType: 'x proximity' }}
                data-testid="nudge-mock-chip-strip"
              >
                {/* NFT chip — visually distinguished with the cyan tint */}
                <div
                  className="flex-none flex items-center gap-2.5 rounded-[10px] border py-2.5 pl-2.5 pr-3.5"
                  style={{
                    scrollSnapAlign: 'start',
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
                    style={{ scrollSnapAlign: 'start' }}
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

            {/* Footer explainer + CTA */}
            <div className="flex flex-wrap items-center justify-between gap-3.5 pt-4 border-t border-[rgba(255,255,255,0.12)]">
              <div
                className="flex-1 basis-60 min-w-0 text-xs leading-relaxed text-muted-foreground"
                data-testid="nudge-mock-footer"
              >
                {nftCount} NFTs can be used to claim yield from the yield
                funnel. On top of the NFTs, you receive the entire pot of nudge
                reward tokens, totaling {totalUsdFormatted}.
              </div>
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
        keyframes and the thin custom scrollbar for the chip strip (the
        ::-webkit-scrollbar pseudo-elements have no Tailwind utility).
      */}
      <style>{`
        @keyframes nudge-mock-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.4); }
        }
        .nudge-mock-dot {
          animation: nudge-mock-pulse 1.6s ease-in-out infinite;
        }
        .nudge-mock-strip::-webkit-scrollbar {
          height: 5px;
        }
        .nudge-mock-strip::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,.18);
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
}
