import "@nomicfoundation/hardhat-toolbox-viem";
import type { HardhatUserConfig } from "hardhat/config";
import * as dotenv from "dotenv";

dotenv.config();

const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      // AgentRegistry copies a calldata string[] into a storage struct
      // literal, which the legacy codegen can't handle — the IR pipeline
      // supports it (and is the generally recommended pipeline anyway).
      viaIR: true,
    },
  },
  networks: {
    xlayerTestnet: {
      url: process.env.XLAYER_TESTNET_RPC_URL ?? "https://testrpc.xlayer.tech",
      chainId: 1952,
      accounts: deployerPrivateKey ? [deployerPrivateKey] : [],
    },
  },
};

export default config;
