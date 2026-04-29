import { useMemo } from 'react';
import { nftStaticConfig } from '../../data/nftMockData';
import type { StakingPageData } from '../../hooks/useStakingPageData';
import EarningPanel from './staking/EarningPanel';
import StakedNftCard from './staking/StakedNftCard';

const LIQUID_SKY_ID = 2;

export interface StakingSurfaceProps {
  /**
   * Staking data source. Passed in (rather than created here) so that
   * the parent tab can show summary info — staked unit badge, min APY pill —
   * driven by the same state the card mutates.
   */
  staking: StakingPageData;
}

/**
 * Composes the NFT-tab Stake view: global earning panel and the Liquid Sky
 * staking card.
 */
export default function StakingSurface({ staking }: StakingSurfaceProps) {

  const liquidSky = useMemo(
    () => nftStaticConfig.find((n) => n.id === LIQUID_SKY_ID),
    []
  );

  // Value shown in "Staked value" and the card's "Unrealised value" rows.
  // Uses the highest historical mint price (one growth-step backed out from
  // the current `priceRaw`) as a per-unit proxy — see useStakingPageData /
  // computeMinApy for the same convention.
  const totalStakedValue = staking.stakedUnits * staking.highestPrice;

  return (
    <div>
      <EarningPanel
        totalUnits={staking.stakedUnits}
        minApy={staking.minApy}
        ratePerSecond={staking.ratePerSec}
        pendingYield={staking.pendingYield}
      />

      <h2 className="m-0 mb-3 mt-1 text-[18px] font-bold tracking-[-0.01em] text-pxusd-white">
        Your staked NFTs
      </h2>

      {liquidSky && (
        <StakedNftCard
          nft={liquidSky}
          stakedUnits={staking.stakedUnits}
          ownedUnits={staking.ownedUnits}
          pendingYield={staking.pendingYield}
          ratePerSec={staking.ratePerSec}
          apy={staking.minApy}
          unrealized={totalStakedValue}
          isStakerDeployed={staking.isStakerDeployed}
          isApprovedForAll={staking.isApprovedForAll}
          approveAll={staking.approveAll}
          isApproving={staking.isApproving}
          isStaking={staking.isStaking}
          isUnstaking={staking.isUnstaking}
          isClaiming={staking.isClaiming}
          onStake={staking.stake}
          onUnstake={staking.unstake}
          onClaim={staking.claim}
        />
      )}
    </div>
  );
}
