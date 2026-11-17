import { useMemo, useState } from 'react';
import { formatUnits, parseUnits } from 'viem';
import {
  WHALE_ART,
  WHALE_DISCOUNT_CYAN,
  WHALE_PAYMENT_LOGO,
} from '../../../data/nudgeTokenMeta';
import { WHALE_MOCK } from '../../../data/whaleMockData';
import { useMinterPageView } from '../../../hooks/useMinterPageView';
import { computeDiscountBatch } from '../../../utils/discountBatchMath';
import type { Toast } from '../../../types/toast';

const NFT_COLLECTION_NAME = 'Liquid Sky Phoenix';
const PAYMENT_SYMBOL = 'USDS';

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

interface WhaleMockPanelProps {
  addToast: (toast: Omit<Toast, 'id'>) => string;
}

/**
 * Whale-mock — admin-only preview of the nft-staking
 * `BatchNFTMinterNudgeDiscount` batch mint.
 *
 * A MOCK: it reads nothing from any batch minter. The only live input is the
 * index-4 (Liquid Sky Phoenix) price and growth from `useMinterPageView`, with
 * `WHALE_MOCK` fallbacks; every contract parameter comes from `WHALE_MOCK`.
 * The CTA only raises an info toast.
 *
 * The discount is the message: quantity at a discount, usual price vs
 * discount price, and the saving. The discount fund is described only
 * qualitatively — no amount is ever shown, because the old "net of the fund"
 * framing made users think they would be paid out.
 *
 * Gating is the caller's job (`NFTListTab` + `VaultPage`); this component does
 * not check admin status. The "Admin debug" switch must be removed if the mock
 * is ever promoted to a live tab.
 */
