// Dispatcher index → NFT identity for the history sections.
import { nftStaticConfig } from '../../../data/nftMockData';

/**
 * Mainnet NFTMinterV2 dispatcher index → `nftStaticConfig` id.
 *
 * `history.json` is always mainnet data and `bonfireBurns[].tokenId` is the
 * dispatcher index, so this map is fixed rather than read from MintPageView
 * (which follows the connected chain). Indices are registration order on
 * NFTMinterV2 (append-only; see phase-2-staging `DeployMocks.s.sol` and the
 * `mainnet-addresses.ts` history comments):
 *
 * 1 EYE ignition, 2 Smouldering Scarcity, 3 Flax Wild Fire (Uniboost),
 * 4 Liquid Sky Phoenix (UniPoolerV2), 5 Bitcoin Buildup (GatherWBTC),
 * 6 retired (bugged pooler, never reclaimable), 7 the ratchet.
 *
 * NOTE the `nftStaticConfig` id is a display id, unrelated to the index
 * (config id 4 is Bitcoin Buildup, dispatcher index 4 is Liquid Sky Phoenix).
 */
export const MAINNET_DISPATCHER_TO_CONFIG_ID: Readonly<Record<number, number>> = {
  1: 1, // EYE ignition
  2: 3, // Smouldering Scarcity
  3: 5, // Flax Wild Fire
  4: 2, // Liquid Sky Phoenix
  5: 4, // Bitcoin Buildup
  7: 6, // Reservoir Ratchet in config; "Nudge Ratchet" in history
};

/**
 * History-only display names, keyed by `nftStaticConfig` id. The ratchet is
 * "Nudge Ratchet" to users; its config label stays untouched for every other
 * surface.
 */
export const HISTORY_NAME_OVERRIDES: Readonly<Record<number, string>> = {
  6: 'Nudge Ratchet',
};

/** Dispatcher index of Liquid Sky Phoenix, the only NFT the discount batch minter mints. */
export const LIQUID_SKY_PHOENIX_DISPATCHER_INDEX = 4;

export interface HistoryNft {
  name: string;
  /** Image URL, or null for an unknown index (render a generic icon). */
  image: string | null;
}

/** Name and image for a mainnet dispatcher index; unknown → `NFT #<index>`, no image. */
export function historyNftFor(dispatcherIndex: number | string): HistoryNft {
  const index = Number(dispatcherIndex);
  const configId = MAINNET_DISPATCHER_TO_CONFIG_ID[index];
  const config = configId === undefined ? undefined : nftStaticConfig.find((n) => n.id === configId);
  if (!config) return { name: `NFT #${dispatcherIndex}`, image: null };
  return { name: HISTORY_NAME_OVERRIDES[config.id] ?? config.name, image: config.image };
}
