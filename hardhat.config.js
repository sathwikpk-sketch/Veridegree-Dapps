require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
const networks = {};
if (process.env.SEPOLIA_RPC_URL) {
  networks.sepolia = {
    url: process.env.SEPOLIA_RPC_URL,
    chainId: 11155111,
    accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
  };
}

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks,
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
};
