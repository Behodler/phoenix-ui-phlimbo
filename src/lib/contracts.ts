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
  // The `PhlimboEA` key is RETIRED. It named PhlimboV2 (0x6084a02c2ac0127ddf1e617de257c61480a2aee0,
  // deployed by story 049), which still exists on mainnet wound down, mint-revoked and NOT paused
  // so a late staker can still exit -- but it is no longer UI surface, and DeployMocks stopped
  // deploying a V2 locally once its V3 cutover had executed, so the key left the generated
  // ContractAddresses interface. Same reasoning story 080 used when it dropped the live
  // StableStakerV1 address: a registry key is a resolution path, and keeping one pointed at a
  // superseded generation is how a UI silently keeps reading the wrong contract. Anything that
  // still needs V2's address hardcodes it.
  PhlimboV3: "0x8D3A8E3ba43DEb8C7e2110DF437a92243523b6ca",
  StableYieldAccumulator: "0x0cD353bfda674D04823B2826ffafB83B560D21B6",
  // Story 055 migration (executed 2026-06-10: MigrateStableStakerMainnet run txs 1-20 +
  // ResumeStableStakerMigration run, all receipts 0x1). DOLA/USDC are plain
  // ERC4626YieldStrategy; USDe is ERC4626MarketYieldStrategy @ 30 bps (sUSDe cooldown
  // blocks plain redeem). Old strategies (0xE7aE…, 0x8b4A…, 0xFc62…) drained + retired.
  // Story 092: YieldStrategyDola is the sDOLA ERC4626YieldStrategy deployed by the StableStaker V2 cutover
  // (Phase 3b) - V2's DOLA pool, the PhusdStableMinter's DOLA collateral and SYA all use it.
  YieldStrategyDola: "0x981c7BE1460c7C8Cb40B8EB5908B29510Ae0B7EE",
  // Story 092: the autoDOLA strategy, RETIRED by the cutover (no clients, SYA removed, pauser OWNER,
  // unregistered from the Pauser, paused). Kept for history; nothing should route through it.
  YieldStrategyDolaLegacy: "0x1760E05356Ec1FBBA159C730781dCfB9920524e2",
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
  // Inverse sDOLA (ERC4626 over DOLA). Real external address, safe to set now: asset() ==
  // 0x865377367054516e17014CcdED1e7d814EDC9ce4 (DOLA) verified on mainnet in story 089.
  SDOLA: "0xb45ad160634c528Cc3D2926d9807104FA3157305",
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
  // (The raw UniV2 stack that backs Uniboost — WETH9/factory/pools — is still not surfaced here.
  //  Since phStaging2 story 102 the router and the phUSD/sUSDS pair ARE surfaced, as
  //  `UniswapV2Router` and `PhusdSusdsPair` below, because the Market tab reads them.)
  // external: canonical Uniswap V2 Router02
  UniswapV2Router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  // phUSD/sUSDS UniV2 pair, seeded by the phStaging2 story 103 index-4 cutover (2026-10-23).
  PhusdSusdsPair: "0x0b96b8ab66d40ba3C7501aa8C28Cdc37688F6F7f",
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
  // UniPoolerV2: the live index-4 dispatcher since the phStaging2 story 103 cutover (2026-10-23).
  // phStaging2 story 107 removed the Balancer keys (BalancerPool/Vault/Router and the retired,
  // paused and empty BalancerPooler 0x7f6874332c4629429d70D15f685A8230323F11F1).
  UniPooler: "0x56997ea45091CBc01DB8a09E60DEDB8b3706a3D2",
  // UniswapHelper swap/liquidity periphery (phStaging2 story 110), deployed to mainnet by
  // story 111 (2026-10-23).
  UniswapHelper: "0x564810D5d9D31754C8dbdb8F62Bb429D50Dfa5b3",
  // phStaging2 story 114: the Antimatter/sUSDS pair and its seeder are not on mainnet yet, and
  // the live UniswapHelper above predates story 120's AM routes. ZERO until the cutover.
  AntimatterPoolSeeder: "0x0000000000000000000000000000000000000000",
  AntimatterSusdsPair: "0x0000000000000000000000000000000000000000",
  // phStaging2 story 116: not deployed on mainnet yet.
  SYAHarvester: "0x0000000000000000000000000000000000000000",
  GatherWBTC: "0xfd3775f2ccfb94b532b34b2b683e210ba4449880",
  MultiPooler: "0xd1E5774159381915f5579dFd68507E2614f67b51",
  // View contracts
  // Story 078: ViewRouter is now the ONLY view-related key. Every page is resolved with
  // `ViewRouter.pages(keccak256("<page>"))` — "deposit", "mint", … — not from this file.
  ViewRouter: "0xC17Ce1cE5ebB43fc0cfda9Fe8BbC849c0894631a",
  // NFT staking
  // Still the live index-4 mint-debt hook: the story 103 cutover repointed it at UniPooler
  // rather than deploying a new one, so the "Balancer" in the key name is historical.
  BalancerPoolerMintDebtHook: "0x4A26ad83306a2F17155799fDD9449f77eb3F8bD7",
  NFTStaker: "0xc8514f821a3d801fa8a8c435840a992a4365a13b",
  WaUSDC: "0xd4fa2d31b7968e448877f69a96de69f5de8cd23e",
  NudgeStreamer: "0xF7e26179D6971985107AF66b078932D6484eBEAA",
  BatchNFTMinter: "0x068395556b8c43eDf257DC54D109EA5910aE15c7",
  // Stable Staking. Story 080 RETIRED the `StableStaker` key and replaced it with
  // `StableStakerV2`, deliberately dropping the live V1 address
  // (0xbce8ABC09BaEDCabE93419bF875f6186e182079A, deployed 2026-06-10 by
  // ResumeStableStakerMigration, story 055) out of the registry entirely, so the UI keeps no
  // straggling V1 reference through the cutover. This is safe because the tooling that still
  // needs V1's address hardcodes it rather than looking it up here
  // (scripts/gather-migration-inputs.js, and the archived migration scripts).
  //
  // Story 082: StableStakerV2 and Antimatter deployed by the V1 -> V2 cutover and patched
  // from progress.stable-staker-v2-cutover.1.json. V1 is drained (every pool Migrating,
  // phUSD mint revoked) and retired: paused, and unregistered from the Pauser (story 083);
  // the transient CrossVersionMigrator deliberately has no key.
  StableStakerV2: "0xA6d3fc83C91B8319D219cEB12B46e3dfF064B58F",
  // The Antimatter reward token StableStakerV2 pays instead of phUSD.
  Antimatter: "0x9CA92B527012DfC6Fdca7B7493C722D5901FF151",
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

