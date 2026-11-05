import { shortenAddress } from '../../../lib/pauserHealth';

interface AddressLabelProps {
  address: string;
  names: Map<string, string>;
}

/** Shortened address with the full address as a tooltip, a copy affordance and a known-name label. */
export default function AddressLabel({ address, names }: AddressLabelProps) {
  const name = names.get(address.toLowerCase());
  return (
    <span className="inline-flex items-center gap-2">
      {name && <span className="text-foreground">{name}</span>}
      <span className="font-mono text-muted-foreground" title={address}>
        {shortenAddress(address)}
      </span>
      <button
        type="button"
        onClick={() => void navigator.clipboard?.writeText(address)}
        className="text-xs text-accent hover:text-accent/80 underline"
        title={`Copy ${address}`}
        aria-label={`Copy address ${address}`}
      >
        copy
      </button>
    </span>
  );
}
