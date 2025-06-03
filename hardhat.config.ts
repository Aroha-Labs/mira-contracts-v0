import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox-viem";
require("@nomicfoundation/hardhat-foundry");

const config: HardhatUserConfig = {
  solidity: "0.8.28",
  etherscan: {
    apiKey: vars.get("ETHERSCAN_API_KEY"),
    customChains: [
      {
        network: "miraAppchainTestnet",
        chainId: 8453200019,
        urls: {
          apiURL: "https://voyager-explorer-testnet.appchain.base.org/api",
          browserURL: "https://voyager-explorer-testnet.appchain.base.org"
        }
      }
    ]
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: [vars.get('DEPLOYER_PRIVATE_KEY')]
    },
    baseSepolia: {
      url: "https://sepolia.base.org/",
      accounts: [vars.get('DEPLOYER_PRIVATE_KEY')]
    },
    miraAppchainTestnet: {
      url: "https://voyager-rpc-testnet.appchain.base.org",
      accounts: [vars.get('DEPLOYER_PRIVATE_KEY')]
    },
  },
  sourcify: {
    // Disabled by default
    // Doesn't need an API key
    enabled: true
  }
};

export default config;
