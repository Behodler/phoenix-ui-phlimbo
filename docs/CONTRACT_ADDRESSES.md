# Contract Address Loading

## Overview

The Phoenix UI implements automatic network detection and contract address loading based on the connected blockchain network. This document explains how the system works and how to use it in your components.

## Supported Networks

### Mainnet (Chain ID: 1)
- Uses hardcoded contract addresses defined in `/src/lib/contracts.ts`
- Addresses are immediately available (no loading state)
- **Important**: Current addresses are placeholders marked with TODO comments
- Before mainnet launch, replace all placeholder addresses with actual deployed contract addresses

### Local Anvil (Chain ID: 31337)
- Fetches addresses dynamically from local development server
- Server endpoint: `http://localhost:3001/contracts`
- Addresses are loaded asynchronously with loading state
- Fresh addresses loaded on each Anvil restart

### Other Networks
- Currently unsupported
- Returns error state with appropriate message
- Future: Testnet support planned (chain ID TBD)

## Architecture

### Components

1. **TypeScript Interfaces** (`/src/types/contracts.ts`)
   - `ContractAddresses`: Unified interface for all contract addresses
   - `LocalAddressServerResponse`: Response structure from local dev server
   - `NetworkType`: Enum for network types (mainnet, local, unsupported)

2. **Network Detection** (`/src/lib/networkDetection.ts`)
   - `getNetworkType(chainId)`: Determines network type from chain ID
   - `isMainnet(chainId)`: Check if mainnet
   - `isLocalAnvil(chainId)`: Check if local Anvil

3. **Address Fetching** (`/src/lib/addressFetcher.ts`)
   - `fetchLocalAddresses()`: Fetches addresses from local dev server
   - Handles errors gracefully (server not running, invalid response, etc.)
   - Maps local contract names (mockAutoDolaVault, mockMainRewarder) to unified interface

4. **Contract Constants** (`/src/lib/contracts.ts`)
   - `MAINNET_CONTRACT_ADDRESSES`: Hardcoded mainnet addresses
   - **TODO**: Replace placeholder addresses before mainnet deployment

5. **React Context** (`/src/contexts/ContractAddressContext.tsx`)
   - `ContractAddressProvider`: Provider component that loads addresses
   - `useContractAddresses()`: Hook to access addresses in components

## Usage

### 1. Provider Setup (Already Configured)

The `ContractAddressProvider` is already configured in `/src/main.tsx`:

```tsx
<WagmiProvider config={wagmiConfig}>
  <QueryClientProvider client={qc}>
    <RainbowKitProvider theme={darkTheme()}>
      <ContractAddressProvider>
        <App />
      </ContractAddressProvider>
    </RainbowKitProvider>
  </QueryClientProvider>
</WagmiProvider>
```

### 2. Using Contract Addresses in Components

Import and use the `useContractAddresses` hook:

```tsx
import { useContractAddresses } from '../contexts/ContractAddressContext'

function MyComponent() {
  const { addresses, loading, error, networkType } = useContractAddresses()

  // Handle loading state
  if (loading) {
    return <div>Loading contract addresses...</div>
  }

  // Handle error state
  if (error) {
    return <div className="text-red-500">Error: {error}</div>
  }

  // Handle missing addresses
  if (!addresses) {
    return <div>No addresses available</div>
  }

  // Use addresses
  return (
    <div>
      <p>Network: {networkType}</p>
      <p>DOLA Token: {addresses.dolaToken}</p>
      <p>AutoDola Vault: {addresses.autoDolaVault}</p>
      {/* ... use other addresses ... */}
    </div>
  )
}
```

### 3. Available Addresses

The `addresses` object contains:

- `dolaToken` - DOLA token contract address
- `tokeToken` - TOKE token contract address
- `autoDolaVault` - AutoDola vault contract address
- `tokemakMainRewarder` - Tokemak main rewarder contract address
- `bondingToken` - Bonding token (ERC20) contract address
- `bondingCurve` - Behodler3Tokenlaunch contract address (mints bonding tokens)

