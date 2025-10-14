# Transaction Framework Documentation

## Overview

This document describes the reusable transaction framework implemented for Phoenix UI. The framework provides comprehensive state management, error handling, and user feedback for Web3 transactions.

## Architecture

The transaction framework consists of three main components:

### 1. Type Definitions (`src/types/transaction.ts`)

Defines all transaction-related types:
- `TransactionStatus`: Status constants (IDLE, PENDING_SIGNATURE, PENDING_CONFIRMATION, SUCCESS, FAILED, CANCELLED)
- `TransactionErrorType`: Error type constants (USER_REJECTED, INSUFFICIENT_GAS, NETWORK_ERROR, etc.)
- `TransactionError`: Structured error information with type, message, and recoverability
- `TransactionState`: Complete transaction state including status, hash, and error information

### 2. Error Utilities (`src/utils/transactionErrors.ts`)

Provides error parsing and categorization:
- `parseTransactionError(error)`: Parses raw errors into structured TransactionError objects
- `getErrorTitle(errorType)`: Returns user-friendly error titles
- `shouldOfferRetry(errorType)`: Determines if retry should be offered

### 3. Transaction Hooks (`src/hooks/useTransaction.ts`)

Reusable hooks for transaction management:
- `useTransaction(transactionFn, config)`: Generic transaction management hook
- `useApprovalTransaction(approveFn, config)`: Specialized hook for ERC20 approvals

## Usage Examples

### Basic Token Approval

```typescript
import { useApprovalTransaction } from '../hooks/useTransaction';
import { useTokenApproval } from '../hooks/useContractInteractions';
import { useToast } from '../components/ui/ToastProvider';

function MyComponent() {
  const { addToast } = useToast();
  const { approve } = useTokenApproval();

  const approvalTransaction = useApprovalTransaction(
    async () => {
      return approve(
        tokenAddress,
        spenderAddress
        // Default: maxUint256 for unlimited approval
      );
    },
    {
      onSuccess: (hash) => {
        addToast({
          type: 'success',
          title: 'Approval Successful',
          description: 'Token spending has been approved.',
        });
      },
      onError: (error) => {
        console.error('Approval failed:', error);
      },
      onStatusChange: (status) => {
        if (status === 'PENDING_SIGNATURE') {
          addToast({
            type: 'info',
            title: 'Confirm in Wallet',
            description: 'Please confirm the transaction in your wallet.',
          });
        }
      }
    }
  );

  const handleApprove = async () => {
    await approvalTransaction.execute();
  };

  return (
    <button
      onClick={handleApprove}
      disabled={approvalTransaction.state.isPending || approvalTransaction.state.isConfirming}
    >
      {approvalTransaction.state.isPending ? 'Confirming...' :
       approvalTransaction.state.isConfirming ? 'Mining...' :
       'Approve'}
    </button>
  );
}
```

### Generic Transaction

```typescript
import { useTransaction } from '../hooks/useTransaction';
import { useWriteContract } from 'wagmi';

function MyComponent() {
  const { writeContractAsync } = useWriteContract();

  const transaction = useTransaction(
    async () => {
      return writeContractAsync({
        address: contractAddress,
        abi: contractAbi,
        functionName: 'deposit',
        args: [amount],
      });
    },
    {
      onSuccess: (hash) => {
        console.log('Transaction successful:', hash);
      }
    }
  );

  return (
    <button onClick={() => transaction.execute()}>
      Execute Transaction
    </button>
  );
}
```

## Transaction States

The framework manages the following states:

1. **IDLE**: No transaction in progress
2. **PENDING_SIGNATURE**: Waiting for user to confirm in wallet (MetaMask popup)
3. **PENDING_CONFIRMATION**: Transaction submitted, waiting for block confirmation
4. **SUCCESS**: Transaction confirmed on blockchain
5. **FAILED**: Transaction failed due to error (revert, network error, etc.)
6. **CANCELLED**: User cancelled transaction in wallet

## Error Handling

The framework categorizes errors into types:

- **USER_REJECTED**: User cancelled in wallet (no retry offered)
- **INSUFFICIENT_GAS**: Not enough gas to execute (retry offered)
- **NETWORK_ERROR**: RPC or connection error (retry offered)
- **CONTRACT_REVERT**: Smart contract execution failed (retry offered)
- **WRONG_NETWORK**: User on incorrect network (retry offered)
- **UNKNOWN_ERROR**: Uncategorized error (retry offered)

### Error Recovery

```typescript
if (transaction.state.error) {
  const { error } = transaction.state;

  addToast({
    type: 'error',
    title: getErrorTitle(error.type),
    description: error.message,
    action: shouldOfferRetry(error.type) ? {
      label: 'Retry',
      onClick: () => transaction.retry()
    } : undefined
  });
}
```

## Toast Integration

The framework integrates with the toast notification system:

```typescript
onStatusChange: (status) => {
  if (status === 'PENDING_SIGNATURE') {
    addToast({
      type: 'info',
      title: 'Confirm in Wallet',
      description: 'Please confirm the transaction in your wallet.',
      duration: 0, // Don't auto-dismiss during pending states
    });
  } else if (status === 'PENDING_CONFIRMATION') {
    addToast({
      type: 'info',
      title: 'Transaction Submitted',
      description: 'Waiting for blockchain confirmation...',
      duration: 0,
    });
  }
}
```

## Best Practices

1. **Always provide user feedback**: Use toast notifications for all transaction states
2. **Disable buttons during transactions**: Check `isPending` and `isConfirming` states
3. **Handle all error types**: Provide specific messages for different error scenarios
4. **Default to maxUint256 approvals**: Minimize future approval transactions
5. **Offer retry for recoverable errors**: Use `shouldOfferRetry()` to determine when
6. **Don't auto-dismiss pending toasts**: Set `duration: 0` for PENDING states
7. **Include transaction links**: Provide block explorer links in success toasts
8. **Reset state appropriately**: Call `reset()` when needed (e.g., when amount changes)

## Future Transaction Stories

When implementing new transactions (deposit, withdraw, swap, etc.), follow this pattern:

1. Create a transaction function using wagmi hooks
2. Wrap it with `useTransaction()` hook
3. Implement callbacks for success, error, and status changes
4. Integrate toast notifications for user feedback
5. Handle button states based on transaction state
6. Provide retry mechanism for recoverable errors

## Files

- **Types**: `src/types/transaction.ts`
- **Error Utils**: `src/utils/transactionErrors.ts`
- **Hooks**: `src/hooks/useTransaction.ts`
- **Contract Interactions**: `src/hooks/useContractInteractions.ts`
- **Example Implementation**: `src/pages/VaultPage.tsx` (DOLA approval)

## Testing Checklist

- [ ] Test successful approval flow
- [ ] Test user cancellation in wallet
- [ ] Test network errors (disconnect during transaction)
- [ ] Test contract revert scenarios
- [ ] Test wrong network scenarios
- [ ] Verify toast notifications appear at correct times
- [ ] Verify button states during all transaction phases
- [ ] Verify allowance refreshes after successful approval
- [ ] Verify transaction hash links to block explorer
- [ ] Verify retry functionality for failed transactions
