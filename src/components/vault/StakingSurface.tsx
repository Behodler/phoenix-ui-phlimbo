import { useMemo, useState } from 'react';
import type { Address } from 'viem';
import { STAKEABLE_NFTS } from '../../data/nftMockData';
import type { StakeableNft } from '../../data/nftMockData';
import { useStakingPageData } from '../../hooks/useStakingPageData';
import type { StakingPageData } from '../../hooks/useStakingPageData';
import { useContractAddresses } from '../../contexts/ContractAddressContext';
import type { Toast } from '../../types/toast';
import EarningPanel from './staking/EarningPanel';
import StakedNftCard from './staking/StakedNftCard';

type AddToast = (toast: Omit<Toast, 'id'>) => string;

export interface StakingSurfaceProps {
  /**
   * Toast dispatcher, threaded into each NFT's staking-source hook so they
   * own their own confirm/submitted/confirmed (live) or "coming soon" (mock)
   * toast lifecycle.
   */
  addToast: AddToast;
}

/** A stakeable NFT paired with its live/mock data source. */
interface StakingSource {
  meta: StakeableNft;
  state: StakingPageData;
}

/**
 * Composes the NFT-tab Stake view: a shared aggregated earning panel, a
 * horizontal thumbnail rail of stakeable NFTs, and a single detail card for
 * the selected NFT.
 *
 * Each NFT has its OWN staking source hook, called explicitly here (never in
 * a `.map`, per the Rules of Hooks). The set of stakeable NFTs is static and
 * small, so adding another is one explicit hook call plus a `STAKEABLE_NFTS`
 * registry entry.
 */
export default function StakingSurface({ addToast }: StakingSurfaceProps) {
  const { addresses } = useContractAddresses();

  // ── Per-NFT staking sources (one explicit hook call each) ───────────────
  // Liquid Sky Phoenix (id 2) — LIVE on-chain wiring (defaults: NFTStaker
  // address, USDS owned-row, "Liquid Sky Phoenix" toast name).
  const liquidSky = useStakingPageData(addToast);

  // Reservoir Ratchet (id 6) — LIVE on-chain wiring against its dedicated
  // RatchetNFTStaker, paying in USDC. Same generic staker shape as Liquid Sky,
  // parameterized via useStakingPageData's options. Gracefully no-ops while
  // RatchetNFTStaker is zero-address (e.g. on mainnet before deploy).
  const ratchet = useStakingPageData(addToast, {
    stakerAddress: addresses?.RatchetNFTStaker as Address | undefined,
    ownedRowKey: 'USDC',
    nftName: 'Reservoir Ratchet',
  });

  // ── Assemble sources, binding each registry entry to its hook state ─────
  // Bind by config id (both NFTs are now live, so `isLive` no longer
  // distinguishes them): Liquid Sky Phoenix is id 2, Reservoir Ratchet is id 6.
  const sources = useMemo<StakingSource[]>(() => {
    const liquidMeta = STAKEABLE_NFTS.find((n) => n.config.id === 2);
    const ratchetMeta = STAKEABLE_NFTS.find((n) => n.config.id === 6);

    const list: StakingSource[] = [];
    if (liquidMeta) list.push({ meta: liquidMeta, state: liquidSky });
    if (ratchetMeta) list.push({ meta: ratchetMeta, state: ratchet });
    return list;
  }, [liquidSky, ratchet]);

  const [selectedId, setSelectedId] = useState<number>(
    () => sources[0]?.meta.config.id ?? STAKEABLE_NFTS[0]?.config.id ?? 0,
  );

  const selected = useMemo(
    () => sources.find((s) => s.meta.config.id === selectedId) ?? sources[0],
    [sources, selectedId],
  );

  // ── Aggregated EarningPanel props (match the design mock) ───────────────
  // The displayed APY per NFT is its live-computed minApy when available,
  // else the registry's static apy.
  const apyFor = (s: StakingSource) =>
    s.meta.isLive ? s.state.minApy : s.meta.apy;

  const totalUnits = useMemo(
    () => sources.reduce((sum, s) => sum + s.state.stakedUnits, 0),
    [sources],
  );
  const pendingYield = useMemo(
    () => sources.reduce((sum, s) => sum + s.state.pendingYield, 0),
    [sources],
  );
  const ratePerSecond = useMemo(
    () => sources.reduce((sum, s) => sum + s.state.ratePerSec, 0),
    [sources],
  );
  const minApy = useMemo(() => {
    const staked = sources.filter((s) => s.state.stakedUnits > 0);
    // Graceful fallback: when nothing is staked, show the min over all
    // sources rather than Infinity.
    const pool = staked.length > 0 ? staked : sources;
    if (pool.length === 0) return 0;
    return Math.min(...pool.map(apyFor));
  }, [sources]);

  return (
    <div>
      <EarningPanel
        totalUnits={totalUnits}
        minApy={minApy}
        ratePerSecond={ratePerSecond}
        pendingYield={pendingYield}
      />

      <h2 className="m-0 mb-3 mt-1 text-[18px] font-bold tracking-[-0.01em] text-pxusd-white">
        Your staked NFTs
      </h2>

      {/* Thumbnail rail — clickable artwork selects the detail card below. */}
      <div className="mb-[18px] flex flex-wrap gap-3">
        {sources.map((s) => {
          const isSelected = s.meta.config.id === selected?.meta.config.id;
          const badge =
            s.state.stakedUnits > 0
              ? `${s.state.stakedUnits} staked`
              : `${s.state.ownedUnits} in wallet`;
          return (
            <button
              key={s.meta.config.id}
              type="button"
              onClick={() => setSelectedId(s.meta.config.id)}
              aria-pressed={isSelected}
              className="relative flex min-w-[200px] flex-1 items-center gap-3 rounded-[14px] border border-white/[0.12] bg-white/[0.03] p-2.5 text-left transition-colors hover:bg-white/[0.06]"
            >
              <img
                src={s.meta.config.image}
                alt={s.meta.config.name}
                width={52}
                height={52}
                className="block h-[52px] w-[52px] flex-none select-none rounded-[10px] object-cover"
                draggable={false}
              />
              <div className="min-w-0">
                <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-semibold text-pxusd-white">
                  {s.meta.config.name}
                </div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {badge}
                </div>
              </div>
              {isSelected && (
                <div className="pointer-events-none absolute inset-0 rounded-[14px] border-2 border-pxusd-orange-500 shadow-[0_0_12px_rgba(255,140,66,0.35)]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Single detail card reflecting the selected NFT. */}
      {selected && (
        <StakedNftCard
          nft={selected.meta.config}
          stakedUnits={selected.state.stakedUnits}
          ownedUnits={selected.state.ownedUnits}
          pendingYield={selected.state.pendingYield}
          ratePerSec={selected.state.ratePerSec}
          apy={apyFor(selected)}
          isStakerDeployed={selected.state.isStakerDeployed}
          isApprovedForAll={selected.state.isApprovedForAll}
          approveAll={selected.state.approveAll}
          isApproving={selected.state.isApproving}
          isStaking={selected.state.isStaking}
          isUnstaking={selected.state.isUnstaking}
          isClaiming={selected.state.isClaiming}
          onStake={selected.state.stake}
          onUnstake={selected.state.unstake}
          onClaim={selected.state.claim}
        />
      )}
    </div>
  );
}
