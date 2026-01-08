export type Tab = "Deposit to Mint" | "Burn to Withdraw" | "Mint" | "Deposit" | "Withdraw" | "Yield Funnel" | "Testnet Faucet" | "Safety" | "Admin";

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

export interface DepositFormProps {
  formData: VaultFormData;
  onFormChange: (data: Partial<VaultFormData>) => void;
  constants: VaultConstants;
  tokenInfo: TokenInfo;
  onDeposit: (bondingCurveOutput?: number) => void;
  isTransacting?: boolean;
  needsApproval?: boolean;
  onApprove?: () => void;
  isAllowanceLoading?: boolean;
  isPaused?: boolean;
}


export interface AmountDisplayProps {
  amount: number;
  showDollarEstimate?: boolean; // If true, shows dollar estimate below amount (defaults to false)
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

export interface WithdrawFormProps {
  formData: VaultFormData;
  onFormChange: (data: Partial<VaultFormData>) => void;
  constants: VaultConstants;
  positionInfo: PositionInfo;
  onWithdraw: (bondingCurveOutput?: number) => void;
  isTransacting?: boolean;
  withdrawalFeeRate?: number; // Decimal rate (e.g., 0.02 = 2%)
  needsApproval?: boolean; // Whether bonding token approval is needed
  onApprove?: () => Promise<void>; // Callback for bonding token approval
  isAllowanceLoading?: boolean; // Whether allowance is still loading
  isPaused?: boolean;
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

export interface YieldRewardsInfoProps {
  totalApy: number; // Combined yield percentage
  phUsdApy: number; // PhUSD yield percentage (fixed)
  usdcApy: number; // USDC yield percentage (variable)
  pendingPhUsd: bigint | string; // Pending PhUSD rewards
  pendingUsdc: bigint | string; // Pending USDC rewards
  stakedBalance: bigint | string; // User's staked phUSD balance
  isLoading?: boolean; // Loading state
  isConnected?: boolean; // Whether wallet is connected (for rewards display)
  onClaim?: () => void; // Callback for claim button action
  isClaiming?: boolean; // Loading state for claim button
}