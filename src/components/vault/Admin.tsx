import { useAccount } from 'wagmi';
import { useReadContract } from 'wagmi';
import { behodler3TokenlaunchAbi } from '../../generated/wagmi';
import { useContractAddresses } from '../../contexts/ContractAddressContext';
import ActionButton from '../ui/ActionButton';

/**
 * Admin Component
 *
 * Provides administrative controls for the bonding curve contract owner.
 * This component is only rendered when the connected wallet address matches
 * the owner address of the bonding curve contract.
 */
export default function Admin() {
  const { isConnected, address: walletAddress } = useAccount();
  const { addresses } = useContractAddresses();

  // Fetch the owner address from the bonding curve contract
  const { data: ownerAddress } = useReadContract({
    address: addresses?.bondingCurve as `0x${string}` | undefined,
    abi: behodler3TokenlaunchAbi,
    functionName: 'owner',
    query: {
      enabled: !!addresses?.bondingCurve,
    },
  });

  // Placeholder handler for mint yield button (no functionality yet)
  const handleMintYield = () => {
    // Placeholder - functionality to be added in future story
    console.log('Mint yield button clicked');
  };

  return (
    <div className="p-6">
      {/* Admin Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">Admin Controls</h2>
        <p className="text-sm text-muted-foreground">
          Administrative functions for bonding curve contract owner
        </p>
      </div>

      {/* Owner Info Box */}
      <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-4 mb-6">
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-foreground">Contract Owner:</span>
            <span className="text-xs font-mono text-accent">
              {ownerAddress ? `${ownerAddress.slice(0, 6)}...${ownerAddress.slice(-4)}` : 'Loading...'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-foreground">Your wallet:</span>
            <span className="text-xs font-mono text-accent">
              {walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Not connected'}
            </span>
          </div>
        </div>
      </div>

      {/* Mint Yield Button */}
      <div className="mb-6">
        <ActionButton
          disabled={!isConnected}
          onAction={handleMintYield}
          label="Mint Yield"
          variant="primary"
          isLoading={false}
        />
      </div>

      {/* Contract and Function Dropdowns */}
      <div className="flex gap-4 mb-6">
        {/* Contracts Dropdown */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-foreground mb-2">
            Contracts
          </label>
          <select
            className="w-full px-4 py-2 bg-card border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            disabled
          >
            <option>Select Contract...</option>
          </select>
        </div>

        {/* Functions Dropdown */}
        <div className="flex-1">
          <label className="block text-sm font-medium text-foreground mb-2">
            Functions
          </label>
          <select
            className="w-full px-4 py-2 bg-card border border-border rounded-md text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            disabled
          >
            <option>Select Function...</option>
          </select>
        </div>
      </div>

      {/* Admin Notice */}
      <div className="mt-6 p-4 bg-card border border-border rounded-lg">
        <p className="text-xs text-muted-foreground">
          <strong>Note:</strong> This tab is only visible to the bonding curve contract owner.
          Administrative functions will be added in future updates.
        </p>
      </div>
    </div>
  );
}
