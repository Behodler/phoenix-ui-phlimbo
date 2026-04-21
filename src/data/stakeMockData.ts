/**
 * Static staking pool config + mock inputs.
 *
 * All values are UI-only placeholders. A follow-up story will replace
 * useStakingMockData with a real hook that pulls from the reward contract,
 * useMinterPageView, and useBalancerPrice.
 *
 * Units (all human-readable — no wei / basis points):
 *  - currentMintPrice: USDS (≈ USD), price the NEXT mint would pay
 *  - growthRate:       USDS delta per mint (so highestPrice = currentMintPrice - growthRate)
 *  - rewardRatePerSec: phUSD per second disbursed globally by the reward contract
 *  - phUsdUsdPrice:    phUSD market price in USD
 */
export const STAKING_MOCK = {
  currentMintPrice: 42.5,
  growthRate: 0.15,
  rewardRatePerSec: 0.00025,
  phUsdUsdPrice: 1.0,
  startOwned: 8,
  startStaked: 12,
  startPendingYield: 0,
  startLifetimeEarned: 34.218912,
} as const;

export const SECONDS_PER_YEAR = 86400 * 365;
