# Component Architecture Documentation

## Overview

This document describes the refactored component architecture for the autoDOLA Vault application. The monolithic component has been broken down into a well-structured, maintainable architecture.

## Directory Structure

```
src/
├── components/
│   ├── layout/
│   │   └── Header.tsx                 # Application header with branding and wallet connection
│   ├── ui/                           # Reusable UI components
│   │   ├── ActionButton.tsx          # Primary action button with loading states
│   │   ├── AmountDisplay.tsx         # Large amount display component
│   │   ├── AmountInput.tsx           # Amount input with MAX button
│   │   ├── AutoStakeToggle.tsx       # Toggle switch for auto-stake option
│   │   ├── RateInfo.tsx              # Exchange rates and fee information
│   │   ├── TabNavigation.tsx         # Tab navigation component
│   │   ├── TabPlaceholder.tsx        # Placeholder for unimplemented tabs
│   │   └── TokenRow.tsx              # Token information display
│   └── vault/                        # Vault-specific components
│       ├── DepositForm.tsx           # Complete deposit form composition
│       └── PositionCard.tsx          # User position summary card
├── pages/
│   └── VaultPage.tsx                 # Main page component that orchestrates everything
├── types/
│   └── vault.ts                      # TypeScript interfaces and types
└── App.tsx                           # Root application component
```

## Component Hierarchy

```
App
└── VaultPage
    ├── Header
    │   └── ConnectButton (from @rainbow-me/rainbowkit)
    ├── Main Content Area
    │   ├── TabNavigation
    │   └── Conditional Content:
    │       ├── DepositForm (when "Deposit" tab active)
    │       │   ├── AmountDisplay
    │       │   ├── TokenRow
    │       │   ├── AmountInput
    │       │   ├── AutoStakeToggle
    │       │   ├── RateInfo
    │       │   └── ActionButton
    │       └── TabPlaceholder (for other tabs)
    └── PositionCard (sidebar)
```

## Component Responsibilities

### Layout Components

#### Header (`components/layout/Header.tsx`)
- **Purpose**: Application branding and wallet connection
- **Features**:
  - Tokemak autoDOLA Vault branding
  - FAQ button
  - Integrated wallet connection via RainbowKit
- **Props**: `HeaderProps` - minimal interface for future extensibility

### UI Components

#### AmountDisplay (`components/ui/AmountDisplay.tsx`)
- **Purpose**: Display large formatted amounts
- **Features**: Shows amount in token units and USD equivalent
- **Props**: `AmountDisplayProps` - takes numeric amount

#### TokenRow (`components/ui/TokenRow.tsx`)
- **Purpose**: Display token information with balance
- **Features**: Token icon, name, balance display, MAX button
- **Props**: `TokenRowProps` - token info and max click handler

#### AmountInput (`components/ui/AmountInput.tsx`)
- **Purpose**: Numeric input for token amounts
- **Features**: Number input with decimal support, integrated MAX button
- **Props**: `AmountInputProps` - value, change handler, max handler

#### AutoStakeToggle (`components/ui/AutoStakeToggle.tsx`)
- **Purpose**: Toggle switch for auto-stake feature
- **Features**: Custom styled toggle with info icon
- **Props**: `AutoStakeToggleProps` - boolean state and change handler

#### RateInfo (`components/ui/RateInfo.tsx`)
- **Purpose**: Display exchange rates, fees, and slippage settings
- **Features**: Exchange rate, gas fee, editable slippage, minimum received
- **Props**: `RateInfoProps` - constants, slippage state and handlers

#### ActionButton (`components/ui/ActionButton.tsx`)
- **Purpose**: Primary action button for forms
- **Features**: Disabled state handling, loading states ready
- **Props**: `ActionButtonProps` - disabled state, action handler, label

#### TabNavigation (`components/ui/TabNavigation.tsx`)
- **Purpose**: Tab switching interface
- **Features**: Active tab highlighting, tab change handling
- **Props**: `TabNavigationProps` - tabs array, active tab, change handler

