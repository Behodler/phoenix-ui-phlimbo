import { useMemo } from 'react';
import { formatUnits } from 'viem';
import {
  WHALE_ART,
  WHALE_DISCOUNT_CYAN,
  WHALE_PAYMENT_LOGO,
} from '../../../data/nudgeTokenMeta';
import {
  useDiscountBatchMinter,
  type DiscountBatchBlocker,
  type DiscountBatchPhase,
} from '../../../hooks/useDiscountBatchMinter';
import { computeDiscountDisplay } from '../../../utils/discountBatchMath';

const NFT_COLLECTION_NAME = 'Liquid Sky Phoenix';

/** Translucent cyan fills, as literal colours (Tailwind opacity modifiers on hex tokens emit no CSS). */
const CYAN_BORDER = 'oklch(78% 0.13 220 / 0.45)';
const CYAN_FILL = 'oklch(78% 0.13 220 / 0.08)';
const BOOST_FILL = 'oklch(78% 0.13 220 / 0.16)';

function formatUsds(raw: bigint, decimals: number): string {
  return Number(formatUnits(raw, decimals)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatUsd(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function ctaLabel(
  blocker: DiscountBatchBlocker,
  phase: DiscountBatchPhase,
  symbol: string,
  readyLabel: string
): string {
  if (phase === 'checking') return 'Checking batch…';
  if (phase === 'approving') return `Approving ${symbol}…`;
  if (phase === 'minting') return 'Minting…';
  switch (blocker) {
    case 'paused':
      return 'Minting paused';
    case 'no-discount':
      return 'Mint';
    case 'disconnected':
      return 'Connect wallet to mint';
    case 'insufficient-balance':
      return `Insufficient ${symbol}`;
    default:
      return readyLabel;
  }
}

/** Keyframes for the pulsing dot and boost glow, shared by the loading card and the full panel. */
function PanelStyles() {
  return (
    <style>{`
        @keyframes whale-mock-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.4); }
        }
        .whale-mock-dot {
          animation: whale-mock-pulse 1.6s ease-in-out infinite;
        }
        @keyframes whale-mock-boost-glow {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.25); }
        }
        .whale-mock-boost {
          animation: whale-mock-boost-glow 2.4s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .whale-mock-dot, .whale-mock-boost { animation: none; }
        }
    `}</style>
  );
}

/**
 * The pulsing-dot card shown until the batch can be quoted. It also covers a
 * zero-address minter, which is what a disconnected wallet sees: wagmi falls
 * back to mainnet, where the minter is a placeholder until the cutover.
 */
function LoadingCard() {
  return (
    <div className="mt-6" data-testid="whale-mock-panel">
      <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg overflow-hidden">
        <div
          className="p-6 grid place-items-center text-xs uppercase tracking-[0.22em] text-muted-foreground"
          data-testid="whale-mock-skeleton"
        >
          <span>
            <span
              className="inline-block whale-mock-dot mr-2"
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
      <PanelStyles />
    </div>
  );
}

/**
 * Whale Discount — public NFT sub-tab for the nft-staking
 * `BatchNFTMinterNudgeDiscount` batch mint, wired to the live contract.
 *
 * Every batch figure comes from `previewBatch()` / `previewBoost()` via
 * `useDiscountBatchMinter`; only the usual price, the saving and the unboosted
 * comparison are computed here (`computeDiscountDisplay`), from the live
 * index-4 price ramp. There is no mock fallback.
 *
 * The discount is the message: quantity at a discount, usual price vs
 * discount price, and the saving. The bonus tokens the batch also pays out
 * (`bonus`, from `useDiscountBonusTokens` via the batch hook) are listed under the quantity, hidden when there
 * are none. The fund's size is shown as a plain figure next to the
 * explanation that it is never paid out.
 */
export default function WhaleMockPanel() {
  const { status, quote, config, fund, bonus, payment, maxPaymentRaw, blocker, phase, mint } =
    useDiscountBatchMinter();

  const display = useMemo(
    () =>
      quote && config && payment
        ? computeDiscountDisplay({
          free: quote.free,
          total: quote.total,
          paidCostRaw: quote.paidCostRaw,
          discountPercent: config.discountPercent,
          priceRaw: payment.priceRaw,
          growthBps: payment.growthBps,
        })
        : undefined,
    [quote, config, payment]
  );

  if (status === 'unavailable' || status === 'loading' || !quote || !config || !payment || !display) {
    return <LoadingCard />;
  }

  const PAYMENT_SYMBOL = payment.symbol;
  const decimals = payment.decimals;
  const ready = status === 'ready';
  const d = config.discountPercent;
  const usualCost = formatUsds(display.usualCostRaw, decimals);
  const paidCost = formatUsds(quote.paidCostRaw, decimals);
  const saving = formatUsds(display.savingRaw, decimals);
  const usualPerNft = formatUsds(payment.priceRaw, decimals);
  const avgPerNft = formatUsds(display.avgPricePaidRaw, decimals);
  const maxPayment = formatUsds(maxPaymentRaw, decimals);
  const savingPercent =
    display.usualCostRaw > 0n
      ? (Number((display.savingRaw * 10_000n) / display.usualCostRaw) / 100).toFixed(1)
      : '0.0';
  const boostDelta = formatUsds(
    display.unboostedPaidCostRaw > quote.paidCostRaw
      ? display.unboostedPaidCostRaw - quote.paidCostRaw
      : 0n,
    decimals
  );
  const capReached = ready && quote.free >= config.maxFreePerBatch;
  const boosted = ready && quote.boost > 0;

  const amountWithSymbol = (amount: string) => (
    <>
      <img
        src={WHALE_PAYMENT_LOGO}
        alt=""
        className="flex-none w-[18px] h-[18px] rounded-full object-cover bg-[#050a14] self-center"
      />
      {amount}
      <span className="text-[11px] font-sans font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {PAYMENT_SYMBOL}
      </span>
    </>
  );

  return (
    <div className="mt-6" data-testid="whale-mock-panel">
      <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr]">
          {/* Art column + explainer (same seam feathering as Whale Discount). */}
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
            {/* 7. Explainer — the fund is described qualitatively only. */}
            <div
              className="m-0 text-[14px] leading-[1.6] text-muted-foreground flex flex-col gap-2"
              data-testid="whale-mock-explainer"
            >
              <p className="m-0">
                Protocol yield flows into a discount fund. Each time the fund
                grows enough to cover another NFT, the next batch gets bigger:
                more NFTs at the discount.
              </p>
              {capReached && (
                <p className="m-0" data-testid="whale-mock-cap-sentence">
                  This batch has hit the {config.maxFreePerBatch}-NFT limit.
                  {config.maxBoost > 0 ? (
                    <>
                      {' '}Extra funding carries over and raises the discount by 1
                      point for every {config.overflowNFTsPerBoostPoint} NFTs'
                      worth, up to +{config.maxBoost}%.
                    </>
                  ) : (
                    <> Extra funding carries over to the next batch.</>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 flex flex-col gap-4 min-w-0">
            {ready ? (
              <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-4">
                <div className="flex-1 min-w-0 basis-64 flex flex-col gap-4">
                  {/* 2. Eyebrow + headline */}
                  <div
                    className="flex items-center gap-2 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: WHALE_DISCOUNT_CYAN }}
                  >
                    <span
                      className="inline-block whale-mock-dot"
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: WHALE_DISCOUNT_CYAN,
                        boxShadow: `0 0 8px ${WHALE_DISCOUNT_CYAN}`,
                        flex: 'none',
                      }}
                    />
                    Whale Mint · {NFT_COLLECTION_NAME}
                  </div>
                  <h2
                    className="m-0 text-[22px] font-bold tracking-tight text-foreground"
                    data-testid="whale-mock-headline"
                  >
                    {quote.total} NFTs at {quote.effectivePercent}% off
                  </h2>

                  {/* 3. Discount badge (+ boost) */}
                  <div
                    className="self-start flex flex-wrap items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold"
                    style={{ borderColor: CYAN_BORDER, background: CYAN_FILL, color: WHALE_DISCOUNT_CYAN }}
                    data-testid="whale-mock-discount"
                  >
                    {boosted ? (
                      <>
                        <span>{d}%</span>
                        <span aria-hidden="true">+</span>
                        <span
                          className="rounded-full px-2 py-0.5 text-foreground whale-mock-boost"
                          style={{ background: BOOST_FILL, boxShadow: `0 0 10px ${CYAN_BORDER}` }}
                          data-testid="whale-mock-boost-badge"
                        >
                          {quote.boost}% boost
                        </span>
                        <span aria-hidden="true">=</span>
                        <span>{quote.effectivePercent}% discount</span>
                      </>
                    ) : (
                      <span>{d}% discount</span>
                    )}
                  </div>

                  {/* 5. Quantity chip */}
                  <div className="min-w-0">
                    <div
                      className="self-start inline-flex items-center gap-2.5 rounded-[10px] border py-2.5 pl-2.5 pr-3.5"
                      style={{ borderColor: CYAN_BORDER, background: CYAN_FILL }}
                      data-testid="whale-mock-quantity"
                    >
                      <img
                        src={WHALE_ART}
                        alt=""
                        className="flex-none w-[26px] h-[26px] rounded-md object-cover bg-[#050a14]"
                        style={{ imageRendering: 'pixelated' }}
                      />
                      <div className="flex flex-col gap-[3px]">
                        <span className="font-mono text-[15px] font-semibold leading-none text-foreground tabular-nums whitespace-nowrap">
                          {quote.total} × {NFT_COLLECTION_NAME}
                        </span>
                        <span
                          className="text-[10px] tracking-[0.04em] whitespace-nowrap text-muted-foreground"
                          data-testid="whale-mock-split"
                        >
                          {quote.free} covered by the discount fund · {quote.paid} paid
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 5b. Bonus tokens paid out with the batch (hidden when none). */}
                  {bonus.tokens.length > 0 && (
                    <div className="flex flex-col gap-2" data-testid="whale-mock-bonus">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Plus bonus tokens
                        {bonus.usdTotal > 0 && (
                          <span className="text-foreground" data-testid="whale-mock-bonus-total">
                            {' '}· {bonus.isPartial ? '≥ ' : '≈ '}
                            {formatUsd(bonus.usdTotal)}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {bonus.tokens.map((token) => (
                          <div
                            key={token.address}
                            className="inline-flex items-center gap-2 rounded-[10px] border py-1.5 pl-1.5 pr-3"
                            style={{ borderColor: CYAN_BORDER, background: CYAN_FILL }}
                            data-testid={`whale-mock-bonus-${token.canonical}`}
                          >
                            {token.logo ? (
                              <img
                                src={token.logo}
                                alt=""
                                className="flex-none w-[20px] h-[20px] rounded-full object-cover bg-[#050a14]"
                              />
                            ) : (
                              <span className="flex-none w-[20px] h-[20px] rounded-full grid place-items-center bg-[#050a14] text-[10px] font-semibold text-foreground">
                                {token.symbol.charAt(0)}
                              </span>
                            )}
                            <span className="font-mono text-[13px] font-semibold text-foreground tabular-nums">
                              {token.amountFormatted}
                            </span>
                            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                              {token.symbol}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Price comparison: usual → discount → you save */}
                <div className="flex-none flex flex-col gap-2 min-w-[210px]">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
                      Usual price
                    </div>
                    <div
                      className="flex items-baseline gap-1.5 font-mono text-[17px] font-semibold tracking-tight text-muted-foreground leading-none tabular-nums"
                      data-testid="whale-mock-usual-cost"
                    >
                      <span className="line-through decoration-[rgba(255,255,255,0.45)]">{usualCost}</span>
                      <span className="text-[11px] font-sans font-semibold uppercase tracking-[0.1em]">
                        {PAYMENT_SYMBOL}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {usualPerNft} {PAYMENT_SYMBOL} per NFT now
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
                      Discount price
                    </div>
                    <div
                      className="flex items-baseline gap-1.5 font-mono text-[19px] font-semibold tracking-tight text-foreground leading-none tabular-nums"
                      data-testid="whale-mock-discount-cost"
                    >
                      {amountWithSymbol(paidCost)}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      avg {avgPerNft} {PAYMENT_SYMBOL} per NFT
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-[rgba(255,255,255,0.12)]">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
                      You save
                    </div>
                    <div
                      className="flex items-baseline gap-1.5 font-mono text-[19px] font-semibold tracking-tight leading-none tabular-nums"
                      style={{ color: WHALE_DISCOUNT_CYAN }}
                      data-testid="whale-mock-saving"
                    >
                      {saving}
                      <span className="text-[11px] font-sans font-semibold uppercase tracking-[0.1em]">
                        {PAYMENT_SYMBOL} · {savingPercent}%
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 max-w-[230px] leading-snug">
                      Slightly more than {quote.effectivePercent}%, because
                      discounted NFTs don't raise the mint price.
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2" data-testid="whale-mock-no-discount">
                {/* 2. Eyebrow + headline */}
                <div
                  className="flex items-center gap-2 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: WHALE_DISCOUNT_CYAN }}
                >
                  <span
                    className="inline-block whale-mock-dot"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: WHALE_DISCOUNT_CYAN,
                      boxShadow: `0 0 8px ${WHALE_DISCOUNT_CYAN}`,
                      flex: 'none',
                    }}
                  />
                  Whale Mint · {NFT_COLLECTION_NAME}
                </div>
                <h2
                  className="m-0 text-[22px] font-bold tracking-tight text-foreground"
                  data-testid="whale-mock-headline"
                >
                  No discount batch available right now
                </h2>
              </div>
            )}

            {/* 6. Boost comparison */}
            {boosted && (
              <div
                className="rounded-[10px] border px-3.5 py-2.5 text-[13px] text-foreground"
                style={{ borderColor: CYAN_BORDER, background: CYAN_FILL }}
                data-testid="whale-mock-boost-compare"
              >
                <span className="font-semibold" style={{ color: WHALE_DISCOUNT_CYAN }}>
                  Boost:
                </span>{' '}
                you pay for {quote.paid} instead of {display.unboostedPaid}, saving
                another {boostDelta} {PAYMENT_SYMBOL}.
              </div>
            )}

            {/* 8. CTA */}
            <div className="flex flex-wrap items-center gap-3.5 pt-4 border-t border-[rgba(255,255,255,0.12)]">
              <button
                type="button"
                onClick={() => void mint()}
                disabled={blocker !== null || phase !== 'idle'}
                className="phoenix-btn-primary whitespace-nowrap !rounded-md !text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="whale-mock-cta"
              >
                {ctaLabel(
                  blocker,
                  phase,
                  PAYMENT_SYMBOL,
                  `Mint ${quote.total} NFTs for ${paidCost} ${PAYMENT_SYMBOL}`
                )}
              </button>
              {config.paused ? (
                <span className="text-xs text-muted-foreground" data-testid="whale-mock-paused">
                  Discount batch minting is paused right now.
                </span>
              ) : ready ? (
                <span className="text-xs text-muted-foreground" data-testid="whale-mock-budget-note">
                  Approves up to {maxPayment} {PAYMENT_SYMBOL} in case the price moves; any
                  unspent amount is refunded in the same transaction.
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <PanelStyles />
    </div>
  );
}
