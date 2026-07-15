import { createConfig, http } from "wagmi";
import { xLayerTestnet } from "viem/chains";
import type { EIP1193Provider } from "viem";
// Imported from their specific subpaths rather than the `wagmi/connectors`
// barrel — that barrel re-exports a `tempoWallet` connector whose internal
// module has a broken import in this wagmi release, which breaks the whole
// barrel at build time even though we never use it.
import { injected } from "wagmi/connectors/injected";
import { metaMask } from "wagmi/connectors/metaMask";
import { walletConnect } from "wagmi/connectors/walletConnect";

export { xLayerTestnet };

type FlaggedProvider = EIP1193Provider & {
  isOkxWallet?: true;
  providers?: FlaggedProvider[];
};

/** wagmi's `injected()` resolves a wallet by name (e.g. `target: "okxWallet"`)
 * through a small built-in map covering MetaMask, Coinbase, and Phantom —
 * OKX isn't in that map. This target follows the exact same pattern wagmi
 * uses for those built-in wallets (see its `phantom` target: check the
 * wallet's own global first, then the shared multi-provider array), just
 * pointed at OKX's actual injection points:
 *  - OKX Wallet's EIP-1193 provider lives at `window.okxwallet.ethereum`
 *    (a nested property — `window.okxwallet` itself is not the provider).
 *  - When OKX registers into the shared `window.ethereum.providers` array
 *    instead (some multi-wallet browser setups), its entry sets
 *    `isOkxWallet: true`.
 * Checking `window.okxwallet.ethereum` first (and not relying solely on the
 * shared array) is what lets this work when another extension, like
 * MetaMask, has also claimed `window.ethereum` — that MetaMask connector is
 * unaffected since it targets its own `isMetaMask` flag independently. */
function okxWalletProvider(window?: {
  okxwallet?: { ethereum?: FlaggedProvider };
  ethereum?: FlaggedProvider;
}) {
  if (window?.okxwallet?.ethereum) return window.okxwallet.ethereum;

  const ethereum = window?.ethereum;
  if (ethereum?.providers) {
    return ethereum.providers.find((provider) => provider.isOkxWallet);
  }
  if (ethereum?.isOkxWallet) return ethereum;
  return undefined;
}

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

/** WalletConnect requires a project id from a WalletConnect Cloud project.
 * Without one, the connector is simply omitted — OKX Wallet and MetaMask
 * still work via their injected/SDK connectors with zero config. */
export const isWalletConnectConfigured = Boolean(walletConnectProjectId);

/** viem's built-in `xLayerTestnet` chain points its default RPC at
 * xlayertestrpc.okx.com, which doesn't resolve from some networks
 * (confirmed in this environment). testrpc.xlayer.tech resolves to the
 * same chain (1952) and is used as the default; override via
 * NEXT_PUBLIC_XLAYER_RPC_URL if your network needs a different endpoint. */
export const xLayerRpcUrl =
  process.env.NEXT_PUBLIC_XLAYER_RPC_URL ?? "https://testrpc.xlayer.tech";

export const wagmiConfig = createConfig({
  chains: [xLayerTestnet],
  ssr: true,
  // wagmi auto-discovers every EIP-6963-announced injected wallet (Phantom's
  // EVM provider, a second OKX entry alongside the one below, etc.) and adds
  // one connector per provider unless this is disabled. VYRON only wants the
  // three connectors explicitly listed below.
  multiInjectedProviderDiscovery: false,
  transports: {
    [xLayerTestnet.id]: http(xLayerRpcUrl),
  },
  connectors: [
    injected({
      target: {
        id: "okxWallet",
        name: "OKX Wallet",
        provider: okxWalletProvider,
      },
    }),
    metaMask({ dappMetadata: { name: "VYRON", url: "https://vyron.click" } }),
    ...(walletConnectProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            metadata: {
              name: "VYRON",
              description: "Every goal. Executed.",
              url: "https://vyron.click",
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
