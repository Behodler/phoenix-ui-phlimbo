import { useState } from 'react';
import { useToast } from '../ui/ToastProvider';
import { nftMockData } from '../../data/nftMockData';
import type { NFTData } from '../../data/nftMockData';
import NFTCard from './NFTCard';
import NFTMintModal from './NFTMintModal';

export default function NFTTab() {
  const { addToast } = useToast();
  const [selectedNft, setSelectedNft] = useState<NFTData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleMintClick = (nft: NFTData) => {
    setSelectedNft(nft);
    setIsModalOpen(true);
  };

  const handleMint = (nft: NFTData) => {
    // Determine toast description based on NFT action
    const actionVerb = nft.action.toLowerCase().includes('burnt')
      ? 'burnt'
      : nft.action.toLowerCase().includes('stockpiled')
        ? 'stockpiled'
        : 'contributed';

    addToast({
      type: 'success',
      title: 'NFT Minted!',
      description: <><em>{nft.name}</em> minted! {nft.mockPrice} {nft.tokenName} {actionVerb}!</>,
    });

    setIsModalOpen(false);
    setSelectedNft(null);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedNft(null);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Mint an NFT to gain access to the yield funnel</h2>
        <p className="text-sm text-muted-foreground">
          Each NFT strengthens the ecosystem in a different way
        </p>
      </div>

      {/* NFT List */}
      <div className="flex flex-col items-center gap-4 max-w-2xl mx-auto">
        {nftMockData.map((nft) => (
          <NFTCard
            key={nft.id}
            nft={nft}
            onMintClick={handleMintClick}
          />
        ))}
      </div>

      {/* Mint Modal */}
      <NFTMintModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        nft={selectedNft}
        onMint={handleMint}
      />
    </div>
  );
}