export default function WhaleMockPanel({ addToast }: WhaleMockPanelProps) {
  const [simulateBoost, setSimulateBoost] = useState(false);
  const { data: minterData } = useMinterPageView();

  const usdsRow = minterData?.USDS;
  const hasLivePrice = !!usdsRow && usdsRow.priceRaw > 0n;
  const decimals = hasLivePrice ? usdsRow.decimals : WHALE_MOCK.paymentDecimals;
  const priceRaw = hasLivePrice
    ? usdsRow.priceRaw
    : parseUnits(WHALE_MOCK.fallbackPriceUsds, WHALE_MOCK.paymentDecimals);
  const growthBps = hasLivePrice ? usdsRow.growthBasisPoints : WHALE_MOCK.fallbackGrowthBps;

  const batch = useMemo(
    () =>
      computeDiscountBatch({
        potFree: simulateBoost ? WHALE_MOCK.boostedPotFree : WHALE_MOCK.normalPotFree,
        discountPercent: WHALE_MOCK.discountPercent,
        cap: WHALE_MOCK.maxFreePerBatch,
        perPoint: WHALE_MOCK.overflowNFTsPerBoostPoint,
        maxBoost: WHALE_MOCK.maxBoost,
        priceRaw,
        growthBps,
      }),
    [simulateBoost, priceRaw, growthBps]
  );

  const d = WHALE_MOCK.discountPercent;
  const usualCost = formatUsds(batch.usualCostRaw, decimals);
  const paidCost = formatUsds(batch.paidCostRaw, decimals);
  const saving = formatUsds(batch.savingRaw, decimals);
  const usualPerNft = formatUsds(priceRaw, decimals);
  const avgPerNft = formatUsds(batch.avgPricePaidRaw, decimals);
  const savingPercent =
    batch.usualCostRaw > 0n
      ? (Number((batch.savingRaw * 10_000n) / batch.usualCostRaw) / 100).toFixed(1)
      : '0.0';
  const boostDelta = formatUsds(batch.unboostedPaidCostRaw - batch.paidCostRaw, decimals);

  const handleCta = () => {
    addToast({
      type: 'info',
      title: 'Preview only',
      description: 'This is a mock. Nothing was sent.',
    });
  };

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
        {/* 1. Admin debug strip — low-key, clearly labelled. */}
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-5 py-2 border-b border-dashed border-[rgba(255,255,255,0.14)] bg-[rgba(0,0,0,0.18)]"
          data-testid="whale-mock-debug-strip"
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Admin debug
          </span>
          <label className="flex items-center gap-2.5 text-xs text-muted-foreground cursor-pointer select-none">
            <span id="whale-mock-debug-boost-label">Simulate cap reached + boost on</span>
            <button
              type="button"
              role="switch"
              aria-checked={simulateBoost}
              aria-labelledby="whale-mock-debug-boost-label"
              onClick={() => setSimulateBoost((on) => !on)}
              className="relative inline-flex flex-none w-9 h-5 rounded-full border transition-colors"
              style={{
                borderColor: simulateBoost ? CYAN_BORDER : 'rgba(255,255,255,0.2)',
                background: simulateBoost ? BOOST_FILL : 'rgba(255,255,255,0.06)',
              }}
              data-testid="whale-mock-debug-boost"
            >
              <span
                aria-hidden="true"
                className="absolute top-[2px] w-3.5 h-3.5 rounded-full transition-[left]"
                style={{
                  left: simulateBoost ? 18 : 2,
                  background: simulateBoost ? WHALE_DISCOUNT_CYAN : 'rgba(255,255,255,0.55)',
                }}
              />
            </button>
          </label>
        </div>

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
              <p className="m-0">
                The fund is never paid out to anyone. It covers the discounted
                NFTs, and the protocol uses it to buy phUSD for NFT stakers.
                Discounted NFTs don't push up the mint price.
              </p>
              {simulateBoost && (
                <p className="m-0" data-testid="whale-mock-cap-sentence">
                  This batch has hit the {WHALE_MOCK.maxFreePerBatch}-NFT limit.
                  Extra funding carries over and raises the discount by 1 point
                  for every {WHALE_MOCK.overflowNFTsPerBoostPoint} NFTs' worth,
                  up to +{WHALE_MOCK.maxBoost}%.
                </p>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 flex flex-col gap-4 min-w-0">
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
                  {batch.total} NFTs at {batch.effectivePercent}% off
                </h2>

                {/* 3. Discount badge (+ boost) */}
                <div
                  className="self-start flex flex-wrap items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold"
                  style={{ borderColor: CYAN_BORDER, background: CYAN_FILL, color: WHALE_DISCOUNT_CYAN }}
                  data-testid="whale-mock-discount"
                >
                  {batch.boost > 0 ? (
                    <>
                      <span>{d}%</span>
                      <span aria-hidden="true">+</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-foreground whale-mock-boost"
                        style={{ background: BOOST_FILL, boxShadow: `0 0 10px ${CYAN_BORDER}` }}
                        data-testid="whale-mock-boost-badge"
                      >
                        {batch.boost}% boost
                      </span>
                      <span aria-hidden="true">=</span>
                      <span>{batch.effectivePercent}% discount</span>
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
                        {batch.total} × {NFT_COLLECTION_NAME}
                      </span>
                      <span
                        className="text-[10px] tracking-[0.04em] whitespace-nowrap text-muted-foreground"
                        data-testid="whale-mock-split"
                      >
                        {batch.free} covered by the discount fund · {batch.paid} paid
                      </span>
                    </div>
                  </div>
                </div>
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
                    Slightly more than {batch.effectivePercent}%, because
                    discounted NFTs don't raise the mint price.
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Boost comparison */}
            {batch.boost > 0 && (
              <div
                className="rounded-[10px] border px-3.5 py-2.5 text-[13px] text-foreground"
                style={{ borderColor: CYAN_BORDER, background: CYAN_FILL }}
                data-testid="whale-mock-boost-compare"
              >
                <span className="font-semibold" style={{ color: WHALE_DISCOUNT_CYAN }}>
                  Boost:
                </span>{' '}
                you pay for {batch.paid} instead of {batch.unboostedPaid}, saving
                another {boostDelta} {PAYMENT_SYMBOL}.
              </div>
            )}

            {/* 8. Stub CTA */}
            <div className="flex flex-wrap items-center gap-3.5 pt-4 border-t border-[rgba(255,255,255,0.12)]">
              <button
                type="button"
                onClick={handleCta}
                disabled={batch.total === 0}
                className="phoenix-btn-primary whitespace-nowrap !rounded-md !text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="whale-mock-cta"
              >
                Mint {batch.total} NFTs for {paidCost} {PAYMENT_SYMBOL}
              </button>
              <span className="text-xs text-muted-foreground">Preview only.</span>
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
}