/**
 * Sepolia testnet contract addresses
 */
export const sepoliaAddresses: ContractAddresses = {
  PhUSD: "0x044B41A11Ecd2F86bd229146A2b9f0205a8a0Ec3",
  USDC: "0xb4BE9A04CD2C43a714BFd1Af01AD7C351AFce61e",
  USDS: "0xBf764DE8F77362Ea1988F3A93c059Fd2a882C764",
  SUSDS: "0x332266d5D7dfEc33248299AC9535E07467887220",
  USDe: "0xB4E9a4Eacc6A0C50F2895988929aEe9B46600d46",
  SUSDe: "0x134B4C6137335947f80133192cc34FFa6E7D5dAd",
  Dola: "0xb882D9124D722c46B9a7F950C7e8430387E53c69",
  EYE: "0xA1D0d1f08241E40B2a8Ef0b942d330b01494eBb5",
  SCX: "0x743c47999665427583687663fBA9c1A59DEE9611",
  Kendu: "0x25C11681214B0d26016396190a74edBe3228A3c8",
  Flax: "0xb119308B2c1f80D8cDCB63091bcF01E04F33E60B",
  WBTC: "0xdbE2E0680fdfE04e1397eF89F0d53b1cF0729F73",
  Pauser: "0x89F9a7440cAFf6CB6C5C26E9E27B1036002e18f1",
  AutoDOLA: "0xd1D13C6f03c93c6Bb1113f649b1512A686eBc587",
  YieldStrategyDolaLegacy: "0x9AA71E60070e02Aae071c7248F0F0A293eC8cf24",
  SDOLA: "0x048E004B4600Ea61dF2756E08ee03104FFE3Db58",
  YieldStrategyDola: "0x505f14596Dc285F88E5d69D1F9A94B12f8354fB4",
  AutoUSDC: "0xFe83d36760Ce2Cc82C16bfeA1A609aCB304E0Aef",
  YieldStrategyUSDC: "0x4762dE8264dC97302A3bA76a39398D9A852C2674",
  USDeAMMAdapter: "0xc25374722EC144583A3846F996544901F513a922",
  YieldStrategyUSDe: "0x802e4d416633B2844628c4876daB5E05D70eA0eA",
  PhusdStableMinter: "0x45dBC280F7C88769E13a7279616D3cDFc3630EbA",
  PhlimboV3: "0x6AeCf8Af97e170627d3Ea0da766Ec8Fc8d19aDA1",
  StableYieldAccumulator: "0x3c884831e49E3Fef848300D2819905872fb1a70e",
  BurnRecorder: "0xfbf3Cd061674a12652B431FBa220975132c5Ea45",
  NFTMinter: "0xea6f1f838D3676fde5D28fB57E2f69844DFf206F",
  UniswapV2Router: "0x1e61AD0282e6B34849292dF4419a922577bf2b14",
  UniboostEYE: "0x77f420f122A041Bc6b7a5B6bcb4FC73f741C00D6",
  UniboostSCX: "0xF28a02932939112d224301462a3A1B56c870b8D3",
  UniboostFLX: "0x2cf5D5Ff3cf213019849C54B521d5Cb5FbF9c726",
  GatherWBTC: "0x3c4f40bbd5937AF11D3D668Cb868c442789D16fb",
  MultiPooler: "0xe5B2868b14969593a51Ecf088ef9f890f5761d4c",
  UniboostHookEYE: "0x6557b110C3fD36DE52AE0e9eD3a4E4e7D53BBe4f",
  UniboostHookSCX: "0x8315C0c4eA087Cf99d9B08736348b77DB7d2bBC9",
  UniboostHookFLX: "0xF15e9103028e2711311ad6a4881B20A9aDdC9CFE",
  WaUSDC: "0xCC3239510d732C08491178c660710E4C2F25A3d8",
  SkyPSM: "0xa973eDeB218c8Ec9455ABB44C7590d70e7568f54",
  BalancerPoolerMintDebtHook: "0xd517770c9901d6Fd93c1eD5c040e105b890b23A9",
  NFTStaker: "0x916Ce79D8aBC505A9133bC43E691616aC80A6ba7",
  NudgeStreamer: "0xE643FF8BB39CdD3D5251CB91b08c1EbF8fb0FFe6",
  BatchNFTMinter: "0x8Adbef094bEEAcC09e0da4c52027de34c07e7933",
  UniboostStakerEYE: "0x7f84Cb6b7C24B7D28C4d3940Fc7c4719DE0d64Cf",
  UniboostStakerSCX: "0x65d7418305Be09e4f517cf6665068d6aA562EbCc",
  UniboostStakerFLX: "0x9eD5a8b82ecA5a2664d780ec3609f30dF75e8Ee6",
  EyeBatchNFTMinter: "0xF9AbCD84A1C5fc176625119C10A677D43101c1C2",
  ScxBatchNFTMinter: "0x10a3D73cC6493eD8f832567c673082b59e2f58D2",
  FlxBatchNFTMinter: "0xD36047ef9c500019FDA9d41d078DCb5ef8348c11",
  NudgeRatchet: "0x1C8291b2B1d9c1B5C963e1d3650Dec0E87058C10",
  NudgeRatchetMintDebtHook: "0x7efADdb967136636dEb2AB7FF96ffdB5c103A8af",
  RatchetNFTStaker: "0x1cF98d0e33DDbCad059c544FA92b8b64757875c6",
  RatchetBatchNFTMinter: "0x988506cE8f4B8f537Ff5F179d7BbF45993E0d487",
  Antimatter: "0xbb706B36b5829F49C5B99b5A107eF7DA89EdC88d",
  StableStakerV2: "0xe1cD2238340c4c8bFc5F7d8837A8ca7c567BDa65",
  ViewRouter: "0x636708D7FD2f6Ff3686Fca511b3814E106303b27",
  UniPooler: "0x0747746009531f94989cb1Fa40239aec44db2AC1",
  PhusdSusdsPair: "0xF80dE933A8dd6059a5E99334A2121e335c853d16",
  UniswapHelper: "0xCA7a62943Fc95f47fde1c35A5FecD37a7483a93B",
  AntimatterPoolSeeder: "0x0000000000000000000000000000000000000000",
  AntimatterSusdsPair: "0x0000000000000000000000000000000000000000",
  SYAHarvester: "0x0000000000000000000000000000000000000000",
};
