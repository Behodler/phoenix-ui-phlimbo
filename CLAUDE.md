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
- Contract ABIs are generated in `/src/generated/wagmi.ts` via wagmi codegen

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
- Contract hooks auto-generated from ABIs
- Configuration in `wagmi.config.ts`
- Generated code in `/src/generated/wagmi.ts`

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
- `/src/generated/wagmi.ts` - Auto-generated wagmi hooks (DO NOT EDIT)

## Story Execution

When executing stories:
1. Read this file first to understand project conventions
2. Check existing implementations before proposing changes
3. Use `yarn dev` to test all contract interactions
4. Ensure big number conversions are correct (10^18 scaling)
5. Verify contract address loading works for both mainnet and local

## NFT Tab — Mock Data Only

The NFT tab (`src/components/vault/NFTTab.tsx`) uses **entirely mocked data** from `src/data/nftMockData.ts`. There are no contract calls, wagmi hooks, or on-chain interactions for NFT operations. All wallet balances, token prices, approval states, and minting actions are simulated in local component state. Do not add real contract integration to the NFT tab without explicit instruction to do so.

## Questions?

If unclear about:
- **Naming conventions**: Check `/src/types/contracts.ts` for documentation
- **Contract interactions**: Review `/src/hooks/useContractInteractions.ts`
- **Address loading**: See `/src/lib/addressFetcher.ts`
- **Development setup**: Read `README.md` for detailed instructions
