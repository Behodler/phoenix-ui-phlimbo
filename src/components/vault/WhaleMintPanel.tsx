import { useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import type { Address } from 'viem';
import { useReadContract } from 'wagmi';
import { batchNftMinterAbi } from '@behodler/phase2-wagmi-hooks';
import { useContractAddresses } from '../../contexts/ContractAddressContext';
import { useMinterPageView } from '../../hooks/useMinterPageView';
import { useTokenBalance } from '../../hooks/useContractInteractions';
import { geometricSumRaw } from '../../utils/batchMintMath';
import { WHALE_MINT_MOCK, WHALE_MINT_CYAN } from '../../data/whaleMintMockData';
import WhaleMintConfirmModal from './WhaleMintConfirmModal';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Liquid Sky Phoenix is the only `batchEnabled` row in nftStaticConfig and
 * its tokenPrefix resolves to USDS. Hard-coding the prefix here keeps the
 * panel decoupled from the static-config array order.
 */
const LIQUID_SKY_PHOENIX_TOKEN_PREFIX = 'USDS' as const;

function formatUsdc(raw: bigint): string {
  return Number(formatUnits(raw, 6)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatUsds(raw: bigint): string {
  // Match the 4-decimal display used by the mint list for Liquid Sky Phoenix.
  return Number(formatUnits(raw, 18)).toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

/**
 * Whale Mint panel — surfaces the live nudge reward pot and the cost of
 * minting `nudgeSize` Liquid Sky Phoenix NFTs via `BatchNFTMinter`.
 *
 * Data sources:
 *   - `nudgeSize` and `nudgePaymentToken` read directly from BatchNFTMinter
 *     (no generated hook wrapper exists for these getters).
 *   - Reward pot is `IERC20(nudgePaymentToken).balanceOf(BatchNFTMinter)`.
 *   - Liquid Sky Phoenix price/growth/dispatcher comes from `useMinterPageView`
 *     (wagmi/react-query dedups, so this is a free call relative to NFTListTab).
 *
 * The panel is hidden entirely when BatchNFTMinter is undeployed (zero
 * address) — mirrors `useBatchFlow` in NFTListMintModal.
 */
export default function WhaleMintPanel() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addresses } = useContractAddresses();
  const { data: minterData, refetch: refetchMinterData } = useMinterPageView();

  const batchMinter = addresses?.BatchNFTMinter as Address | undefined;
  const batchMinterAvailable =
    !!batchMinter && batchMinter.toLowerCase() !== ZERO_ADDRESS;

  // Read nudgeSize from BatchNFTMinter. Hook order must be stable, so always
  // call useReadContract; gate execution via `query.enabled`.
  const { data: nudgeSizeRaw } = useReadContract({
    address: batchMinter,
    abi: batchNftMinterAbi,
    functionName: 'nudgeSize',
    query: { enabled: batchMinterAvailable },
  });

  // Read nudgePaymentToken from BatchNFTMinter so a future payment-token swap
  // doesn't silently keep showing the old token's balance.
  const { data: nudgePaymentTokenRaw } = useReadContract({
    address: batchMinter,
    abi: batchNftMinterAbi,
    functionName: 'nudgePaymentToken',
    query: { enabled: batchMinterAvailable },
  });

  const nudgePaymentToken = nudgePaymentTokenRaw as Address | undefined;
  const nudgePaymentTokenValid =
    !!nudgePaymentToken && nudgePaymentToken.toLowerCase() !== ZERO_ADDRESS;

  // Reward pot: nudgePaymentToken.balanceOf(BatchNFTMinter).
  const {
    balance: rewardPotRaw,
    refetch: refetchRewardPot,
  } = useTokenBalance(
    batchMinterAvailable ? batchMinter : undefined,
    nudgePaymentTokenValid ? nudgePaymentToken : undefined,
  );

  const lsp = minterData?.[LIQUID_SKY_PHOENIX_TOKEN_PREFIX];

  // count and mintCostRaw are derived; use 0/0n placeholders only for the
  // loading branch — the panel renders a skeleton in that state so users
  // never see "0" / "0.0000" momentarily.
  const count = nudgeSizeRaw !== undefined ? Number(nudgeSizeRaw) : 0;
  const mintCostRaw = useMemo(() => {
    if (!lsp || lsp.priceRaw <= 0n || count <= 0) return 0n;
    return geometricSumRaw(lsp.priceRaw, lsp.growthBasisPoints, count);
  }, [lsp, count]);

  // Hide the panel entirely when BatchNFTMinter is undeployed. Mainnet
  // currently lacks the helper; matches the NFTListMintModal `useBatchFlow`
  // graceful-fallback policy.
  if (!batchMinterAvailable) {
    return null;
  }

  const isLoading =
    nudgeSizeRaw === undefined ||
    nudgePaymentTokenRaw === undefined ||
    !lsp ||
    lsp.priceRaw <= 0n ||
    rewardPotRaw === undefined;

  // Render skeleton while initial reads resolve. We deliberately avoid
  // showing "×0" / "0.0000 USDS" / "Mint 0 — Claim Reward" during the load.
  if (isLoading) {
    return (
      <div className="mt-6" data-testid="whale-mint-panel">
        <div className="bg-pxusd-teal-700 border border-pxusd-teal-500 rounded-lg overflow-hidden">
          <div
            className="p-6 grid place-items-center text-xs uppercase tracking-[0.22em] text-muted-foreground"
            data-testid="whale-mint-skeleton"
          >
            <span
              className="inline-block whale-mint-dot mr-2"
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: WHALE_MINT_CYAN,
                boxShadow: `0 0 8px ${WHALE_MINT_CYAN}`,
              }}
            />
            Loading Whale Mint…
          </div>
        </div>
        <style>{`
          @keyframes whale-mint-pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(1.4); }
          }
          .whale-mint-dot {
            animation: whale-mint-pulse 1.6s ease-in-out infinite;
          }
        `}</style>
      </div>
    );
  }

  const rewardPotFormatted = formatUsdc(rewardPotRaw!);
  const mintCostFormatted = formatUsds(mintCostRaw);

  return (
    <div className="mt-6" data-testid="whale-mint-panel">
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
                Whale Mint · Phoenix ×{count}
              </div>
              <h2 className="m-0 mb-1 text-[22px] font-bold tracking-tight text-foreground">
                Claim the nudge reward
              </h2>
              <p className="m-0 text-sm text-muted-foreground max-w-[48ch]">
                Mint {count} Liquid Sky Phoenix NFTs and receive {rewardPotFormatted} USDC back in the same transaction.
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
                {rewardPotFormatted}
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
                    {mintCostFormatted} USDS
                  </span>
                </div>
                <div className="mt-1">
                  Receive:{' '}
                  <span className="font-mono text-sm text-foreground font-semibold tabular-nums">
                    {count} NFTs
                  </span>
                </div>
                <div className="mt-1">
                  Whale mint reward:{' '}
                  <span className="font-mono text-sm text-foreground font-semibold tabular-nums">
                    {rewardPotFormatted} USDC
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="phoenix-btn-primary whitespace-nowrap !rounded-md !text-[13px]"
                data-testid="whale-mint-cta"
              >
                Mint {count} — Claim Reward
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
        count={count}
        mintCostRaw={mintCostRaw}
        rewardPotRaw={rewardPotRaw!}
        dispatcherIndex={lsp!.dispatcherIndex}
        nudgeSize={nudgeSizeRaw as bigint}
        refetchMinterData={refetchMinterData}
        refetchRewardPot={refetchRewardPot}
      />
    </div>
  );
}
