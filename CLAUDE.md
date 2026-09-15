# CLAUDE.md - Phoenix UI Features Sprint

This file provides guidance to Claude Code agents when working on the Phoenix UI project.

## Project Overview

Phoenix UI is a React + TypeScript + Vite decentralized application for interacting with Ethereum smart contracts. It connects to both mainnet and local Anvil development networks.

## Critical Naming Conventions

### Bonding Curve Contract Naming

**IMPORTANT**: There is a deliberate naming difference between the deployment server response and Phoenix UI's internal interface:

- **External API (deployment-staging)**: Uses `behodler3Tokenlaunch` as the field name
- **Phoenix UI Internal**: Maps this to `bondingCurve` for cleaner, more intuitive naming

**This is intentional and by design.** The mapping happens in the address fetcher layer. The `behodler3Tokenlaunch` contract from the deployment server is the bonding curve minter contract that accepts DOLA deposits.

**Do NOT raise concerns or create tasks to "fix" this naming mismatch** - it is already handled correctly in:
- `/src/types/contracts.ts` (lines 17-39 document this mapping)
- `/src/lib/addressFetcher.ts` (performs the actual mapping)

### Contract Address Terminology

- **bondingCurve**: The Behodler3Tokenlaunch contract that MINTS bonding tokens (the factory/minter)
- **bondingToken**: The ERC20 token PRODUCED by the bonding curve (the product)

These are two different contracts with different purposes. Do not confuse them.

## Numeric Data Conventions

### Big Number Handling

**All ERC20 token amounts and balances use 18 decimal places (10^18 scaling).**

This includes:
- Token balances (DOLA, TOKE, bonding tokens)
- Approval amounts
- Transfer amounts
- Price values from bonding curve contract functions

**Always convert between wei and human-readable formats:**
- Contract → UI: Divide by 10^18 (or use ethers.utils.formatEther)
- UI → Contract: Multiply by 10^18 (or use ethers.utils.parseEther)

Example:
```typescript
// Contract returns: 1500000000000000000 (1.5 * 10^18)
// Display as: "1.5 DOLA"

// User inputs: "1.5"
// Send to contract: 1500000000000000000
```

## Development and Testing

### Running the Development Environment

```bash
yarn dev
```

This single command:
1. **Starts Anvil blockchain**: Local Ethereum test network
2. **Deploys mock contracts**: All required contracts deployed to Anvil
3. **Starts address server**: Contract addresses available at `http://localhost:3001/contracts`
4. **Starts Vite dev server**: UI available at `http://localhost:5173`

### Testing Contract Interactions

When implementing or testing contract interaction features:
1. Ensure `yarn dev` is running (provides full local environment)
2. Contract addresses are dynamically loaded from `http://localhost:3001/contracts`
3. All contracts are pre-deployed and ready to interact with
4. Use browser console or React DevTools to inspect contract calls
5. Check Anvil output for transaction logs

### Testing Workflow

**DO NOT attempt to run contracts locally in the worktree.** The local code is for source control only.

For testing:
- Use `yarn dev` for local development with Anvil
- For deployed Lambda functions (if any), test via remote invocation only
- Contract ABIs come from the pinned `@behodler/phase2-wagmi-hooks` npm package
  (`node_modules/@behodler/phase2-wagmi-hooks/generated.ts`), published from the phStaging2
  repo. There is NO local codegen: `src/generated/` does not exist, there is no `generate`
  script, and `wagmi.config.ts` is dead. Never run `wagmi generate`.

## Configuration

### Environment Setup

Create `.envrc` file (gitignored):
```bash
export DEPLOYMENT_SERVER_PATH=~/code/reflax-mint/deployment-staging
```

This points to the deployment server that manages contract deployments and address serving.

## Architecture Notes

### Contract Address Loading

Phoenix UI uses a dynamic contract address system:
- **Mainnet**: Hardcoded addresses in `/src/lib/contracts.ts`
- **Local Development**: Fetched from `http://localhost:3001/contracts`
- **Network Detection**: Automatic based on connected wallet chain ID

The `ContractAddressContext` provides contract addresses throughout the app.

### Wagmi Integration

Uses wagmi v2 for Web3 interactions:
- ABIs are `as const` exports from `@behodler/phase2-wagmi-hooks` (pinned exactly in
  `package.json`). The package emits **ABIs only** — no `useRead…`/`useWrite…` hooks — so the
  app always calls `useReadContract({ address, abi, functionName })` itself.
- Addresses resolve dynamically through `addressFetcher` / `ViewRouter` into
  `ContractAddresses` (`src/types/contracts.ts`); never hardcode an address.
- `wagmi.config.ts` is a dead artifact of an abandoned local-codegen path. Do not run it.

## Common Pitfalls

