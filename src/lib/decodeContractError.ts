import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from 'viem';

/**
 * Friendly rendering of a failed transaction.
 */
export interface DecodedContractError {
  /** Human-readable description, safe to show in a toast. */
  message: string;
  /** The Solidity custom error name, when one was decoded. */
  errorName?: string;
  /** Decoded custom-error arguments, when present. */
  args?: readonly unknown[];
  /** True when the user dismissed the wallet prompt (not a contract failure). */
  userRejected: boolean;
}

/**
 * Custom errors we can explain better than their raw name.
 *
 * A handler receives the decoded args so it can quote the offending value.
 * Anything not listed here still surfaces its `errorName` rather than raw hex,
 * so an unmapped revert degrades gracefully instead of disappearing.
 */
const ERROR_MESSAGES: Record<string, (args: readonly unknown[]) => string> = {
  // --- BatchNFTMinterMultiToken -------------------------------------------
  BatchMint__ArrayLengthMismatch: (args) =>
    `The reward whitelist changed while you were confirming (expected ${String(args[0] ?? '?')} entries, sent ${String(args[1] ?? '?')}). Reload and try again.`,
  BatchMint__RewardBelowMinimum: (args) =>
    `The reward pot shrank below your minimum for token ${String(args[0] ?? '')} while the transaction was in flight. Reload to pick up the current pot and try again.`,
  BatchMint__PaymentBudgetExhausted: (args) =>
    `Your payment budget ran out partway through the batch (at mint ${String(args[0] ?? '?')}, price ${String(args[1] ?? '?')}). Increase the budget or mint fewer.`,
  BatchMint__NudgeTokenNotWhitelisted: (args) =>
    `Token ${String(args[0] ?? '')} is no longer an eligible reward token.`,
  BatchMint__NudgeTokenAlreadyWhitelisted: (args) =>
    `Token ${String(args[0] ?? '')} is already an eligible reward token.`,
  BatchMint__ZeroCount: () => 'The batch size must be greater than zero.',
  BatchMint__ZeroRecipient: () => 'A recipient address is required.',
  BatchMint__ZeroNudgeToken: () => 'A reward token address is required.',
  BatchMint__MinterNotConfigured: () =>
    'The batch minter has no NFT minter configured. This is a deployment issue, not something you can retry.',
  BatchMint__DispatcherNotConfigured: () =>
    'The batch minter has no payment dispatcher configured. This is a deployment issue, not something you can retry.',
  Rescue__ZeroRecipient: () => 'A recipient address is required.',

  // --- NudgeStreamer -------------------------------------------------------
  NudgeStreamer__NotRegistered: () => 'No reward stream is registered for this minter and token.',
  NudgeStreamer__NotWhitelisted: (args) =>
    `Token ${String(args[1] ?? '')} is not whitelisted on minter ${String(args[0] ?? '')}.`,
  NudgeStreamer__ZeroAmount: () => 'The amount must be greater than zero.',
  NudgeStreamer__ZeroDuration: () => 'The stream duration must be greater than zero.',
  NudgeStreamer__ZeroReceived: () =>
    'The token transferred nothing on receipt — it may be a fee-on-transfer or rebasing token.',

  // --- UniswapHelper (Market tab, story 087) --------------------------
  InsufficientOutput: (args) =>
    `The price moved past your slippage tolerance (would receive ${String(args[0] ?? '?')}, minimum ${String(args[1] ?? '?')}). Raise the slippage or try a smaller amount.`,
  Expired: (args) =>
    `The transaction deadline passed before it was mined (deadline ${String(args[0] ?? '?')}, block time ${String(args[1] ?? '?')}). Review and submit again.`,
  PairNotFound: () => 'The phUSD/sUSDS Uniswap pool does not exist on this network yet.',
  UnsupportedToken: (args) => `Token ${String(args[0] ?? '')} cannot be routed through the Uniswap market.`,
  ZeroAmount: () => 'The amount must be greater than zero.',
  ZeroAddress: () => 'A recipient address is required.',
  ETHTransferFailed: () => 'Sending ETH to your wallet failed. Check that the receiving address can accept ETH.',
  ETHNotAccepted: (args) => `The helper does not accept direct ETH transfers from ${String(args[0] ?? 'this sender')}.`,
  CurveCoinMismatch: () =>
    'A Curve pool on the route is misconfigured. This is a deployment issue, not something you can retry.',

  // --- SYAHarvester (Forge tab) ---------------------------------------------
  Unprofitable: (args) =>
    `The harvest would pay ${String(args[0] ?? '?')} wei of ETH, which does not cover its ${String(args[1] ?? '?')} wei gas cost.`,
  InsufficientEthOut: (args) =>
    `The harvest paid ${String(args[0] ?? '?')} wei, below your minimum of ${String(args[1] ?? '?')} wei. Someone may have harvested first.`,
  RouteNotConfigured: (args) =>
    `No sell route is registered for yield token ${String(args[0] ?? '')}. The harvester owner has to add one.`,
  EthPoolNotSet: () => 'The harvester has no ETH pool configured yet. This is a deployment issue.',
  EthTransferFailed: () => 'Paying the ETH out to your wallet failed.',
  ERC1155MissingApprovalForAll: () => 'Approve the Harvester to use your claim NFTs first.',
  ERC1155InsufficientBalance: () => 'You no longer hold the selected claim NFT.',

  // --- Antimatter (Forge tab) ---------------------------------------------
  InsufficientPhUSDOut: (args) =>
    `The phUSD exchange rate moved: the annihilation would pay ${String(args[1] ?? '?')}, below your minimum of ${String(args[0] ?? '?')}. Try again.`,
  AmountNotRepresentable: () => 'That amount is finer than the stablecoin can express. Use fewer decimals.',
  StablecoinNotRegistered: () => 'That stablecoin is not registered with the phUSD minter.',

  // --- shared --------------------------------------------------------------
  EnforcedPause: () =>
    'The contract is paused right now. If a promotion is flushing, it will unpause once the flush completes.',
  ExpectedPause: () => 'This action is only available while the contract is paused.',
  ReentrancyGuardReentrantCall: () => 'The contract rejected a re-entrant call.',
  OwnableUnauthorizedAccount: (args) =>
    `Account ${String(args[0] ?? '')} is not authorised to perform this action.`,
};

