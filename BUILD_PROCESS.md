# Phoenix UI Build Process Documentation

## Overview
This document describes the build process for the Phoenix UI React/TypeScript application after resolving compile errors and implementing static build generation.

## Fixed Issues

### TypeScript and Testing Library Issues
1. **Missing @testing-library/dom dependency**: Added as a production dependency to resolve testing import issues
2. **Incorrect imports**: Fixed imports in test files to properly import `screen`, `fireEvent`, and `waitFor` from `@testing-library/dom`
3. **TokenBalance interface mismatches**: Updated test files to use `balance` and `balanceUsd` properties instead of incorrect `amount` property
4. **Unused variables**: Removed unused variables in test files to eliminate TypeScript warnings
5. **Test wrapper function issues**: Fixed createWrapper function to return the component directly instead of a function that returns a component

### Build Configuration
- **Output directory**: Configured Vite to output static build to `dist/build/` directory as required
- **Vite configuration**: Updated `vite.config.ts` with proper build output directory

## Development Commands

### Install Dependencies
```bash
yarn install
```

### Development Server
```bash
yarn dev
```
- Starts development server on http://localhost:5173
- Hot module replacement enabled
- TypeScript type checking integrated

### Type Checking
```bash
yarn typecheck
```
- Runs TypeScript compiler with `--noEmit` flag
- Validates all TypeScript types without generating output

### Testing
```bash
yarn test        # Run tests in watch mode
yarn test:run    # Run tests once
yarn test:ui     # Run tests with UI interface
```

## Production Build

### Build Command
```bash
yarn build
```

### Build Process
1. **TypeScript Compilation**: Runs `tsc -b` to compile TypeScript files and validate types
2. **Vite Build**: Runs `vite build` to bundle application for production
3. **Output Location**: Static assets generated in `dist/build/` directory
4. **Asset Optimization**:
   - JavaScript bundles minified and optimized
   - CSS extracted and minified
   - Images and other assets processed and optimized
   - Code splitting for better performance

### Build Output Structure
```
dist/build/
├── index.html              # Main HTML file
├── vite.svg                # Vite logo asset
├── assets/                 # Bundled and optimized assets
│   ├── *.css              # Minified stylesheets
│   ├── *.js               # Minified JavaScript bundles
│   └── *.png              # Optimized images
└── deployments/           # Deployment-related files
```

### Preview Built Application
```bash
yarn preview
```
- Serves the built application from `dist/build/` directory
- Available on http://localhost:4173
- Useful for testing production build locally

## Build Performance Notes
- Total bundle size: ~819 kB (minified)
- Gzipped size: ~252 kB
- Build time: ~5-7 seconds
- Large chunks warning due to comprehensive blockchain/wallet libraries

## Deployment
The `dist/build/` directory contains all static assets needed for deployment to any static hosting service:
- CDNs (CloudFront, CloudFlare)
- Static hosting (Netlify, Vercel, GitHub Pages)
- Web servers (Apache, Nginx)

## Dependencies Overview
- **React 19**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server
- **RainbowKit**: Wallet connection
- **Wagmi**: Ethereum interactions
- **TailwindCSS**: Styling
- **Vitest**: Testing framework

## Configuration Files
- `vite.config.ts`: Vite build configuration
- `tsconfig.json`: TypeScript configuration
- `package.json`: Dependencies and scripts
- `tailwind.config.js`: TailwindCSS configuration