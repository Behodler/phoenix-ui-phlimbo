export type Tab = "Mint" | "Yield Funnel" | "Stake" | "Testnet Faucet" | "Market" | "NFT" | "Admin";

export interface VaultFormData {
  amount: string;
  autoStake: boolean;
  slippageBps: number;
}

export interface VaultConstants {
  dolaToPhUSDRate: number;
}

export interface TokenInfo {
  name: string;
  balance: number;
  balanceUsd: number;
  icon: string;
  balanceRaw?: bigint; // Raw BigInt balance for precision-sensitive operations
}

export interface PositionInfo {
  value: number;
  valueUsd: number;
  isStaked: boolean;
  valueRaw?: bigint; // Raw BigInt value for precision-sensitive operations
}

export interface HeaderProps {
  onConnect: () => void;
  isConnected?: boolean;
}

export interface TabNavigationProps {
  tabs: readonly Tab[];
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onTriggerFAQ?: (componentName: string) => void;
}



export interface AmountDisplayProps {
  amount: number;
  showDollarEstimate?: boolean; // If true, shows dollar estimate below amount (defaults to false)
  priceMultiplier?: number; // Optional price multiplier for dollar estimate (e.g., phUSD market price). Defaults to 1.0 (1:1 ratio)
}

export interface TokenRowProps {
  token: TokenInfo;
  onMaxClick?: () => void;
}

export interface AmountInputProps {
  amount: string;
  onAmountChange: (amount: string) => void;
  onMaxClick: () => void;
}

export interface AutoStakeToggleProps {
  autoStake: boolean;
  onToggle: (enabled: boolean) => void;
}

export interface RateInfoProps {
  constants: VaultConstants;
  slippageBps: number;
  onSlippageChange: (bps: number) => void;
  minReceived: number;
  invertRate?: boolean; // If true, show "1 phUSD = X DOLA" instead of "1 DOLA = X phUSD"
  outputToken?: string; // Token symbol for "Receive at least" display (defaults to phUSD)
}

export interface ActionButtonProps {
  disabled: boolean;
  onAction: () => void;
  label: string;
  isLoading?: boolean;
  variant?: 'primary' | 'approve';
}


export interface ContextBoxProps {
  children?: React.ReactNode;
  visible?: boolean;
  className?: string;
}

export interface FAQItem {
  title: string;
  body: string;
}

export interface FAQData {
  componentName: string;
  items: FAQItem[];
}

export interface FAQProps {
  componentName?: string;
}

export interface FAQWrapperProps {
  componentType: string;
  children: React.ReactNode;
  onTriggerFAQ: (componentName: string) => void;
}