#### TabPlaceholder (`components/ui/TabPlaceholder.tsx`)
- **Purpose**: Placeholder content for unimplemented tabs
- **Features**: Template message for future development
- **Props**: `TabPlaceholderProps` - active tab name

### Vault Components

#### DepositForm (`components/vault/DepositForm.tsx`)
- **Purpose**: Complete deposit form composition
- **Features**: Orchestrates all deposit-related UI components
- **Props**: `DepositFormProps` - form data, change handlers, constants, callbacks
- **Composition**: Combines AmountDisplay, TokenRow, AmountInput, AutoStakeToggle, RateInfo, ActionButton

#### PositionCard (`components/vault/PositionCard.tsx`)
- **Purpose**: User position summary and actions
- **Features**: Position value display, staking status, action buttons
- **Props**: `PositionCardProps` - position data and action handlers

### Page Components

#### VaultPage (`pages/VaultPage.tsx`)
- **Purpose**: Main page orchestration and state management
- **Features**:
  - Tab state management
  - Form data state management
  - Mock data provision
  - Event handler coordination
- **State**: Tab selection, form data, mock constants and balances
- **Composition**: Header, TabNavigation, conditional content, PositionCard

## Type System

### Core Types (`types/vault.ts`)

- **Tab**: Union type for tab names
- **VaultFormData**: Form state interface
- **VaultConstants**: Exchange rates and fees
- **TokenInfo**: Token metadata and balances
- **PositionInfo**: User position data
- **Component Props**: Interfaces for all component props

## CSS Architecture

The application uses Tailwind CSS for styling with the following approach:

- **Utility-First**: Direct Tailwind classes in components
- **Consistent Design System**: Neutral color palette with lime accent
- **Responsive Design**: Grid layouts with mobile-first approach
- **Modern Effects**: Backdrop blur, shadows, gradients

### Color Scheme
- **Background**: `neutral-950` (very dark)
- **Cards**: `neutral-900/40` with transparency
- **Borders**: `neutral-800`
- **Text**: `neutral-100` (primary), `neutral-400` (secondary)
- **Accent**: `lime-400` for active states and actions

## Integration Points

### Wallet Integration
- Uses `@rainbow-me/rainbowkit` for wallet connection
- ConnectButton integrated in Header component
- Ready for wallet state management in VaultPage

### State Management
- Currently uses React useState for local state
- Prepared for integration with external state management
- Props drilling minimized through component composition

### Future Extensibility

#### Tab System
- TabPlaceholder provides template for new tab implementations
- Tab type system supports easy addition of new tabs
- Event handlers ready for multi-tab functionality

#### Form Integration
- Form data structure supports additional fields
- Event handlers prepared for complex form logic
- Validation system ready for implementation

#### API Integration
- Mock data clearly separated for easy replacement
- Async operations ready via event handlers
- Error handling structure prepared

## Development Notes

### Component Guidelines
1. **Single Responsibility**: Each component has one clear purpose
2. **Props Interface**: All components have typed props interfaces
3. **Composition over Inheritance**: Complex components built from simple ones
4. **Stateless UI**: Business logic separated from presentation

### Testing Strategy
- Components designed for easy unit testing
- Props interfaces enable mock data injection
- Event handlers enable behavior testing
- No external dependencies in UI components

### Performance Considerations
- Components are lightweight and focused
- No unnecessary re-renders through proper prop design
- Ready for React.memo optimization where needed
- Bundle size optimized through component splitting

## Migration Notes

### From Monolithic Component
The original monolithic component has been split while preserving:
- ✅ All visual elements and styling
- ✅ Complete UI functionality structure
- ✅ Tab navigation system
- ✅ Form input handling
- ✅ Exchange rate calculations
- ✅ Wallet integration points

### Next Steps for Implementation
1. Replace mock data with real API calls
2. Implement actual wallet integration logic
3. Add form validation and error handling
4. Implement other tab functionalities (Withdraw, Stake, Unstake)
5. Add loading states and user feedback
6. Integrate with backend services