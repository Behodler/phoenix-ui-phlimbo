import { useState } from 'react';
import { LIQUID_SKY_PHOENIX_MOCK_PRICE_USDS } from '../../data/nftMockData';
import { WHALE_MINT_MOCK, WHALE_MINT_CYAN } from '../../data/whaleMintMockData';
import WhaleMintConfirmModal from './WhaleMintConfirmModal';

function formatUsdc(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatUsds(n: number): string {
  // Match the 4-decimal display used by the mint list for Liquid Sky Phoenix.
  return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

/**
 * Mock-only "Whale Mint" panel rendered below the NFT list inside the Mint
 * sub-tab. Side-by-side variant only. All values are mock constants — no
 * contract calls, no wallet writes, no live ticker.
 */
export default function WhaleMintPanel() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const cost = WHALE_MINT_MOCK.batchSize * LIQUID_SKY_PHOENIX_MOCK_PRICE_USDS;
  const reward = WHALE_MINT_MOCK.potUsdc;

  return (
    <div className="max-w-4xl mx-auto mt-6" data-testid="whale-mint-panel">
      <div className="bg-pxusd-teal-700 border border-pxusd-teal-500 rounded-lg overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr]">
          {/* Whale art */}
          <div
            className="grid place-items-center border-b sm:border-b-0 sm:border-r border-pxusd-teal-500 p-5"
            style={{
              background:
                'radial-gradient(ellipse at 50% 50%, #1a2440 0%, #050a14 75%)',
            }}
          >
            <img
              src={WHALE_MINT_MOCK.whaleArt}
              alt="Whale Phoenix"
              className="w-full aspect-square"
              style={{
                imageRendering: 'pixelated',
                filter: 'drop-shadow(0 0 18px oklch(60% 0.15 30 / 0.3))',
              }}
            />
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-y-5 sm:gap-x-7 items-center">
            {/* Meta */}
            <div className="min-w-0">
              <div
                className="flex items-center gap-2 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.22em]"
                style={{ color: WHALE_MINT_CYAN }}
                data-testid="whale-mint-eyebrow"
              >
                <span
                  className="inline-block whale-mint-dot"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: WHALE_MINT_CYAN,
                    boxShadow: `0 0 8px ${WHALE_MINT_CYAN}`,
                  }}
                />
                Whale Mint · Phoenix ×40
              </div>
              <h2 className="m-0 mb-1 text-[22px] font-bold tracking-tight text-foreground">
                Claim the nudge reward
              </h2>
              <p className="m-0 text-sm text-muted-foreground max-w-[48ch]">
                Mint 40 Liquid Sky Phoenix NFTs and receive 10 USDC back in the same transaction.
              </p>
            </div>

            {/* Pot */}
            <div className="flex flex-col items-end gap-2 sm:border-l sm:border-pxusd-teal-500 sm:pl-7">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Nudge reward
              </div>
              <div
                className="font-mono text-2xl font-semibold tracking-tight text-foreground leading-none tabular-nums"
                data-testid="whale-mint-pot"
              >
                {formatUsdc(reward)}
                <span
                  className="text-sm font-medium ml-1.5"
                  style={{ color: WHALE_MINT_CYAN }}
                >
                  USDC
                </span>
              </div>
            </div>

            {/* CTA row */}
            <div className="col-span-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-pxusd-teal-500">
              <div className="text-xs text-muted-foreground" data-testid="whale-mint-cost-hint">
                <div>
                  Mint cost:{' '}
                  <span className="font-mono text-sm text-foreground font-semibold tabular-nums">
                    {formatUsds(cost)} USDS
                  </span>
                </div>
                <div className="mt-1">
                  Receive:{' '}
                  <span className="font-mono text-sm text-foreground font-semibold tabular-nums">
                    {WHALE_MINT_MOCK.batchSize} NFTs
                  </span>
                </div>
                <div className="mt-1">
                  Whale mint reward:{' '}
                  <span className="font-mono text-sm text-foreground font-semibold tabular-nums">
                    {formatUsdc(reward)} USDC
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="phoenix-btn-primary whitespace-nowrap"
                data-testid="whale-mint-cta"
              >
                Mint {WHALE_MINT_MOCK.batchSize} — Claim Reward
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Local pulse keyframes so we don't pollute global CSS */}
      <style>{`
        @keyframes whale-mint-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.4); }
        }
        .whale-mint-dot {
          animation: whale-mint-pulse 1.6s ease-in-out infinite;
        }
      `}</style>

      <WhaleMintConfirmModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        cost={cost}
        reward={reward}
        batchSize={WHALE_MINT_MOCK.batchSize}
      />
    </div>
  );
}
