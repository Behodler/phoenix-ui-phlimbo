import { useMemo } from 'react';
import { nftStaticConfig } from '../../data/nftMockData';
import { STAKING_MOCK } from '../../data/stakeMockData';
import type { StakingData } from '../../hooks/useStakingMockData';
import EarningPanel from './staking/EarningPanel';
import StakedNftCard from './staking/StakedNftCard';

const LIQUID_SKY_ID = 2;

export interface StakingSurfaceProps {
  /**
   * Staking data source. Passed in (rather than created here) so that
   * the parent tab can show summary info — staked unit badge, min APY pill —
   * driven by the same state the card mutates.
   */
  staking: StakingData;
}

/**
 * Composes the NFT-tab Stake view: global earning panel, the Liquid Sky
 * staking card, and a muted list of currently non-stakeable NFTs.
 *
 * Data is entirely mocked via useStakingMockData (supplied by parent).
 */
export default function StakingSurface({ staking }: StakingSurfaceProps) {

  const liquidSky = useMemo(
    () => nftStaticConfig.find((n) => n.id === LIQUID_SKY_ID),
    []
  );

  const otherNfts = useMemo(
    () => nftStaticConfig.filter((n) => n.id !== LIQUID_SKY_ID),
    []
  );

  // Value shown in "Staked value" and the card's "Unrealised value" rows.
  // Uses the current marginal mint price as a proxy since individual mint
  // prices are unknowable from chain state.
  const totalStakedValue = staking.stakedUnits * STAKING_MOCK.currentMintPrice;

  return (
    <div>
      <EarningPanel
        totalUnits={staking.stakedUnits}
        totalStaked={totalStakedValue}
        minApy={staking.minApy}
        ratePerSecond={staking.ratePerSec}
        lifetimeEarned={staking.lifetimeEarned}
      />

      <div className="mb-3 mt-1 flex items-end justify-between">
        <h2 className="m-0 text-[18px] font-bold tracking-[-0.01em] text-pxusd-white">
          Your staked NFTs
        </h2>
        <span className="text-xs text-muted-foreground">
          Earning phUSD from protocol fees · paid continuously
        </span>
      </div>

      {liquidSky && (
        <StakedNftCard
          nft={liquidSky}
          stakedUnits={staking.stakedUnits}
          ownedUnits={staking.ownedUnits}
          pendingYield={staking.pendingYield}
          ratePerSec={staking.ratePerSec}
          apy={staking.minApy}
          unrealized={totalStakedValue}
          onStake={staking.stake}
          onUnstake={staking.unstake}
          onClaim={staking.claim}
        />
      )}

      {/* Non-stakeable NFT list */}
      <div className="mb-3 mt-2 flex items-end justify-between">
        <h3 className="m-0 text-[15px] font-semibold text-pxusd-white">Other NFTs</h3>
        <span className="text-xs text-muted-foreground">
          Non-yielding · staking coming later
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {otherNfts.map((nft) => (
          <div
            key={nft.id}
            className="flex items-center gap-3.5 rounded-[14px] border border-pxusd-teal-600 bg-pxusd-teal-700 px-4 py-3.5 opacity-55"
          >
            <img
              src={nft.image}
              alt={nft.name}
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 select-none rounded-[10px] object-cover"
              draggable={false}
            />
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-semibold text-pxusd-white">{nft.name}</div>
              <div className="text-xs text-muted-foreground">Non-yielding · staking coming later</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
