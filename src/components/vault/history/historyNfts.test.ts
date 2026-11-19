import { describe, expect, it } from 'vitest';
import { historyNftFor, LIQUID_SKY_PHOENIX_DISPATCHER_INDEX, MAINNET_DISPATCHER_TO_CONFIG_ID } from './historyNfts';
import { nftStaticConfig } from '../../../data/nftMockData';

const imageOf = (name: string) => nftStaticConfig.find((n) => n.name === name)!.image;

describe('historyNftFor', () => {
  it('maps mainnet dispatcher indices to the mint-page names and images', () => {
    expect(historyNftFor(1)).toEqual({ name: 'EYE ignition', image: imageOf('EYE ignition') });
    expect(historyNftFor(2)).toEqual({ name: 'Smouldering Scarcity', image: imageOf('Smouldering Scarcity') });
    expect(historyNftFor(3)).toEqual({ name: 'Flax Wild Fire', image: imageOf('Flax Wild Fire') });
    expect(historyNftFor(4)).toEqual({ name: 'Liquid Sky Phoenix', image: imageOf('Liquid Sky Phoenix') });
    expect(historyNftFor(5)).toEqual({ name: 'Bitcoin Buildup', image: imageOf('Bitcoin Buildup') });
  });

  it('accepts the decimal-string tokenId from history.json', () => {
    expect(historyNftFor('4').name).toBe('Liquid Sky Phoenix');
  });

  it('shows the ratchet as "Nudge Ratchet" in history only', () => {
    expect(historyNftFor(7)).toEqual({ name: 'Nudge Ratchet', image: imageOf('Reservoir Ratchet') });
    // Mint-page / config label is unchanged.
    expect(nftStaticConfig.find((n) => n.id === 6)!.name).toBe('Reservoir Ratchet');
  });

  it('does not confuse dispatcher index with nftStaticConfig id', () => {
    // Config id 4 is Bitcoin Buildup; dispatcher index 4 is Liquid Sky Phoenix.
    expect(nftStaticConfig.find((n) => n.id === 4)!.name).toBe('Bitcoin Buildup');
    expect(historyNftFor(LIQUID_SKY_PHOENIX_DISPATCHER_INDEX).name).toBe('Liquid Sky Phoenix');
  });

  it('falls back to a generic NFT for unknown indices (incl. retired index 6)', () => {
    expect(historyNftFor(6)).toEqual({ name: 'NFT #6', image: null });
    expect(historyNftFor('99')).toEqual({ name: 'NFT #99', image: null });
    expect(MAINNET_DISPATCHER_TO_CONFIG_ID[6]).toBeUndefined();
  });
});
