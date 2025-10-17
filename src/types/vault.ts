export type Tab = "Deposit to Mint" | "Burn to Withdraw";

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
}

export interface PositionInfo {
  value: number;
  valueUsd: number;
  isStaked: boolean;
}

export interface HeaderProps {
  onConnect: () => void;
  isConnected?: boolean;
}

export interface TabNavigationProps {
  tabs: readonly Tab[];
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export interface DepositFormProps {
  formData: VaultFormData;
  onFormChange: (data: Partial<VaultFormData>) => void;
  constants: VaultConstants;
  tokenInfo: TokenInfo;
  onDeposit: () => void;
  isTransacting?: boolean;
  needsApproval?: boolean;
  onApprove?: () => void;
  isAllowanceLoading?: boolean;
}


export interface AmountDisplayProps {
  amount: number;
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
}

export interface ActionButtonProps {
  disabled: boolean;
  onAction: () => void;
  label: string;
  isLoading?: boolean;
  variant?: 'primary' | 'approve';
}

export interface WithdrawFormProps {
  formData: VaultFormData;
  onFormChange: (data: Partial<VaultFormData>) => void;
  constants: VaultConstants;
  positionInfo: PositionInfo;
  onWithdraw: () => void;
  isTransacting?: boolean;
}

export interface BondingCurveBoxProps {
  startPrice: number;
  endPrice: number;
  currentPrice: number;
  isLoading?: boolean;
  isError?: boolean;
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
  icon?: boolean;
  children: React.ReactNode;
  onTriggerFAQ: (componentName: string) => void;
}