import { useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import {
  WHALE_ART,
  WHALE_DISCOUNT_CYAN,
  WHALE_PAYMENT_LOGO,
} from '../../../data/nudgeTokenMeta';
import { useNudgePot } from '../../../hooks/useNudgePot';
import {
  useLiveNudgePot,
  type LiveNudgeToken,
} from '../../../hooks/useLiveNudgePot';
import WhaleDiscountConfirmModal from './WhaleDiscountConfirmModal';

/** Collection the whale batch mint buys. Priced in USDS. */
const NFT_COLLECTION_NAME = 'Liquid Sky Phoenix';
const PAYMENT_SYMBOL = 'USDS';

/**
 * Whale Discount banner — the live multi-token nudge reward.
 *
 * Everything on this panel is read from chain via `useNudgePot`: the reward
 * token set comes from `BatchNFTMinterMultiToken.getNudgeTokens()`, and the
 * mint cost is the exact geometric price ramp `batchMint` will charge.
 * Switching networks re-reads that chain's whitelist, so the chip strip adapts
 * with no code change.
 *
 * Each reward amount is what a mint pays out *now*: the minter's settled
 * balance plus the NudgeStreamer's accrued-but-unsettled stream, which
 * `batchMint` flushes into the pot before it snapshots. Since the streamer
 * meters in every second, `useLiveNudgePot` counts the figures forward between
 * polls instead of letting them jump on refetch.
 *
 * USD figures ("Pot value", "Net mint cost") mix three price sources — $1 for
 * USD stablecoins, the Balancer phUSD spot, and a CoinGecko KENDU quote — see
 * `useNudgePot`. A whitelisted token we cannot price still renders its chip
 * with its amount; it is just left out of the USD total.
 *
 * Theme note: the `pxusd-*` colour tokens resolve to raw hex CSS variables, so
 * Tailwind opacity modifiers on them (`bg-pxusd-yellow-400/10`) emit no CSS at
 * all. Every translucent fill/border below therefore uses an explicit `rgba()`
 * arbitrary value or an inline style.
 */
export default function WhaleDiscountPanel() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const {
    tokens,
    nudgeSizeRaw,
    count,
    payment,
    mintCostRaw,
    mintBudgetRaw,
    mintCostUsd,
    hasReward,
    isLoading,
    isUnavailable,
    readAtMs,
    refetch,
  } = useNudgePot();

  // The pot keeps filling between polls — the streamer meters into it every
  // second — so the displayed figures are carried forward from the last read
  // rather than sitting still until the next one. Display only: the modal
  // still signs the block-attested `tokens`.
  const { tokens: liveTokens, potUsd } = useLiveNudgePot(tokens, readAtMs);

  // A whitelisted token with nothing in the pot pays out nothing, so its chip
  // is noise — and a "+ 0 KENDU" leg reads as a broken feed rather than as an
  // empty one. Display only: `tokens` is still passed to the modal whole,
  // because `minRewards` is positional over the full whitelist.
  const visibleTokens = useMemo(
    () => liveTokens.filter((token) => token.liveTotalRaw > 0n),
    [liveTokens]
  );

  // The mint cost is displayed to 4dp to match the mint list's Liquid Sky
  // Phoenix row, while the USD figures below stay at 2dp — they are dollars,
  // not token units. Scaled by the PAYMENT token's decimals, which come from
  // the dispatcher the minter is pinned to rather than being assumed to be 18.
  const mintCostAmount = useMemo(
    () =>
      Number(
        formatUnits(mintCostRaw, payment?.decimals ?? 18)
      ).toLocaleString('en-US', {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      }),
    [mintCostRaw, payment?.decimals]
  );

  // Plain figures, no ≥/≤ qualifiers. An unpriced leg is left out of the total
  // (see `useNudgePot`), so these are strictly a lower bound on the pot and an
  // upper bound on the net cost — but the symbols read as an error state rather
  // than as precision, and the per-token chips already show what is in the pot.
  const potUsdFormatted = `$${potUsd.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  // Net cost = what you pay minus the sweetener. The pot is an incentive, not
  // arbitrage: it is expected to be SMALLER than the mint cost, so this is
  // normally positive. A pot worth more than the mint would be a protocol
  // mispricing rather than a normal state, so it is surfaced as an explicit
  // "net credit" instead of a nonsensical negative cost.
  //
  // `mintCostUsd` is null when the payment token has no USD price, in which
  // case there is no honest subtraction to show and the row reads "—".
  const netUsd = mintCostUsd === null ? null : mintCostUsd - potUsd;
  const isCredit = netUsd !== null && netUsd < 0;
  const netUsdFormatted =
    netUsd === null
      ? '—'
      : `$${Math.abs(netUsd).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

  if (isUnavailable) {
    return (
      <div className="mt-6" data-testid="whale-discount-panel">
        <div
          className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-6 text-sm text-muted-foreground"
          data-testid="whale-discount-unavailable"
        >
          The multi-token nudge minter is not deployed on this network, so there
          is no whale discount to show here.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mt-6" data-testid="whale-discount-panel">
        <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg overflow-hidden">
          <div
            className="p-6 grid place-items-center text-xs uppercase tracking-[0.22em] text-muted-foreground"
            data-testid="whale-discount-skeleton"
          >
            <span>
              <span
                className="inline-block whale-discount-dot mr-2"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: WHALE_DISCOUNT_CYAN,
                  boxShadow: `0 0 8px ${WHALE_DISCOUNT_CYAN}`,
                }}
              />
              Loading Whale Discount…
            </span>
          </div>
        </div>
        <style>{`
          @keyframes whale-discount-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(1.4); }
          }
          .whale-discount-dot {
            animation: whale-discount-pulse 1.6s ease-in-out infinite;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="mt-6" data-testid="whale-discount-panel">
      <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr]">
          {/* Whale art + explainer */}
          {/*
            Seam handling. The art PNG is opaque RGB with a baked-in near-black
            (~#070507) background, so its square edge used to butt straight up
            against the teal panel with a hard divider rule on top of it —
            reading as a stark black border. Two changes feather it away:

              1. The column gradient now resolves to the panel's own teal at its
                 outer edge instead of stopping at near-black, and the divider
                 border is gone. The column dissolves into the body rather than
                 being fenced off from it.
              2. The image gets a radial alpha mask so its own black backdrop
                 fades out before the column edge, instead of ending on a hard
                 rectangle. The fade only bites the outer ~quarter of the
                 radius, where the art is sparse embers on black.
          */}
          <div
            className="flex flex-col items-center gap-3.5 p-5"
            style={{
              background:
                'radial-gradient(ellipse at 50% 42%, #1a2440 0%, #050a14 55%, #0a1823 80%, var(--pxusd-teal-700) 100%)',
            }}
          >
            <img
              src={WHALE_ART}
              alt="Whale Phoenix"
              className="w-full aspect-square"
              style={{
                imageRendering: 'pixelated',
                filter: 'drop-shadow(0 0 18px oklch(60% 0.15 30 / 0.3))',
                WebkitMaskImage:
                  'radial-gradient(ellipse at 50% 50%, #000 62%, transparent 100%)',
                maskImage:
                  'radial-gradient(ellipse at 50% 50%, #000 62%, transparent 100%)',
              }}
            />
            {/*
              The explainer sits under the art rather than beside the heading:
              the art column has spare height below a square image, and moving
              the copy there lets the body column collapse to the numbers, which
              is most of the banner's height saving.
            */}
            <p
              className="m-0 text-[16px] leading-[1.6] text-muted-foreground text-justify hyphens-auto"
              data-testid="whale-discount-footer"
            >
              NFTs can be used to claim yield from the yield funnel. On top of
              the NFTs, you receive the entire pot of nudge reward tokens,
              totaling {potUsdFormatted}.
            </p>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 flex flex-col gap-4 min-w-0">
            {/*
              Heading + "You pay" share a column so the stat stack can sit
              beside BOTH of them, bottom-aligned: the figures then land just
              above the "You receive" strip rather than floating up next to the
              heading, and the two blocks overlap vertically instead of
              stacking — which is where the remaining height saving comes from.
            */}
            <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-4">
              <div className="flex-1 min-w-0 basis-64 flex flex-col gap-4">
                <div
                  className="flex items-center gap-2 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: WHALE_DISCOUNT_CYAN }}
                  data-testid="whale-discount-eyebrow"
                >
                  <span
                    className="inline-block whale-discount-dot"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: WHALE_DISCOUNT_CYAN,
                      boxShadow: `0 0 8px ${WHALE_DISCOUNT_CYAN}`,
                      flex: 'none',
                    }}
                  />
                  Whale Mint · Phoenix ×{count}
                </div>
                <h2 className="m-0 text-[22px] font-bold tracking-tight text-foreground">
                  Claim the nudge reward
                </h2>

                {/*
                  "You pay" mirrors the receive strip with a single
                  payment-token chip, so the trade reads as two symmetrical
                  rows rather than a reward list with the cost buried in a stat
                  block. Pay sits ABOVE receive to match every swap UI (and the
                  stat column's cost → pot → net order), and so the reward
                  strip is the last thing read before the CTA.
                */}
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2.5">
                    You pay
                  </div>
                  <div className="flex items-stretch">
                    <div
                      className="flex-none flex items-center gap-2.5 rounded-[10px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] py-2.5 pl-2.5 pr-3.5"
                      data-testid="whale-discount-chip-pay"
                    >
                      <img
                        src={payment?.logo ?? WHALE_PAYMENT_LOGO}
                        alt=""
                        className="flex-none w-[26px] h-[26px] rounded-full object-cover bg-[#050a14]"
                      />
                      <div className="flex flex-col gap-[3px]">
                        <span className="font-mono text-[15px] font-semibold leading-none text-foreground tabular-nums whitespace-nowrap">
                          {mintCostAmount}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground whitespace-nowrap">
                          {payment?.symbol ?? PAYMENT_SYMBOL}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/*
                Cost, pot and net stack as line items on one side so they read
                as a subtraction: what you pay, less the sweetener, equals the
                real outlay. Same font and size throughout so the figures stay
                directly comparable; the rule above Net cost is the sum line.
              */}
              <div className="flex-none flex flex-col gap-2 min-w-[190px]">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
                    Mint cost
                  </div>
                  <div
                    className="flex items-baseline gap-1.5 font-mono text-[19px] font-semibold tracking-tight text-foreground leading-none tabular-nums"
                    data-testid="whale-discount-mint-cost"
                  >
                    {mintCostAmount}
                    <span className="text-[11px] font-sans font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      {payment?.symbol ?? PAYMENT_SYMBOL}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
                    Pot value
                  </div>
                  <div
                    className="flex items-baseline gap-1.5 font-mono text-[19px] font-semibold tracking-tight leading-none tabular-nums"
                    style={{ color: WHALE_DISCOUNT_CYAN }}
                    data-testid="whale-discount-pot-total"
                  >
                    {potUsdFormatted}
                  </div>
                </div>

                <div className="pt-2.5 border-t border-[rgba(255,255,255,0.12)]">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
                    {isCredit ? 'Net credit' : 'Net mint cost'}
                  </div>
                  <div
                    className="font-mono text-[19px] font-semibold tracking-tight text-foreground leading-none tabular-nums"
                    data-testid="whale-discount-net-cost"
                  >
                    {netUsdFormatted}
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
                data-testid="whale-discount-chip-strip"
              >
                {/* NFT chip — visually distinguished with the cyan tint */}
                <div
                  className="flex-none flex items-center gap-2.5 rounded-[10px] border py-2.5 pl-2.5 pr-3.5"
                  style={{
                    borderColor: 'oklch(78% 0.13 220 / 0.45)',
                    background: 'oklch(78% 0.13 220 / 0.08)',
                  }}
                  data-testid="whale-discount-chip-nft"
                >
                  <img
                    src={WHALE_ART}
                    alt=""
                    className="flex-none w-[26px] h-[26px] rounded-md object-cover bg-[#050a14]"
                    style={{ imageRendering: 'pixelated' }}
                  />
                  <div className="flex flex-col gap-[3px]">
                    <span className="font-mono text-[15px] font-semibold leading-none text-foreground tabular-nums whitespace-nowrap">
                      {count} NFTs
                    </span>
                    <span
                      className="text-[10px] uppercase tracking-[0.08em] whitespace-nowrap"
                      style={{ color: WHALE_DISCOUNT_CYAN }}
                    >
                      {NFT_COLLECTION_NAME}
                    </span>
                  </div>
                </div>

                {/*
                  One chip per reward token, in on-chain whitelist order. The
                  `+` sits BEFORE each token chip and after the always-present
                  NFT chip, so there is never a dangling separator — including
                  the single-token and empty-pot cases.
                */}
                {visibleTokens.map((token: LiveNudgeToken, index: number) => {
                  const href = token.url?.trim() ? token.url.trim() : undefined;

                  const logo = token.logo ? (
                    <img
                      src={token.logo}
                      alt=""
                      className="flex-none w-[26px] h-[26px] rounded-full object-cover bg-[#050a14]"
                    />
                  ) : (
                    // Lettered-circle fallback for a whitelisted token we have
                    // no bundled art for — the expected case once the owner
                    // adds a token we have not shipped a logo for.
                    <span
                      className="flex-none grid place-items-center w-[26px] h-[26px] rounded-full bg-[rgba(255,255,255,0.08)] text-[11px] font-bold uppercase text-foreground"
                      data-testid={`whale-discount-logo-fallback-${token.canonical}`}
                    >
                      {token.symbol.charAt(0)}
                    </span>
                  );

                  const chipBody = (
                    <>
                      {/*
                        Linked chips spin their logo like a flipping coin. The
                        stagger keeps several chips from flipping in unison,
                        which reads as a glitch rather than as an invitation.
                      */}
                      {href ? (
                        <span
                          className="flex-none whale-discount-flip"
                          style={{ animationDelay: `${index * 0.45}s` }}
                        >
                          {logo}
                        </span>
                      ) : (
                        logo
                      )}
                      <div className="flex flex-col gap-[3px]">
                        <span
                          className="font-mono text-[15px] font-semibold leading-none text-foreground tabular-nums whitespace-nowrap"
                          data-testid={`whale-discount-amount-${token.canonical}`}
                        >
                          {token.liveAmountFormatted}
                        </span>
                        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground whitespace-nowrap">
                          {token.symbol}
                          {/*
                            A streaming leg is mostly money that has not landed
                            in the minter's balance yet, so the chip says so
                            rather than letting a silently-climbing number look
                            like a rendering glitch.
                          */}
                          {token.isStreaming && (
                            <span
                              className="inline-block whale-discount-dot"
                              style={{
                                width: 4,
                                height: 4,
                                borderRadius: '50%',
                                background: WHALE_DISCOUNT_CYAN,
                                boxShadow: `0 0 6px ${WHALE_DISCOUNT_CYAN}`,
                              }}
                              title={`${token.symbol}: ${formatUnits(
                                token.balanceRaw,
                                token.decimals
                              )} in the pot + ${formatUnits(
                                token.livePendingRaw,
                                token.decimals
                              )} streamed in and claimed on mint`}
                              data-testid={`whale-discount-streaming-${token.canonical}`}
                            />
                          )}
                        </span>
                      </div>
                      {/* Sheen — a skewed highlight that sweeps across the
                          chip on the same slow cycle as the flip. Purely
                          decorative and clipped by the chip's own radius. */}
                      {href && (
                        <span
                          aria-hidden="true"
                          className="whale-discount-sheen"
                          style={{ animationDelay: `${index * 0.45}s` }}
                        />
                      )}
                    </>
                  );

                  const chipClass =
                    'flex-none flex items-center gap-2.5 rounded-[10px] border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.03)] py-2.5 pl-2.5 pr-3.5';

                  return (
                    <div
                      key={token.address}
                      className="flex-none flex items-center gap-2.5"
                      data-testid={`whale-discount-chip-${token.canonical}`}
                    >
                      <span
                        aria-hidden="true"
                        className="flex-none grid place-items-center w-3.5 text-[15px] font-semibold text-[rgba(240,245,248,0.45)]"
                      >
                        +
                      </span>
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${token.symbol} — open token page in a new tab`}
                          className={`${chipClass} relative overflow-hidden no-underline cursor-pointer transition-colors hover:border-[rgba(255,255,255,0.3)] hover:bg-[rgba(255,255,255,0.07)]`}
                          data-testid={`whale-discount-chip-link-${token.canonical}`}
                        >
                          {chipBody}
                        </a>
                      ) : (
                        <div className={chipClass}>{chipBody}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer CTA — the explainer moved up into the header block. */}
            <div className="flex flex-wrap items-center gap-3.5 pt-4 border-t border-[rgba(255,255,255,0.12)]">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                disabled={!hasReward || mintCostRaw === 0n}
                className="phoenix-btn-primary whitespace-nowrap !rounded-md !text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="whale-discount-cta"
              >
                Mint {count} — Claim Reward
              </button>
              {!hasReward && (
                <span
                  className="text-xs text-muted-foreground"
                  data-testid="whale-discount-empty-pot"
                >
                  The nudge pot is currently empty.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/*
        Component-local styles so we don't touch global CSS: the eyebrow pulse
        plus the linked-chip affordances (sheen sweep + coin flip). Both of the
        latter run on the same 3s cycle with most of it spent idle, so a chip
        catches the eye every few seconds without ever being busy. Motion is
        dropped entirely under `prefers-reduced-motion` — the anchor, hover
        state and cursor still carry the affordance.
      */}
      <style>{`
        @keyframes whale-discount-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.4); }
        }
        .whale-discount-dot {
          animation: whale-discount-pulse 1.6s ease-in-out infinite;
        }

        @keyframes whale-discount-sheen-sweep {
          0%      { transform: translateX(-160%) skewX(-20deg); opacity: 0; }
          8%      { opacity: 1; }
          32%     { transform: translateX(160%) skewX(-20deg); opacity: 0; }
          100%    { transform: translateX(160%) skewX(-20deg); opacity: 0; }
        }
        .whale-discount-sheen {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          width: 55%;
          pointer-events: none;
          background: linear-gradient(
            100deg,
            transparent 0%,
            rgba(255,255,255,0.05) 35%,
            rgba(255,255,255,0.30) 50%,
            rgba(255,255,255,0.05) 65%,
            transparent 100%
          );
          animation: whale-discount-sheen-sweep 3s ease-in-out infinite;
        }

        @keyframes whale-discount-coin-flip {
          0%      { transform: rotateY(0deg); }
          30%     { transform: rotateY(360deg); }
          100%    { transform: rotateY(360deg); }
        }
        .whale-discount-flip {
          display: inline-grid;
          transform-style: preserve-3d;
          animation: whale-discount-coin-flip 3s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .whale-discount-sheen { display: none; }
          .whale-discount-flip { animation: none; }
        }
      `}</style>

      {nudgeSizeRaw !== undefined && payment && (
        <WhaleDiscountConfirmModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          count={count}
          payment={payment}
          mintCostRaw={mintCostRaw}
          mintBudgetRaw={mintBudgetRaw}
          tokens={tokens}
          nudgeSizeRaw={nudgeSizeRaw}
          readAtMs={readAtMs}
          refetchPot={refetch}
        />
      )}
    </div>
  );
}
