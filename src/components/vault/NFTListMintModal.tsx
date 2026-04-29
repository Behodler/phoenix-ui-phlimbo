import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import type { Address } from 'viem';
import { nftMinterV2Abi, batchNftMinterAbi } from '@behodler/phase2-wagmi-hooks';
import type { NFTData } from '../../data/nftMockData';
import { tokenPrefixToAddressKey } from '../../data/nftMockData';
import { LoadingSpinner } from '../ui/ActionButton';
import { useContractAddresses } from '../../contexts/ContractAddressContext';
import { useTokenAllowance, useTokenApproval } from '../../hooks/useContractInteractions';
import { useToast } from '../ui/ToastProvider';
import NFTCard from './NFTCard';
import BatchMintControlsView from './BatchMintControls';
import { useBatchMintControls } from '../../utils/useBatchMintControls';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

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

  const { address: walletAddress } = useAccount();
  const { addresses, nftPrimary } = useContractAddresses();
  const { approve } = useTokenApproval();
  const { addToast } = useToast();
  const { writeContractAsync } = useWriteContract();

  // Runtime predicate: route through BatchNFTMinter when:
  //   1. The NFT's static config has `batchEnabled: true` (Liquid Sky Phoenix only).
  //   2. The resolved BatchNFTMinter address is non-zero (graceful mainnet fallback).
  // Lower-cased compare guards against any future capitalisation drift in the
  // address-server response.
  const useBatchFlow =
    !!nft?.batchEnabled &&
    !!addresses?.BatchNFTMinter &&
    addresses.BatchNFTMinter.toLowerCase() !== ZERO_ADDRESS;

  // Allowance read against the batch helper. Always wired (hook order must be
  // stable) but only consumed when `useBatchFlow` is true.
  const usdsAddress = addresses?.USDS as Address | undefined;
  const batchHelperAddress = useBatchFlow
    ? (addresses?.BatchNFTMinter as Address)
    : undefined;
  const { allowance: batchAllowance, refetch: refetchBatchAllowance } = useTokenAllowance(
    walletAddress,
    batchHelperAddress,
    usdsAddress,
  );

  // Batch-mint controls state. Always called for hook-order stability;
  // only the rendered output is gated on `useBatchFlow`.
  const batchControls = useBatchMintControls(
    nft ?? ({ priceRaw: 0n, growthBasisPoints: 0, decimals: 18 } as NFTData),
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
      refetchBatchAllowance();
      addToast({ type: 'success', title: 'Approval Confirmed', description: 'Token approval confirmed on-chain. You can now mint.' });
    }
  }, [isApprovalSuccess, approvalTxHash, refetchMinterData, refetchBatchAllowance, addToast]);

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
      refetchBatchAllowance();
      onMintSuccess(nft);
    }
  }, [isMintSuccess, mintTxHash, nft, onMintSuccess, refetchMinterData, refetchBatchAllowance]);

  if (!isOpen || !nft) return null;

  // Determine if approved: allowance >= price (both as bigint)
  const isApproved = useBatchFlow
    ? batchAllowance !== undefined && batchAllowance >= batchControls.requiredRaw && batchControls.requiredRaw > 0n
    : nft.allowanceRaw >= nft.priceRaw && nft.priceRaw > 0n;
  const hasInsufficientBalance = useBatchFlow
    ? nft.balanceRaw < batchControls.requiredRaw
    : nft.balanceRaw < nft.priceRaw;
  const isLoading = isApproving || isMinting;
  const isMintDisabled = isLoading;

  // Get the ERC20 token address for approve
  const getTokenAddress = (): `0x${string}` | null => {
    if (!addresses) return null;
    const addressKey = tokenPrefixToAddressKey[nft.tokenPrefix];
    if (addressKey && addresses[addressKey as keyof typeof addresses]) {
      return addresses[addressKey as keyof typeof addresses] as `0x${string}`;
    }
    return null;
  };

  const handleApprove = async () => {
    if (!walletAddress || !nftPrimary?.NFTMinter) {
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
      const spender = useBatchFlow
        ? (addresses!.BatchNFTMinter as `0x${string}`)
        : (nftPrimary.NFTMinter as `0x${string}`);
      const hash = useBatchFlow
        ? await approve(tokenAddress, spender, batchControls.requiredRaw)
        : await approve(tokenAddress, spender);
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
    if (!walletAddress || !nftPrimary?.NFTMinter) {
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

      let hash: `0x${string}`;
      if (useBatchFlow) {
        // BatchNFTMinter.batchMint pulls the full paymentAmount upfront, mints
        // `count` consecutive units (each step bumps the dispatcher price), and
        // refunds dust below threshold. Args mirror the ABI exactly.
        hash = await writeContractAsync({
          address: addresses!.BatchNFTMinter as `0x${string}`,
          abi: batchNftMinterAbi,
          functionName: 'batchMint',
          args: [
            nftPrimary.NFTMinter as `0x${string}`,
            tokenAddress,
            BigInt(nft.dispatcherIndex),
            BigInt(batchControls.count),
            walletAddress,
            batchControls.requiredRaw,
          ],
        });
      } else {
        // V2 NFTMinter: single 2-arg mint(index, recipient) path shared by every NFT.
        // Dispatcher-specific behaviour (burn / gather / balancer pool) is handled
        // server-side; no token-prefix branching, no extraData, no BPT preview.
        hash = await writeContractAsync({
          address: nftPrimary.NFTMinter as `0x${string}`,
          abi: nftMinterV2Abi,
          functionName: 'mint',
          args: [BigInt(nft.dispatcherIndex), walletAddress],
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
      <div className="bg-background border border-border rounded-lg max-w-xl w-full max-h-[90vh] overflow-y-auto p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Full NFTCard at top (without its own mint button) */}
        <NFTCard nft={nft} price={price} showMintButton={false} tokenAddress={getTokenAddress() ?? undefined} />

        {/* Batch controls (Liquid Sky Phoenix only, when helper is deployed) */}
        {useBatchFlow ? (
          <BatchMintControlsView
            nft={nft}
            count={batchControls.count}
            displayValue={batchControls.displayValue}
            isInvalid={batchControls.isInvalid}
            isApproved={isApproved}
            isLoading={isLoading}
            onSliderChange={batchControls.onSliderChange}
            onTextChange={batchControls.onTextChange}
          />
        ) : null}

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
              Mint
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
