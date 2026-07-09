import { createConfig, http } from "wagmi";
import { xLayerTestnet } from "viem/chains";
// Imported from their specific subpaths rather than the `wagmi/connectors`
// barrel — that barrel re-exports a `tempoWallet` connector whose internal
// module has a broken import in this wagmi release, which breaks the whole
// barrel at build time even though we never use it.
import { injected } from "wagmi/connectors/injected";
import { metaMask } from "wagmi/connectors/metaMask";
import { walletConnect } from "wagmi/connectors/walletConnect";

export { xLayerTestnet };

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

/** WalletConnect requires a project id from a WalletConnect Cloud project.
 * Without one, the connector is simply omitted — OKX Wallet and MetaMask
 * still work via their injected/SDK connectors with zero config. */
export const isWalletConnectConfigured = Boolean(walletConnectProjectId);

export const wagmiConfig = createConfig({
  chains: [xLayerTestnet],
  ssr: true,
  transports: {
    [xLayerTestnet.id]: http(),
  },
  connectors: [
    injected({ target: "okxWallet" }),
    metaMask({ dappMetadata: { name: "VYRON", url: "https://vyron.ai" } }),
    ...(walletConnectProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            metadata: {
              name: "VYRON",
              description: "Every goal. Executed.",
              url: "https://vyron.ai",
              icons: [],
            },
          }),
        ]
      : []),
  ],
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
