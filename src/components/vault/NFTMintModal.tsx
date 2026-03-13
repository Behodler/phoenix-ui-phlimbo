import { useState } from 'react';
import type { NFTData } from '../../data/nftMockData';
import { LoadingSpinner } from '../ui/ActionButton';

interface NFTMintModalProps {
  isOpen: boolean;
  onClose: () => void;
  nft: NFTData | null;
  onMint: (nft: NFTData) => void;
}

export default function NFTMintModal({ isOpen, onClose, nft, onMint }: NFTMintModalProps) {
  const [isApproved, setIsApproved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen || !nft) return null;

  const handleApprove = () => {
    setIsLoading(true);
    // Mock approval delay
    setTimeout(() => {
      setIsApproved(true);
      setIsLoading(false);
    }, 1000);
  };

  const handleMint = () => {
    setIsLoading(true);
    // Mock mint delay
    setTimeout(() => {
      onMint(nft);
      setIsLoading(false);
      setIsApproved(false);
    }, 1500);
  };

  const handleClose = () => {
    setIsApproved(false);
    setIsLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-lg max-w-md w-full p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-foreground">Mint {nft.name}</h3>
        </div>

        {/* Content */}
        <div className="mb-6 space-y-4">
          {/* NFT preview */}
          <div className="flex items-center gap-4">
            <img
              src={nft.image}
              alt={nft.name}
              className="w-16 h-16 object-contain rounded-lg"
            />
            <div>
              <p className="text-sm text-foreground font-medium">{nft.name}</p>
              <p className="text-xs text-muted-foreground">{nft.action}</p>
            </div>
          </div>

          {/* Token details */}
          <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Token Required:</span>
              <span className="text-foreground">{nft.tokenDisplayName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Amount:</span>
              <span className="text-foreground">1.00 {nft.tokenDisplayName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Your Balance:</span>
              <span className="text-foreground">{parseFloat(nft.balance).toLocaleString()} {nft.tokenDisplayName}</span>
            </div>
          </div>

          {/* ERC-1155 note */}
          <p className="text-xs text-muted-foreground">
            This is an ERC-1155 NFT. You can hold multiple copies of each type.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
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
              {isLoading && <LoadingSpinner />}
              Approve
            </button>
          ) : (
            <button
              onClick={handleMint}
              disabled={isLoading}
              className="flex-1 phoenix-btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading && <LoadingSpinner />}
              Mint
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
