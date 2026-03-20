import { ConnectButton } from '@rainbow-me/rainbowkit';
import phoenixLogo from '../../assets/phUSD-nobackground.png';
import WalletBalances from './WalletBalances';
import PollingToggle from '../ui/PollingToggle';

export default function Header() {
  return (
    <header className="phoenix-nav">
      <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src={phoenixLogo}
            alt="Phoenix Logo"
            className="rounded-xl object-cover"
            width={"90px"}
          />
          <div className="hidden sm:block">
            <div className="text-xl leading-tight text-pxusd-white">Phoenix</div>
            <div className="text-sm font-semibold text-pxusd-white">phUSD minter</div>
            <div className="text-sm text-muted-foreground font-semibold italic">B3 Tech</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <PollingToggle />
          <WalletBalances />
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}