function looksLikeUserRejection(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('user rejected') || lower.includes('user denied');
}

/**
 * Turn a thrown wagmi/viem error into something worth showing a user.
 *
 * Reverts arrive as a nested `BaseError` chain; the custom error only becomes
 * legible after walking down to the `ContractFunctionRevertedError`. Without
 * this the UI shows raw revert data, which is what it did before.
 */
export function decodeContractError(error: unknown): DecodedContractError {
  const fallback = error instanceof Error ? error.message : 'Unknown error occurred';

  if (error instanceof BaseError) {
    const rejection = error.walk((e) => e instanceof UserRejectedRequestError);
    if (rejection || looksLikeUserRejection(fallback)) {
      return { message: 'Transaction cancelled.', userRejected: true };
    }

    const revert = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const errorName = revert.data?.errorName;
      const args = revert.data?.args ?? [];
      if (errorName) {
        const handler = ERROR_MESSAGES[errorName];
        return {
          message: handler ? handler(args) : `Reverted with ${errorName}.`,
          errorName,
          args,
          userRejected: false,
        };
      }
      // A plain `require("...")` string revert.
      if (revert.reason) {
        return { message: revert.reason, userRejected: false };
      }
    }

    // Short message beats the multi-paragraph default when nothing decoded.
    return { message: error.shortMessage || fallback, userRejected: false };
  }

  return { message: fallback, userRejected: looksLikeUserRejection(fallback) };
}
