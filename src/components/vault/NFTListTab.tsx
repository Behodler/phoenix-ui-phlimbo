import { useState, useMemo, useEffect } from 'react';
import { useToast } from '../ui/ToastProvider';
import SegmentedControl from '../ui/SegmentedControl';
import { nftStaticConfig, tokenPrefixToPriceKey } from '../../data/nftMockData';
import type { NFTData } from '../../data/nftMockData';
import { useNFTPrices } from '../../hooks/useNFTPrices';
import { useMinterPageView } from '../../hooks/useMinterPageView';
import { useStakingMockData } from '../../hooks/useStakingMockData';
import NFTListItem from './NFTListItem';
import NFTListMintModal from './NFTListMintModal';
import StakingSurface from './StakingSurface';

export default function NFTListTab() {
  const { addToast } = useToast();
  const [selectedNft, setSelectedNft] = useState<NFTData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [subTab, setSubTab] = useState<'mint' | 'stake'>('mint');
  const { prices } = useNFTPrices();
  const { data: minterData, isLoading, refetch: refetchMinterData } = useMinterPageView();

  // Shared staking state — drives both the header (APY pill + staked badge)
  // and the StakingSurface card actions so they stay in sync.
  const staking = useStakingMockData((description) => {
    addToast({ type: 'success', title: 'Staking', description });
  });

  // Merge static config with live contract data
  const nftDataList: NFTData[] = useMemo(() => {
    return nftStaticConfig.map((config) => {
      const tokenData = minterData?.[config.tokenPrefix];
      // Determine totalBurnt for EYE, SCX, Flax
      let totalBurnt: string | undefined;
      if (minterData) {
        if (config.tokenPrefix === 'EYE') totalBurnt = minterData.eyeTotalBurnt;
        else if (config.tokenPrefix === 'SCX') totalBurnt = minterData.scxTotalBurnt;
        else if (config.tokenPrefix === 'Flax') totalBurnt = minterData.flaxTotalBurnt;
      }

      return {
        ...config,
        price: tokenData?.price ?? '0',
        balance: tokenData?.balance ?? '0',
        nftBalance: tokenData?.nftBalance ?? 0,
        allowanceRaw: tokenData?.allowanceRaw ?? 0n,
        priceRaw: tokenData?.priceRaw ?? 0n,
        balanceRaw: tokenData?.balanceRaw ?? 0n,
        decimals: config.decimals,
        growthBasisPoints: tokenData?.growthBasisPoints ?? 0,
        dispatcherIndex: tokenData?.dispatcherIndex ?? 0,
        totalBurnt,
      };
    });
  }, [minterData]);

  // Sort by total dollar value ascending: price * USD price
  const sortedNfts = useMemo(() => {
    return [...nftDataList].sort((a, b) => {
      const priceKeyA = tokenPrefixToPriceKey[a.tokenPrefix] ?? a.tokenPrefix;
      const priceKeyB = tokenPrefixToPriceKey[b.tokenPrefix] ?? b.tokenPrefix;
      const aValue = parseFloat(a.price) * (prices[priceKeyA] ?? 0);
      const bValue = parseFloat(b.price) * (prices[priceKeyB] ?? 0);
      return aValue - bValue;
    });
  }, [nftDataList, prices]);

  // Keep selectedNft in sync with fresh minterData after refetch.
  // Without this, the modal holds a stale snapshot with old allowanceRaw/balanceRaw,
  // so the button never updates from "Approve" to "Mint" or reflects balance changes.
  useEffect(() => {
    if (selectedNft) {
      const updated = nftDataList.find((n) => n.id === selectedNft.id);
      if (updated && (updated.allowanceRaw !== selectedNft.allowanceRaw || updated.balanceRaw !== selectedNft.balanceRaw)) {
        setSelectedNft(updated);
      }
    }
  }, [nftDataList, selectedNft]);

  const handleMintClick = (nft: NFTData) => {
    setSelectedNft(nft);
    setIsModalOpen(true);
  };

  const handleMintSuccess = (nft: NFTData) => {
    const actionVerb = nft.action.toLowerCase().includes('burnt')
      ? 'burnt'
      : nft.action.toLowerCase().includes('stockpiled')
        ? 'stockpiled'
        : 'contributed';

    addToast({
      type: 'success',
      title: 'NFT Minted!',
      description: <><em>{nft.name}</em> minted! {nft.tokenDisplayName} {actionVerb}!</>,
    });

    setIsModalOpen(false);
    setSelectedNft(null);
    // Refetch data to update balances
    refetchMinterData();
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedNft(null);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="p-6">
        <div className="bg-pxusd-teal-700 border border-pxusd-teal-500 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-pxusd-teal-300 mb-1">Mint an NFT to gain access to the yield funnel</h3>
          <p className="text-sm text-muted-foreground">Loading NFT data from contract...</p>
        </div>
        <div className="flex flex-col gap-2 max-w-4xl mx-auto">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-pxusd-teal-700 border border-pxusd-teal-600 rounded-lg px-4 h-14 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Sub-toggle header: Mint / Stake switch */}
      <div className="max-w-4xl mx-auto mb-4 flex flex-wrap items-center gap-3">
        <SegmentedControl
          ariaLabel="NFT surface"
          value={subTab}
          onChange={setSubTab}
          options={[
            { value: 'mint', label: 'Mint' },
            { value: 'stake', label: 'Stake' },
          ]}
        />
      </div>

      {subTab === 'mint' ? (
        <>
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
            {sortedNfts.map((nft) => {
              const priceKey = tokenPrefixToPriceKey[nft.tokenPrefix] ?? nft.tokenPrefix;
              return (
                <NFTListItem
                  key={nft.id}
                  nft={nft}
                  price={prices[priceKey] ?? null}
                  onMintClick={handleMintClick}
                />
              );
            })}
          </div>

          {/* Mint Modal */}
          <NFTListMintModal
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            nft={selectedNft}
            price={selectedNft ? (prices[tokenPrefixToPriceKey[selectedNft.tokenPrefix] ?? selectedNft.tokenPrefix] ?? null) : null}
            onMintSuccess={handleMintSuccess}
            refetchMinterData={refetchMinterData}
          />
        </>
      ) : (
        <div className="max-w-4xl mx-auto">
          <StakingSurface staking={staking} />
        </div>
      )}
    </div>
  );
}
