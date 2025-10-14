# Phoenix UI - React + TypeScript + Vite

This is the Phoenix UI application built with React, TypeScript, and Vite. It provides a decentralized application interface for interacting with smart contracts on Ethereum mainnet and local Anvil networks.

## Development Setup

### Prerequisites

- Node.js 18+ and npm/yarn
- A local deployment server (from deployment-staging-RM project)
- [Foundry](https://book.getfoundry.sh/getting-started/installation) installed (for Anvil blockchain)

### Configuration

1. Create a `.envrc` file in the project root:

```bash
# DEPLOYMENT_SERVER_PATH: Path to your local deployment server
# This server provides contract addresses for local development
export DEPLOYMENT_SERVER_PATH=~/code/reflax-mint/deployment-staging
```

**Note:** The `.envrc` file is gitignored and should not be committed. Each developer should configure their own local path.

### Development Workflow

The `yarn dev` command now automatically:
1. Starts the Anvil blockchain server with deployed mock contracts
2. Waits for the deployment server to be ready at localhost:3001/contracts
3. Starts the Vite development server for the UI

To start the full development environment:

```bash
yarn dev
```

This will:
- Launch the deployment server from `$DEPLOYMENT_SERVER_PATH`
- Deploy mock contracts to a local Anvil instance
- Start the contract address API server at http://localhost:3001
- Start the Vite UI server (typically at http://localhost:5173)
- Display interleaved output from both processes with color coding

To start only the UI (without the deployment server):

```bash
yarn dev:ui
```

### Stopping the Development Server

Press `Ctrl+C` in the terminal to stop both the deployment server and UI server. Both processes will terminate cleanly.

## Troubleshooting

### Port 3001 Already in Use

If you see an error that port 3001 is already in use:

```bash
# Find the process using port 3001
lsof -i :3001

# Kill the process (replace PID with the actual process ID)
kill <PID>
```

Or use a different port by modifying the deployment server configuration.

### DEPLOYMENT_SERVER_PATH Not Set

If you see the error "DEPLOYMENT_SERVER_PATH is not set":

1. Ensure you have created a `.envrc` file in the project root
2. Add the export statement: `export DEPLOYMENT_SERVER_PATH=~/code/reflax-mint/deployment-staging`
3. The dev script will automatically load this file

### Deployment Server Directory Not Found

If you see "Deployment server directory not found":

1. Verify the path in your `.envrc` file points to a valid directory
2. Ensure the deployment server project is cloned and set up
3. Use an absolute path or tilde expansion (e.g., `~/code/...`)

### Contracts Endpoint Unreachable

If the UI starts but can't reach the contracts endpoint:

1. Check that the deployment server started successfully (look for "Server running on http://localhost:3001" in the output)
2. Test the endpoint manually: `curl http://localhost:3001/contracts`
3. Ensure Anvil blockchain is running (you should see Anvil output in the logs)
4. If the server fails, the UI will still start but may show errors when trying to load contract addresses

### Example .envrc Configuration

```bash
# Phoenix UI Development Configuration
# Path to the deployment server directory
export DEPLOYMENT_SERVER_PATH=~/code/reflax-mint/deployment-staging
```

## Available Plugins

Currently, two official Vite plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
