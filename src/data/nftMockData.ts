import eyeImg from '../assets/EYE.png';
import sUsdsImg from '../assets/sUSDS.png';
import scxImg from '../assets/SCX.png';
import bitcoinImg from '../assets/Bitcoin.png';
import flaxImg from '../assets/Flax.png';

export interface NFTData {
  id: number;
  name: string;
  image: string;
  action: string;
  reason: string;
  tokenName: string;
  mockPrice: number;
  mockBalance: number;
}

export const nftMockData: NFTData[] = [
  {
    id: 1,
    name: "EYE ignition",
    image: eyeImg,
    action: "EYE is burnt",
    reason: "Returning value to the OG Behoblins. Patience has been rewarded!",
    tokenName: "EYE",
    mockPrice: 0.0042,
    mockBalance: 15000,
  },
  {
    id: 2,
    name: "Liquid Sky Phoenix",
    image: sUsdsImg,
    action: "Balancer liquidity boosted",
    reason: "More liquidity with price tilting means more minting which means more yield which means more liquidity which means... you get the idea.",
    tokenName: "sUSDS",
    mockPrice: 1.08,
    mockBalance: 500,
  },
  {
    id: 3,
    name: "Smouldering Scarcity",
    image: scxImg,
    action: "SCX is burnt",
    reason: "All time low set by the Seychelles; all time high set by Phoenix",
    tokenName: "SCX",
    mockPrice: 12.5,
    mockBalance: 25,
  },
  {
    id: 4,
    name: "Bitcoin Buildup",
    image: bitcoinImg,
    action: "BTC is stockpiled in case of emergency",
    reason: "Antifragility reserve in case an external protocol fails.",
    tokenName: "BTC",
    mockPrice: 97500,
    mockBalance: 0.015,
  },
  {
    id: 5,
    name: "Flax Wild Fire",
    image: flaxImg,
    action: "Flax is burnt",
    reason: "Flax was a seed which grew into phUSD. DeFi will pay back that investment.",
    tokenName: "FLAX",
    mockPrice: 0.085,
    mockBalance: 8500,
  },
];
