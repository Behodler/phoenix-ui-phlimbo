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
      title: `${nft.name} minted!`,
      description: `1.00 ${nft.tokenName} ${actionVerb}!`,
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
        <h2 className="text-2xl font-bold text-foreground mb-2">NFT Collection</h2>
        <p className="text-sm text-muted-foreground">
          Mint NFTs that contribute to the Phoenix protocol. Each NFT performs a unique action and holding one grants access to the yield funnel.
        </p>
      </div>

      {/* Info panel */}
      <div className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-pxusd-orange-300 mb-2">How it works</h3>
        <p className="text-sm text-muted-foreground">
          Each NFT type contributes to the protocol in a different way. Minting requires the specified token which is then used for the described action. NFTs are ERC-1155 tokens, so you can hold multiple of each type.
        </p>
      </div>

      {/* NFT Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
