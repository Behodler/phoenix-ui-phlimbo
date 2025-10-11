import { ConnectButton } from '@rainbow-me/rainbowkit';
import phoenixLogo from '../../assets/phUSD-nobackground.png';

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
          <div>
            <div className="text-xl leading-tight text-pxusd-white">Phoenix</div>
            <div className="text-sm font-semibold text-pxusd-white">pxUSD minter</div>
            <div className="text-sm text-muted-foreground italic hidden sm:block">Behodler 3 technology</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}