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
  // Story 121: user-facing Balancer V3 phUSD/sUSDS BPT -> UniV2 phUSD/sUSDS migrator (BalancerLPMigrator),
  // deployed by DeployBalancerLPMigratorMainnet and patched from progress.balancer-lp-migrator.1.json.
  // The BPT has no key: read it from BalancerLPMigrator.pool().
  BalancerLPMigrator: "0x94f69b2eB445A8a74400FF3282d861CA0341cBd0",
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
  PhUSD: "0x461Ab86C95C897a0f08C093c03E630A40720eb80",
  USDC: "0xEf8EafF274ea22699ecE0C2fdadBc71174c2d343",
  USDS: "0xB8798BA31A38BEce09D9b1208C09284Ed6b9e172",
  SUSDS: "0x6Aca0214450E84DE6eFCFeD306b2c78410E29C3f",
  USDe: "0x89C22fc5C1D317bd065569413ceefB3A98EB1906",
  SUSDe: "0x2C7aA7958a49E0b960f9098e3Bd038a67B5c82D7",
  Dola: "0x23B93cD07306c4DD42C2F1cb1124f9195Ffb4519",
  EYE: "0x0d1953F3F06E052E52EDd7BaCa61b9d50102eb94",
  SCX: "0x2b7c7070D14c1bf003493cCaFe5C4e3e2b3Fc5c4",
  Kendu: "0xbfcB85a6b05dAF94dA50D55516c8F88D16C98526",
  Flax: "0x603B08cF608018b87560224a1C8a1312765D587b",
  WBTC: "0x20844bCd0dCb0083004181823B75Ea1C3382a074",
  Pauser: "0x62AD294b0266c731571581BF9d93cc445D7431a8",
  AutoDOLA: "0xf0b74C01cdD8b167A2a2C8c30E69BF7f222d91F6",
  YieldStrategyDolaLegacy: "0x3dAe95ACca97E86803Ad9F2974F7b1F55a6D8268",
  SDOLA: "0x0C4E2A7Af63010Aa53657F4673B38E6A7b91D5B3",
  YieldStrategyDola: "0x115e0f4492753FF4B77bf8c890Af865D63d45C66",
  AutoUSDC: "0x3ACDdE819FEcC4972561622a120fb6284475b8Ae",
  YieldStrategyUSDC: "0xb63f43Fc3de0001DB01aD1b0740138F2448FF5Cf",
  USDeAMMAdapter: "0x4e083D1Ba85a37198db847b659491E6782401fa2",
  YieldStrategyUSDe: "0xe77774BC86F40f195260474D2E097A8f16356Cda",
  PhusdStableMinter: "0x62F96B41aAC8C08F4B0d79AeB339170a1a05ae24",
  PhlimboV3: "0x17D56F8D333d1590bB5DD3e3D119b79754c7d4cC",
  StableYieldAccumulator: "0x89757e3886033192F755EB1A3B5F966EA90b0453",
  BurnRecorder: "0x034AAdF2192F9DF5f06cD7A06813C39f07F04d36",
  NFTMinter: "0xF666Cc3953509D4973945EE8edB1D60Db3030693",
  UniswapV2Router: "0xC92a6e0DF181775e1150F6F0B2126EF6625e5371",
  UniboostEYE: "0xE763BB4a57f7424B1a8cc6eFAc66f5B8d6BC76C3",
  UniboostSCX: "0xD61bF2c6155ee526418f56b1Ace9fe0c96107b6C",
  UniboostFLX: "0x2690411e7Ee64606EcBc66A4B5696106ef86B037",
  PhusdSusdsPair: "0x03039f55445C2174A36A5A8824cabbcd92122d60",
  UniPooler: "0x3D57F94CBd93A8245dEEb41fc7d8A548D8b5A680",
  BalancerPoolerMintDebtHook: "0xe5A8dfc78bD7360Aeb46F9549b3CA9706a7a648a",
  GatherWBTC: "0xF1200929436345D606a7FCF5B746d2CcCbEcBaCc",
  MultiPooler: "0xdCcbbABBd668c0Ffce62e4cABF534d03f6f975b0",
  UniboostHookEYE: "0xf64BEbbCf5b95a763459c3A27FD72f0CfF802525",
  UniboostHookSCX: "0x0c41ab540ac284cF7F25148C354bC598d0eBcD4b",
  UniboostHookFLX: "0x9595538898cE9D10c66D5e9157432254618BA02a",
  WaUSDC: "0x6e4981C487f56111580fad277053774af391487e",
  SkyPSM: "0x3c6E58DF1E9010c24C191ccD0301B65F8458128d",
  NFTStaker: "0xb12F771E9EcBb8DfD89E299A76ba5cb141Cad3E5",
  NudgeStreamer: "0xf1B85978560a6DD2bBC04bbeEBda13e24Bc8326C",
  BatchNFTMinter: "0x4108EC70B1bE15C6198f386a152442B604DeE9F7",
  UniboostStakerEYE: "0x0Ba847420d9a00b45930A5987Ebd5B5D4b2424A0",
  UniboostStakerSCX: "0x07717272ba252F1587348C389a2BC3800D5bc16F",
  UniboostStakerFLX: "0x00EcDa2a52C86A4Edb3A46849F1521DF4392a552",
  EyeBatchNFTMinter: "0x8094bE9E4D0E10ca52Dd9603479D00B5916d05d0",
  ScxBatchNFTMinter: "0xeCEF5FE52Da6D585D3e288F692EB3d6d9c993eD2",
  FlxBatchNFTMinter: "0x822edE4F6786753B728Fa408F7497146a152eF8b",
  NudgeRatchet: "0xB52Bd42Ab14F3587739a878ae7FC6dED9bFa04Bc",
  NudgeRatchetMintDebtHook: "0x40A8bA8063aDB913e50fEBf816f6e94BF27683e3",
  RatchetNFTStaker: "0xa1C1b9cd421B861AF2952cEd51D0c916E628728F",
  RatchetBatchNFTMinter: "0x26902D3F71A49BFaa4DC9734efC7C5b3445D907e",
  Antimatter: "0x9Af91b0aDBfF78608312b443e4283C97A9286E23",
  StableStakerV2: "0x8D9B8dF6F4070122702A96f73879614d69c55C1f",
  ViewRouter: "0xB07d025cfdA05f692c98187e4a38CF00701b6447",
  UniswapHelper: "0x8511dcD54B2071921f549F96a81E5B9A0D6dE021",
  AntimatterPoolSeeder: "0xb6fE42437803cd1dF0757AaB4255E2ec1A901dB0",
  AntimatterSusdsPair: "0x1dD2Da9B6faf90b9500bAcf3ea4F90Ff7b1aA388",
  SYAHarvester: "0x995C633DF7E0E10E0A0486171B420464C4F2B53F",
  BalancerLPMigrator: "0x0000000000000000000000000000000000000000",
};
