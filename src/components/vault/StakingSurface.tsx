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
 * Composes the NFT-tab Stake view: global earning panel and the Liquid Sky
 * staking card.
 *
 * Data is entirely mocked via useStakingMockData (supplied by parent).
 */
export default function StakingSurface({ staking }: StakingSurfaceProps) {

  const liquidSky = useMemo(
    () => nftStaticConfig.find((n) => n.id === LIQUID_SKY_ID),
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
    </div>
  );
}
