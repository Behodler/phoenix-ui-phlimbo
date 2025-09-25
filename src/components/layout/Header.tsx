import { useState, useEffect } from 'react';
import type { HeaderProps } from '../../types/vault';
//import phoenixLogo from '../../assets/phoenix-logok.png';
import phoenixLogo from '../../assets/pxUSD-detailed.png';

export default function Header({ onConnect, isConnected = false }: HeaderProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
      root.classList.add('dark');
    } else {
      root.setAttribute('data-theme', 'light');
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

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
            <div className="text-sm text-muted-foreground italic">Behodler 3 technology</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="phoenix-btn-ghost text-sm"
          >
            {theme === 'dark' ? 'Light' : 'Dark'} Mode
          </button>
          <button className="phoenix-btn-ghost text-sm">
            FAQ
          </button>
          <button
            onClick={onConnect}
            className={`phoenix-btn text-sm ${isConnected ? 'phoenix-btn-secondary' : 'phoenix-btn-primary'}`}
          >
            {isConnected ? 'Connected' : 'Connect Wallet'}
          </button>
        </div>
      </div>
    </header>
  );
}