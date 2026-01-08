import { useState } from 'react';
import ActionButton from '../ui/ActionButton';
import ConfirmationDialog from '../ui/ConfirmationDialog';
import { log } from '../../utils/logger';

// Mock data for pending yield tokens
const mockPendingYield = [
  { symbol: 'DOLA', name: 'Dola USD', amount: 12.0 },
  { symbol: 'USDS', name: 'Sky Dollar', amount: 10.0 },
  { symbol: 'USDT', name: 'Tether USD', amount: 8.5 },
];

const mockDiscountPercent = 10;
const mockIsApproved = false;

// Interface for pending yield token
interface PendingYieldToken {
  symbol: string;
  name: string;
  amount: number;
}

export default function YieldFunnelTab() {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isApproved, setIsApproved] = useState(mockIsApproved);
  const [isTransacting, setIsTransacting] = useState(false);

  // Calculate totals
  const totalYieldValue = mockPendingYield.reduce((sum, token) => sum + token.amount, 0);
  const discountAmount = totalYieldValue * (mockDiscountPercent / 100);
  const requiredUsdc = totalYieldValue - discountAmount;
  const profit = discountAmount;

  // Handle approval (mock)
  const handleApprove = async () => {
    setIsTransacting(true);
    log.debug('YieldFunnelTab: Mock approval initiated');

    // Simulate approval transaction
    await new Promise(resolve => setTimeout(resolve, 1500));

    setIsApproved(true);
    setIsTransacting(false);
    log.debug('YieldFunnelTab: Mock approval completed');
  };

  // Handle supply initiation
  const handleInitiateSupply = () => {
    setShowConfirmation(true);
  };

  // Handle supply confirmation (mock)
  const handleConfirmSupply = async () => {
    setShowConfirmation(false);
    setIsTransacting(true);
    log.debug('YieldFunnelTab: Mock supply initiated', {
      usdcAmount: requiredUsdc.toFixed(2),
      tokensReceived: mockPendingYield,
      profit: profit.toFixed(2),
    });

    // Simulate supply transaction
    await new Promise(resolve => setTimeout(resolve, 1500));

    setIsTransacting(false);
    log.debug('YieldFunnelTab: Mock supply completed');
  };

  // Handle dialog close
  const handleCloseDialog = () => {
    setShowConfirmation(false);
  };

  // Determine button state
  const buttonAction = isApproved ? handleInitiateSupply : handleApprove;
  const buttonLabel = isApproved
    ? `Supply ${requiredUsdc.toFixed(2)} USDC`
    : 'Approve USDC';
  const buttonVariant: 'primary' | 'approve' = isApproved ? 'primary' : 'approve';

  // Format number with 2 decimal places
  const formatAmount = (amount: number): string => {
    return amount.toFixed(2);
  };

  return (
    <>
      <div className="p-6">
        {/* Explanatory Section */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Yield Funnel</h2>
          <p className="text-sm text-muted-foreground">
            Yield flows from multiple sources. Supply USDC to claim accumulated yield tokens at a discount.
          </p>
        </div>

        {/* Pending Yield Breakdown Panel */}
        <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-pxusd-orange-300 mb-3">Pending Yield</h3>

          <div className="space-y-2">
            {mockPendingYield.map((token: PendingYieldToken) => (
              <div key={token.symbol} className="flex justify-between items-center text-sm">
                <span className="text-foreground">{token.symbol}</span>
                <span className="font-medium text-pxusd-yellow-400">{formatAmount(token.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Discount and Pricing Section */}
        <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-4 mb-6">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-foreground">Total Yield Value:</span>
              <span className="font-medium text-pxusd-yellow-400">${formatAmount(totalYieldValue)}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-foreground">Discount:</span>
              <span className="font-medium text-pxusd-green-400">{mockDiscountPercent}%</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-foreground">Your Cost:</span>
              <span className="font-medium text-pxusd-pink-400">{formatAmount(requiredUsdc)} USDC</span>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-pxusd-teal-600">
              <span className="text-foreground font-semibold">Your Profit:</span>
              <span className="font-bold text-pxusd-green-400">${formatAmount(profit)}</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <ActionButton
          disabled={isTransacting}
          onAction={buttonAction}
          label={buttonLabel}
          variant={buttonVariant}
          isLoading={isTransacting}
        />
      </div>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showConfirmation}
        onClose={handleCloseDialog}
        onConfirm={handleConfirmSupply}
        title="Confirm Supply"
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        isLoading={isTransacting}
      >
        <div className="space-y-4">
          {/* USDC Amount */}
          <div className="bg-pxusd-teal-700 rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-2">You're supplying</div>
            <div className="flex justify-between items-center">
              <span className="text-lg font-medium">{formatAmount(requiredUsdc)} USDC</span>
              <span className="text-sm text-muted-foreground">${formatAmount(requiredUsdc)}</span>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" className="text-muted-foreground">
              <path
                fill="currentColor"
                d="M8 12L3 7h2.5V1h5v6H13z"
              />
            </svg>
          </div>

          {/* Tokens to Receive */}
          <div className="bg-pxusd-teal-700 rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-2">You'll receive</div>
            <div className="space-y-2">
              {mockPendingYield.map((token: PendingYieldToken) => (
                <div key={token.symbol} className="flex justify-between items-center">
                  <span className="font-medium">{formatAmount(token.amount)} {token.symbol}</span>
                  <span className="text-sm text-muted-foreground">${formatAmount(token.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Profit Summary */}
          <div className="flex justify-between items-center pt-2 text-sm">
            <span className="text-muted-foreground">Estimated Profit</span>
            <span className="font-bold text-pxusd-green-400">${formatAmount(profit)}</span>
          </div>
        </div>
      </ConfirmationDialog>
    </>
  );
}