1. **DO NOT** try to change deployment-staging to use `bondingCurve` - it uses `behodler3Tokenlaunch` by design
2. **DO NOT** forget to convert wei ↔ decimal when displaying/sending token amounts
3. **DO NOT** confuse `bondingCurve` (minter contract) with `bondingToken` (ERC20 product)
4. **DO NOT** test Lambda functions locally - they must be invoked remotely if they exist
5. **DO** use `yarn dev` for all local testing - it handles the full environment setup

## Key Files

- `/src/types/contracts.ts` - Contract address type definitions and documentation
- `/src/lib/contracts.ts` - Mainnet contract addresses
- `/src/lib/addressFetcher.ts` - Dynamic address loading logic
- `/src/contexts/ContractAddressContext.tsx` - React context for contract addresses
- `/src/hooks/useContractInteractions.ts` - Custom contract interaction hooks
- `/src/types/contracts.ts` - The local `ContractAddresses` interface (address-key source of truth)

## Story Execution

When executing stories:
1. Read this file first to understand project conventions
2. Check existing implementations before proposing changes
3. Use `yarn dev` to test all contract interactions
4. Ensure big number conversions are correct (10^18 scaling)
5. Verify contract address loading works for both mainnet and local

## NFT Tab — Real Contract Integration

The NFT tab makes **real on-chain calls** via wagmi — it is **not** mock-driven.

- **Minting** (`src/components/vault/NFTListMintModal.tsx`) reads live price / balance /
  allowance through `useMinterPageView` (decoding `MintPageView.getData()`) and executes
  real `approve` + `mint(dispatcherIndex, recipient)` transactions.
- **Staking** (`src/components/vault/StakingSurface.tsx` + `useStakingPageData`) reads live
  staked units / pending phUSD / rate-per-second / APY and executes real
  `setApprovalForAll` / `stake` / `unstake` / `claim` transactions.
- **`src/data/nftMockData.ts` holds STATIC CONFIG ONLY** (names, images, decimals,
  `tokenPrefix`, and the prefix→address / prefix→price maps) — despite the filename, it is
  not a source of simulated on-chain values.

The admin-only **Stake Preview** accordion (`src/components/vault/stakeMock/`) began as a
mock (`nftStakeMockData.ts`); story 076 wires it to real per-staker contracts. After that,
`nftStakeMockData.ts` is a static per-staker **wiring descriptor**, not live-value mock data.

The admin-only **Whale Discount** sub-tab (`src/components/vault/whaleDiscount/`) is fully
wired. It began life as "Nudge-mock" (`nudgeMockData.ts`, since deleted) — do not look for
that fixture. Its data comes from `useNudgePot`:

- The reward token set is read from `BatchNFTMinterMultiToken.getNudgeTokens()`, never
  listed in the UI, so it adapts per chain on its own. **Do NOT hard-code a token list.**
- A reward leg is `balanceOf(minter) + NudgeStreamer.pendingStream(minter, token)`.
  `batchMint` calls `pullPendingStream` over the whole whitelist before it snapshots
  balances, so the accrued-but-unsettled amount is genuinely part of the payout. Using
  `balanceOf` alone under-reports the pot, sometimes by ~100%.
- `useLiveNudgePot` extrapolates that accrual between polls for the live counter. It is
  **display only** — `minRewards` must always be signed from the block-attested `totalRaw`,
  never from the extrapolation, or a browser clock ahead of `block.timestamp` reverts
  honest mints.
- `src/data/nudgeTokenMeta.ts` is static presentation only (art, links, price source),
  keyed by canonical symbol so one entry covers Anvil's `m`-prefixed mocks and mainnet.

_Historical note: this tab was mock-only very early in development. That has not been true
since the minter/staking wiring landed — do not treat the tab as mock-only._

## The `Stake` tab is real, contract-backed and routed

`Stake` (`src/components/vault/antimatter/`) is the public staking surface. It is **not** a
mock. Story 082 promoted the Antimatter design preview that stories 079 and 080 built into
this tab and wired it to contracts; the old `StakeV3Tab`, the `Stake (mock)` tab, and
`src/data/antimatterMockData.ts` were all deleted in the same story.

_Historical note: this surface was a deliberately fake design preview until story 082, and an
earlier revision of this file said it must never be wired to contracts. That was a placeholder
held until the backend existed. The backend now exists — `stable-staker` V2, `antimatter`, and
`@behodler/phase2-wagmi-hooks@0.15.0` — and the prohibition is withdrawn. Do not reinstate it._

The tab has two legs:

- **The phUSD farm**, `usePhlimboV3Pool` rendered through `StakeAccordionRow`. Reads
  `PhlimboV3`, which is deployed on every network.
- **Three stablecoin pools** (USDC / USDe / DOLA) on **`StableStakerV2`**, which accrues
  **Antimatter**, not phUSD. `useStableStakerPools` owns every read and write.

`src/data/antimatterData.ts` holds **STATIC CONFIG ONLY** — accent colours, copy, the sub-tab
union, the Antimatter decimals. Every figure a user sees is a chain read on the hook's 12 s
heartbeat.

### Things that are easy to get wrong here