**CRITICAL DISTINCTION**:
- `bondingCurve` is the **Behodler3Tokenlaunch contract** that **MINTS** bonding tokens (the factory/minter)
- `bondingToken` is the **ERC20 token** that is **PRODUCED** by the bonding curve (the product)

### 4. Context State Properties

```tsx
interface ContractAddressContextState {
  addresses: ContractAddresses | null  // Contract addresses (null if not loaded or error)
  loading: boolean                      // True while fetching addresses
  error: string | null                  // Error message if loading failed
  networkType: NetworkType              // Current network type (mainnet/local/unsupported)
}
```

## Local Development Setup

### Starting the Address Server

When running on local Anvil, you need to start the address server:

1. Ensure Anvil is running on `http://localhost:8545`
2. Start the address server on port 3001
3. The server must respond to `GET http://localhost:3001/contracts` with:

```json
{
  "networkId": 31337,
  "networkName": "anvil",
  "deployedAt": "2025-10-11T20:52:12.496Z",
  "rpcUrl": "http://localhost:8545",
  "contracts": {
    "dolaToken": "0x...",
    "tokeToken": "0x...",
    "mockAutoDolaVault": "0x...",
    "mockMainRewarder": "0x...",
    "bondingToken": "0x...",
    "bondingCurve": "0x..."
  }
}
```

### Error Handling

If the address server is not running, users will see:
```
Local address server is not running at http://localhost:3001/contracts.
Please start the address server before running the UI in local development mode.
```

## Console Logging

The system provides detailed console logging for debugging:

### Network Detection
```
🌐 Network detected: { chainId: 31337, networkType: 'local' }
```

### Mainnet Addresses
```
🏦 Loading mainnet contract addresses
```

### Local Address Fetching
```
🔧 Fetching contract addresses from local server...
📍 Loaded contract addresses from local server: {
  networkId: 31337,
  networkName: 'anvil',
  deployedAt: '2025-10-11T20:52:12.496Z',
  addresses: { ... }
}
```

### Errors
```
❌ Unsupported network (Chain ID: 42161). Please connect to Mainnet or Local Anvil.
❌ Error loading contract addresses: [error message]
```

## Testing

### Test with Mainnet
1. Connect wallet to Mainnet (chain ID 1)
2. Check console for: `🏦 Loading mainnet contract addresses`
3. Verify addresses are displayed in UI footer
4. Note: Current addresses are placeholders (0x000...000)

### Test with Local Anvil
1. Start local Anvil: `anvil`
2. Start address server on port 3001
3. Connect wallet to Local Anvil (chain ID 31337)
4. Check console for: `🔧 Fetching contract addresses from local server...`
5. Verify addresses are fetched and displayed

### Test Error Handling
1. Connect to Local Anvil without starting address server
2. Verify error message is displayed
3. Connect to unsupported network (e.g., Arbitrum)
4. Verify unsupported network error is displayed

## UI Display

The VaultPage footer displays current network and contract addresses for debugging:

- Network Type (mainnet/local/unsupported)
- Loading state indicator
- Error messages (if any)
- All six contract addresses when loaded (including bondingCurve)

## Pre-Production Checklist

Before deploying to mainnet:

- [ ] Replace all placeholder addresses in `/src/lib/contracts.ts`
- [ ] Remove or disable debug footer display
- [ ] Test with actual mainnet contract addresses
- [ ] Verify addresses match deployed contracts
- [ ] Update documentation with actual addresses

## Future Enhancements

- **Testnet Support**: Add testnet detection and addresses (chain ID TBD)
- **Multi-Network**: Support for multiple networks simultaneously
- **Address Validation**: Checksum validation for addresses
- **Fallback Mechanism**: Fallback addresses if primary source fails
