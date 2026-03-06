import { useState } from 'react';
import { useToast } from '../ui/ToastProvider';
import { nftMockData } from '../../data/nftMockData';
import type { NFTData } from '../../data/nftMockData';
import NFTListItem from './NFTListItem';
import NFTListMintModal from './NFTListMintModal';

export default function NFTListTab() {
  const { addToast } = useToast();
  const [selectedNft, setSelectedNft] = useState<NFTData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Sort by mockPrice ascending (dollar price order)
  const sortedNfts = [...nftMockData].sort((a, b) => a.mockPrice - b.mockPrice);

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
      <div className="bg-pxusd-teal-700 border border-pxusd-teal-500 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-pxusd-teal-300 mb-1">Mint an NFT to gain access to the yield funnel</h3>
        <p className="text-sm text-muted-foreground">
          Each NFT strengthens the ecosystem in a different way
        </p>
      </div>

      {/* Column Headings */}
      <div className="flex items-center px-4 py-2 text-[0.75rem] text-muted-foreground uppercase tracking-wider max-w-4xl mx-auto">
        <span className="w-10 flex-shrink-0" /> {/* image spacer */}
        <span className="flex-1 pl-3">Name</span>
        <span className="hidden sm:inline flex-1 pl-3">Action</span>
        <span className="w-[5rem] sm:w-[12rem] text-right pr-4">Price</span>
        <span className="flex-shrink-0 w-[4.5rem] text-center">Mint</span>
      </div>

      {/* NFT List */}
      <div className="flex flex-col gap-2 max-w-4xl mx-auto">
        {sortedNfts.map((nft) => (
          <NFTListItem
            key={nft.id}
            nft={nft}
            onMintClick={handleMintClick}
          />
        ))}
      </div>

      {/* Mint Modal */}
      <NFTListMintModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        nft={selectedNft}
        onMint={handleMint}
      />
    </div>
  );
}
