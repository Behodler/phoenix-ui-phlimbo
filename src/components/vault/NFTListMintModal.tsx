import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { encodeAbiParameters } from 'viem';
import { nftMinterAbi } from '@behodler/phase2-wagmi-hooks';
import type { NFTData } from '../../data/nftMockData';
import { tokenPrefixToAddressKey } from '../../data/nftMockData';
import { LoadingSpinner } from '../ui/ActionButton';
import { useContractAddresses } from '../../contexts/ContractAddressContext';
import { useTokenApproval } from '../../hooks/useContractInteractions';
import { useEstimateBPT } from '../../hooks/useEstimateBPT';
import { useToast } from '../ui/ToastProvider';
import NFTCard from './NFTCard';

interface NFTListMintModalProps {
  isOpen: boolean;
  onClose: () => void;
  nft: NFTData | null;
  price: number | null;
  onMintSuccess: (nft: NFTData) => void;
  refetchMinterData: () => void;
}

export default function NFTListMintModal({ isOpen, onClose, nft, price, onMintSuccess, refetchMinterData }: NFTListMintModalProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [mintTxHash, setMintTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [approvalTxHash, setApprovalTxHash] = useState<`0x${string}` | undefined>(undefined);

  const [slippageBps, setSlippageBps] = useState(300); // 3% default
  const [slippageInput, setSlippageInput] = useState('3.00');

  const { address: walletAddress } = useAccount();
  const { addresses } = useContractAddresses();
  const { approve } = useTokenApproval();
  const { addToast } = useToast();
  const { writeContractAsync } = useWriteContract();

  const isSusdsNft = nft?.tokenPrefix === 'sUSDS';
  const { minBPT, estimatedBPT, isLoading: isEstimatingBPT } = useEstimateBPT(
    nft?.priceRaw ?? 0n,
    slippageBps,
    isSusdsNft,
  );

  // Wait for approval transaction confirmation
  const { isSuccess: isApprovalSuccess } = useWaitForTransactionReceipt({
    hash: approvalTxHash,
    query: { enabled: !!approvalTxHash },
  });

  // Handle approval success — refetch only after tx is confirmed on-chain
  useEffect(() => {
    if (isApprovalSuccess && approvalTxHash) {
      setIsApproving(false);
      setApprovalTxHash(undefined);
      refetchMinterData();
      addToast({ type: 'success', title: 'Approval Confirmed', description: 'Token approval confirmed on-chain. You can now mint.' });
    }
  }, [isApprovalSuccess, approvalTxHash, refetchMinterData, addToast]);

  // Wait for mint transaction confirmation
  const { isSuccess: isMintSuccess } = useWaitForTransactionReceipt({
    hash: mintTxHash,
    query: { enabled: !!mintTxHash },
  });

  // Handle mint success
  useEffect(() => {
    if (isMintSuccess && mintTxHash && nft) {
      setIsMinting(false);
      setMintTxHash(undefined);
      refetchMinterData();
      onMintSuccess(nft);
    }
  }, [isMintSuccess, mintTxHash, nft, onMintSuccess, refetchMinterData]);

  if (!isOpen || !nft) return null;

  // Determine if approved: allowance >= price (both as bigint)
  const isApproved = nft.allowanceRaw >= nft.priceRaw && nft.priceRaw > 0n;
  const hasInsufficientBalance = nft.balanceRaw < nft.priceRaw;
  const isLoading = isApproving || isMinting;
  // For sUSDS, disable mint until BPT estimate is ready
  const isMintDisabled = isLoading || (isSusdsNft && (isEstimatingBPT || minBPT === undefined));

  const handleSlippageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSlippageInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      setSlippageBps(Math.round(parsed * 100));
    }
  };

  // Get the ERC20 token address for approve
  const getTokenAddress = (): `0x${string}` | null => {
    if (!addresses) return null;
    const addressKey = tokenPrefixToAddressKey[nft.tokenPrefix];
    if (addressKey && addresses[addressKey as keyof typeof addresses]) {
      return addresses[addressKey as keyof typeof addresses] as `0x${string}`;
    }
    // sUSDS doesn't have a ContractAddresses entry - not supported for now
    // In production, this would come from the MintPageView contract's susds() function
    return null;
  };

  const handleApprove = async () => {
    if (!walletAddress || !addresses?.NFTMinter) {
      addToast({ type: 'error', title: 'Error', description: 'Wallet not connected or contract addresses not loaded.' });
      return;
    }

    const tokenAddress = getTokenAddress();
    if (!tokenAddress) {
      addToast({ type: 'error', title: 'Error', description: `Token address not available for ${nft.tokenDisplayName}.` });
      return;
    }

    setIsApproving(true);
    try {
      addToast({ type: 'info', title: 'Confirm in Wallet', description: `Please confirm the ${nft.tokenDisplayName} approval in your wallet.`, duration: 30000 });
      const hash = await approve(tokenAddress, addresses.NFTMinter as `0x${string}`);
      setApprovalTxHash(hash);
      addToast({ type: 'info', title: 'Transaction Submitted', description: 'Waiting for approval confirmation...' });
    } catch (error) {
      setIsApproving(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.toLowerCase().includes('user rejected') || errorMessage.toLowerCase().includes('user denied')) {
        addToast({ type: 'error', title: 'Transaction Cancelled', description: 'You cancelled the approval transaction.' });
      } else {
        addToast({ type: 'error', title: 'Approval Failed', description: errorMessage });
      }
    }
  };

  const handleMint = async () => {
    if (!walletAddress || !addresses?.NFTMinter) {
      addToast({ type: 'error', title: 'Error', description: 'Wallet not connected or contract addresses not loaded.' });
      return;
    }

    const tokenAddress = getTokenAddress();
    if (!tokenAddress) {
      addToast({ type: 'error', title: 'Error', description: `Token address not available for ${nft.tokenDisplayName}.` });
      return;
    }

    setIsMinting(true);
    try {
      addToast({ type: 'info', title: 'Confirm in Wallet', description: `Please confirm the mint transaction in your wallet.`, duration: 30000 });

      // The index is the dispatcherIndex from MintPageView, NOT the static nft.id
      let hash: `0x${string}`;
      if (isSusdsNft && minBPT !== undefined) {
        // BalancerPooler: use 4-arg mint with extraData encoding minBPT for slippage protection
        const extraData = encodeAbiParameters(
          [{ type: 'uint256' }],
          [minBPT],
        );
        hash = await writeContractAsync({
          address: addresses.NFTMinter as `0x${string}`,
          abi: nftMinterAbi,
          functionName: 'mint',
          args: [tokenAddress, BigInt(nft.dispatcherIndex), walletAddress, extraData],
        });
      } else {
        // Standard 3-arg mint for all other NFTs
        hash = await writeContractAsync({
          address: addresses.NFTMinter as `0x${string}`,
          abi: nftMinterAbi,
          functionName: 'mint',
          args: [tokenAddress, BigInt(nft.dispatcherIndex), walletAddress],
        });
      }

      setMintTxHash(hash);
      addToast({ type: 'info', title: 'Transaction Submitted', description: 'Waiting for blockchain confirmation...' });
    } catch (error) {
      setIsMinting(false);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.toLowerCase().includes('user rejected') || errorMessage.toLowerCase().includes('user denied')) {
        addToast({ type: 'error', title: 'Transaction Cancelled', description: 'You cancelled the mint transaction.' });
      } else {
        addToast({ type: 'error', title: 'Mint Failed', description: errorMessage });
      }
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setIsApproving(false);
      setIsMinting(false);
      setMintTxHash(undefined);
      setApprovalTxHash(undefined);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={handleClose}>
      <div className="bg-background border border-border rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Full NFTCard at top (without its own mint button) */}
        <NFTCard nft={nft} price={price} showMintButton={false} />

        {/* Slippage controls for BalancerPooler (sUSDS) NFT */}
        {isSusdsNft && (
          <div className="mt-3 border border-border rounded-lg p-3 bg-pxusd-teal-700/30">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Slippage Tolerance</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={slippageInput}
                  onChange={handleSlippageChange}
                  step="0.01"
                  min="0"
                  max="100"
                  className="w-16 px-2 py-1 text-right text-sm bg-pxusd-teal-700 border border-border rounded focus:outline-none focus:ring-1 focus:ring-accent text-foreground"
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </div>
            {estimatedBPT !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">
                Min BPT received: {(Number(minBPT) / 1e18).toFixed(6)}
              </p>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-4 flex gap-3">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed text-foreground"
          >
            Cancel
          </button>
          {!isApproved ? (
            <button
              onClick={handleApprove}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-pxusd-orange-500 hover:bg-pxusd-orange-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApproving && <LoadingSpinner />}
              Approve
            </button>
          ) : hasInsufficientBalance ? (
            <button
              disabled
              className="flex-1 px-4 py-2 bg-pxusd-orange-900/40 border border-pxusd-orange-500/50 text-pxusd-orange-300 font-medium rounded-lg cursor-not-allowed opacity-70"
            >
              Insufficient {nft.tokenDisplayName} Balance
            </button>
          ) : (
            <button
              onClick={handleMint}
              disabled={isMintDisabled}
              className="flex-1 phoenix-btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMinting && <LoadingSpinner />}
              {isSusdsNft && isEstimatingBPT ? 'Estimating...' : 'Mint'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
