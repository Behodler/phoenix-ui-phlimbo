import type { ContractAddresses } from '../types/contracts'

/**
 * Mainnet contract addresses
 * TODO: Replace these placeholder addresses with actual deployed mainnet contract addresses before launch
 *
 * IMPORTANT: bondingCurve is the Behodler3Tokenlaunch contract (mints bonding tokens)
 *            bondingToken is the ERC20 token produced by the bonding curve
 */
export const mainnetAddresses: ContractAddresses = {
  //Phase 1 protocol contracts
  PhUSD: "0xf3B5B661b92B75C71fA5Aba8Fd95D7514A9CD605",

  // Deployed Phase 2 contracts
  Pauser: "0x7c5A8EeF1d836450C019FB036453ac6eC97885a3",
  PhusdStableMinter: "0x94855ACA13952D81507C92D3CdBb2e25D3bbE60C",
  // V2 of PhlimboEA -- deployed by story 049 MigratePhlimboV1ToV2.s.sol.
  // STAYS the V2 address after the promotion-ready cutover (story 076): V2 continues to
  // exist, wound down and mint-revoked but NOT paused. PhlimboV3 is the separate key below.
  PhlimboEA: "0x6084a02c2ac0127ddf1e617de257c61480a2aee0",
  PhlimboV3: "0x8D3A8E3ba43DEb8C7e2110DF437a92243523b6ca",
  StableYieldAccumulator: "0x0cD353bfda674D04823B2826ffafB83B560D21B6",
  // Story 055 migration (executed 2026-06-10: MigrateStableStakerMainnet run txs 1-20 +
  // ResumeStableStakerMigration run, all receipts 0x1). DOLA/USDC are plain
  // ERC4626YieldStrategy; USDe is ERC4626MarketYieldStrategy @ 30 bps (sUSDe cooldown
  // blocks plain redeem). Old strategies (0xE7aE…, 0x8b4A…, 0xFc62…) drained + retired.
  YieldStrategyDola: "0x1760E05356Ec1FBBA159C730781dCfB9920524e2",
  YieldStrategyUSDe: "0xaC2e5936Eca286eC364d4D5Bcca33145fBe57f95",
  YieldStrategyUSDC: "0xaFDf8DeA96a0F37Aae4869f813901bf73a3eAB83",
  // USDe<->sUSDe CurveAMMAdapter (Router NG, via crvUSD) backing YieldStrategyUSDe.
  USDeAMMAdapter: "0x2D024e0d03Fb6Ead4F8E7Ba1EBECF6db0E755D6f",

  // External protocol contracts
  // Sky USDS PSM wrapper (USDS<->USDC). Real mainnet address — NOT the local mock (0xc351…1181).
  SkyPSM: "0xA188EEC8F81263234dA3622A406892F3D630f98c",
  USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  Dola: "0x865377367054516e17014CcdED1e7d814EDC9ce4",
  AutoDOLA: "0x79eB84B5E30Ef2481c8f00fD0Aa7aAd6Ac0AA54d",
  AutoUSDC: "0xa7569A44f348d3D70d8ad5889e50F78E33d80D35",

  // External tokens
  USDS: "0xdC035D45d973E3EC169d2276DDab16f1e407384F",
  SCX: "0x1B8568FbB47708E9E9D31Ff303254f748805bF21",
  Kendu: "0xaa95f26e30001251fb905d264Aa7b00eE9dF6C18",
  Flax: "0x0cf758D4303295C43CD95e1232f0101ADb3DA9E8",
  WBTC: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  EYE: "0x155ff1A85F440EE0A382eA949f24CE4E0b751c65",
  USDe: "0x4c9EDD5852cd905f086C759E8383e09bff1E68B3",
  SUSDe: "0x9D39A5DE30e57443BfF2A8307A4256c8797A3497",
  SUSDS: "0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD",

  // Balancer V3 infrastructure
  BalancerPool: "0x642BB6860b4776CC10b26B8f361Fd139E7f0db04",
  BalancerVault: "0xbA1333333333a1BA1108E8412f11850A5C319bA9",
  BalancerRouter: "0x5C6fb490BDFD3246EB0bB062c168DeCAF4bD9FDd",

  // NFT infrastructure — common
  BurnRecorder: "0x2A2c4186C906d3b347c86882ad4Bd1f2bE05579F",

  // NFT V2 contracts (flattened)
  NFTMinter: "0x39af088408e815844c567037c157b31d48d2e10f",
  // Story 070 (2026-06-27): the three BurnerEYE/SCX/Flax dispatchers (indices 1/2/3) were
  // replaced by Uniboost dispatchers in the local mock deploy, so the BurnerEYE/SCX/Flax keys
  // were dropped from the ContractAddresses interface. Their place is taken by the Uniboost
  // stack (dispatchers + hooks + stakers) below. These are NOT yet deployed on mainnet —
  // zero-address placeholders keep this hand-maintained file's key-set equal to the regenerated
  // interface (tsc drift guard). Patch by hand when they ship.
  // (The raw UniV2 stack that backs Uniboost — WETH9/factory/router/pools — is intentionally
  //  NOT surfaced here: it is anvil-only, the UI never touches UniV2 directly, and mainnet would
  //  reuse the live UniV2 deployment. It is filtered out of extraction in extract-addresses.js.)
  /*
  BurnerEYE: "0x13fb51bcb3c5ae9e7115730bc1a58ec676ceeef2",
  BurnerSCX: "0xa833603fd82674aec51f8a57c6a27b91bc1725b2",
  BurnerFlax: "0xb63b57025e9bee5bbb66e4a5297ed0ca044d5ff7",
  */
  UniboostEYE: "0x9cd4E3EB3B519C925a0000239990E27F9019f3B3",
  UniboostSCX: "0x665919d494b4294C643e4f3FA96EaC729b943585",
  UniboostFLX: "0xBda3314052Ae46b912F22B6202F2c66641eEd183",
  UniboostHookEYE: "0x0F05c34d458dd8953864a56857a2bb67ecb22683",
  UniboostHookSCX: "0xfe4Ed16a8450c76768e1EB5FF8292806E2204a2A",
  UniboostHookFLX: "0x8F48E5431814FfaC9c35cf934Aa2556A946Fb33C",
  UniboostStakerEYE: "0xE9067f37f6D0bb116233194690fb600Add8fD052",
  UniboostStakerSCX: "0x541b912B5451FfE2c04D5Ea8D317081718683242",
  UniboostStakerFLX: "0x17E25Cca844bC71c1E663E089fF11aFD266B5795",
  // Dedicated BatchNFTMinter per Uniboost NFT (EYE/SCX/FLX, dispatcher indices 1/2/3) so the UI
  // can batch-mint each in one tx. Nudge feature disabled (pure loopers). NOT yet deployed on
  // mainnet — the underlying Uniboost stack above is itself undeployed on mainnet. Left empty
  // (per request); patch by hand when they ship.
  EyeBatchNFTMinter: "0xbbe6c8d4b31e1507376b7c34b4a82c48158f2811",
  ScxBatchNFTMinter: "0x2a1a8fd7ba06a6d1b91385a3c56d2f2cd261e4d4",
  FlxBatchNFTMinter: "0x4695fd1067fb402dcd4551d5c87b84021bed0629",
  // Story 056 (2026-06-04): index-4 dispatcher cut over to the Sky-PSM BalancerPoolerV2.
  // Verified on-chain 2026-06-11: NFTMinter.configs(4).dispatcher == this address; it holds
  // the pending sUSDS leg (418.63 sUSDS). The prior pooler 0x26f8…b38a is retired (0 balance).
  BalancerPooler: "0x7f6874332c4629429d70D15f685A8230323F11F1",
  GatherWBTC: "0xfd3775f2ccfb94b532b34b2b683e210ba4449880",
  MultiPooler: "0xd1E5774159381915f5579dFd68507E2614f67b51",
  // View contracts
  // Story 078: ViewRouter is now the ONLY view-related key. Every page is resolved with
  // `ViewRouter.pages(keccak256("<page>"))` — "deposit", "mint", … — not from this file.
  ViewRouter: "0xC17Ce1cE5ebB43fc0cfda9Fe8BbC849c0894631a",
  // NFT staking
  BalancerPoolerMintDebtHook: "0x4A26ad83306a2F17155799fDD9449f77eb3F8bD7",
  NFTStaker: "0xc8514f821a3d801fa8a8c435840a992a4365a13b",
  WaUSDC: "0xd4fa2d31b7968e448877f69a96de69f5de8cd23e",
  NudgeStreamer: "0xF7e26179D6971985107AF66b078932D6484eBEAA",
  BatchNFTMinter: "0x068395556b8c43eDf257DC54D109EA5910aE15c7",
  // Stable Staking — deployed 2026-06-10 by ResumeStableStakerMigration (story 055).
  // Pools: DOLA 5 / USDC 7 / USDe 10 phUSD per day, 10% set-aside buffer.
  StableStaker: "0xbce8ABC09BaEDCabE93419bF875f6186e182079A",
  // NudgeRatchet dispatcher + its mint-debt hook — not yet deployed on mainnet (story 068).
  // Zero placeholders so this file still satisfies the ContractAddresses interface once the
  // local deploy added these fields. Patch by hand when they ship to mainnet.
  NudgeRatchet: "0x7E3fB41FD3E99312FBa8bfc71E79e635d526AA40",
  NudgeRatchetMintDebtHook: "0x09AceB96337df1316e0D2d7EEEa44d754D1f8d05",
  // Dedicated NFTStaker for the NudgeRatchet NFT — not yet deployed on mainnet (story 068).
  RatchetNFTStaker: "0x299b0071def42d35eaf5ea24cc0a71cf10655a64",
  // Dedicated BatchNFTMinter for the NudgeRatchet NFT (UI batch-mint entrypoint; pays USDC,
  // rewards USDS) — not yet deployed on mainnet (story 068). Patch by hand when it ships.
  RatchetBatchNFTMinter: "0x81896f48a95abea255cd38a3010e985b6051a1c7",
};