- **Antimatter is annihilated, not claimed.** `autoAnnihilate(token)` matches accrued
  Antimatter against the user's own staked principal, destroys both sides and mints phUSD worth
  their sum. Use `antimatterAbi.toStableAmount(stable, amount)` to bridge 18-dec Antimatter to
  6-dec USDC — never hand-roll that scaling.
- **`toStableAmount` REVERTS on a sub-unit amount; it does not round.** Anything finer than one
  stable unit fails the call, and a live accrual is essentially never an exact multiple of
  `10 ** (18 - decimals)`. Floor the amount to that multiple before passing it in, exactly as the
  staker does (`netWanted = capped / scale`). Skipping the floor does not raise an error anywhere
  visible: the wagmi read just returns `undefined`, and every figure derived from it silently
  reads zero.
- **The accrued figure is `claimableReward`, never `pendingReward`.** `stake` and `withdraw`
  settle the outstanding projection into `unclaimedReward` and reset `rewardDebt`, so
  `pendingReward` restarts at zero every time the user touches the pool while the real balance
  sits in the backlog. `claimableReward` is `unclaimedReward + pendingReward`, which is the `owed`
  figure both `claim` and `autoAnnihilate` consume.
- **`claimEnabled()` is false by default.** Accrued Antimatter banks rather than pays until an
  owner opens the gate. Read the flag and hide the claim button, but do NOT put a banner on the
  panel about it: the gate is normal operating state, annihilation is unaffected by it, and the
  notice only reads as a fault.
- **Annihilation is gated on the phUSD price.** Net value per unit is `2p − 1`, so the action is
  disabled at `p <= 0.50` and when the price is genuinely unknown on mainnet. Use the **raw**
  `useBalancerPrice()` result for that decision — the repo's `?? 1.0` display clamp would turn a
  feed failure into an open gate. `stake` and `withdraw` are never gated this way: a user must
  always be able to exit.
- **APY is story 083's.** The stablecoin rows render `apy: null` as an em dash. Never `0`.
- **The annihilate sub-tab is its own component, `AnnihilatePanel`.** Every figure on it is
  extrapolated forward from `ratePerSecond` on one `requestAnimationFrame` loop, so the preview
  ticks continuously instead of stepping on the 12 s heartbeat. That extrapolation is free — the
  rate is already read for the row header — but it is **display only**: the button's
  enabled/disabled decision is taken on the block-attested `matchedStable` / `surplusAntimatter`,
  the same rule `minRewards` follows in the whale-mint flow. `AntimatterAccordionRow` stays
  hook-free because the hooks live in the panel, which mounts at most once.
- **The confirmation burst is CSS keyed on a counter, never a timer.**
  `AntimatterStakeRow.annihilationCount` increments when an annihilation receipt lands; the
  preview cells key their burst elements on it, so React remounts them and the keyframes restart.
  The white detonation on the two destroyed operands and the phUSD-orange bloom that follows are
  sequenced by a 300 ms `animation-delay` on the second, which is what lets
  `AntimatterAccordionRow` stay hook-free. Dropped under `prefers-reduced-motion`.
- **The reward token is called "Antimatter" on screen, never "AM".** `Antimatter.symbol()` returns
  the `AM` ticker and is deliberately not read for the label; `ANTIMATTER_DISPLAY_NAME` in
  `src/data/antimatterData.ts` is the single source.
- **Iterate the static `STABLE_POOLS` config, not `getStakedTokens()`.** One
  `useStablePoolReads` call per fixed entry is what satisfies the rules of hooks.
- **Zero-address guard.** `StableStakerV2` / `Antimatter` carry the zero address on mainnet
  until the deploy cutover. The hook resolves those to `undefined`, which disables every
  dependent read, and the rows report `inactive`. Acceptance is judged on Anvil via `yarn dev`.
- **Tailwind opacity modifiers on `pxusd-*` tokens emit no CSS.** The tokens are full hex behind
  a `var()`, so `border-pxusd-purple-300/45` compiles to the invalid `rgb(#C4AEEA / .45)` and the
  whole declaration is dropped. Use inline literal `rgba(...)`.

### `/staking` is DeFi Llama's deep-link target

The tab id is the literal string `"Stake"`, and `src/lib/tabRoutes.ts` maps `/stake`, `/staking`
and `/stake-v3` to it. **`/staking` is DeFi Llama's outbound deep-link target** — keeping the tab
id is what preserves it. Do not rename the tab, and do not add a new route.
`src/components/vault/stakeMock/` is a different thing entirely: the admin-only **NFT** staking
preview reached from `NFTListTab`, which merely shares the word "mock".

## Questions?

If unclear about:
- **Naming conventions**: Check `/src/types/contracts.ts` for documentation
- **Contract interactions**: Review `/src/hooks/useContractInteractions.ts`
- **Address loading**: See `/src/lib/addressFetcher.ts`
- **Development setup**: Read `README.md` for detailed instructions
