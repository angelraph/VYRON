"use client";

import { useEffect } from "react";
import { formatUnits } from "viem";
import {
  useBalance,
  useConnect,
  useConnection,
  useConnections,
  useConnectors,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { AlertTriangle, Loader2, LogOut, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { xLayerTestnet } from "@/lib/web3/config";
import { saveWalletAddressAction } from "@/lib/actions/wallet";

const CONNECTOR_LABELS: Record<string, string> = {
  okxWallet: "OKX Wallet",
  metaMaskSDK: "MetaMask",
  walletConnect: "WalletConnect",
};

function truncate(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Real wagmi/viem wallet connection on X Layer Testnet — no simulated
 * timers, no fake addresses. Connects via OKX Wallet, MetaMask, or
 * WalletConnect, reads the live native balance, and prompts a network
 * switch when the connected wallet isn't on X Layer. */
export function WalletConnect({
  persistedAddress,
}: {
  persistedAddress: string | null;
}) {
  const { address, isConnected, chainId } = useConnection();
  const connectors = useConnectors();
  const activeConnector = useConnections()[0]?.connector;
  const { mutate: connect, isPending: isConnecting, variables } = useConnect();
  const { mutate: disconnect } = useDisconnect();
  const { mutate: switchChain, isPending: isSwitching } = useSwitchChain();
  const { data: balance, isLoading: isBalanceLoading } = useBalance({
    address,
    chainId: xLayerTestnet.id,
    query: { enabled: isConnected },
  });

  const wrongNetwork = isConnected && chainId !== xLayerTestnet.id;
  const walletLabel = activeConnector
    ? (CONNECTOR_LABELS[activeConnector.id] ?? activeConnector.name)
    : "Wallet";

  useEffect(() => {
    saveWalletAddressAction(address ?? null).catch(() => {
      // Best-effort profile sync — the live connection itself isn't affected.
    });
  }, [address]);

  if (!isConnected) {
    return (
      <div className="flex flex-col gap-2">
        {connectors.map((connector) => (
          <Button
            key={connector.uid}
            variant="outline"
            className="justify-start"
            disabled={isConnecting}
            onClick={() =>
              connect(
                { connector },
                {
                  onError: (error) => {
                    toast.error(
                      `Couldn't connect ${CONNECTOR_LABELS[connector.id] ?? connector.name}`,
                      { description: error.message },
                    );
                  },
                  onSuccess: () => {
                    toast.success(
                      `${CONNECTOR_LABELS[connector.id] ?? connector.name} connected`,
                    );
                  },
                },
              )
            }
          >
            {isConnecting && variables?.connector === connector ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wallet className="size-4" />
            )}
            {CONNECTOR_LABELS[connector.id] ?? connector.name}
          </Button>
        ))}
        {persistedAddress && (
          <p className="text-muted-foreground text-xs">
            Last connected: {truncate(persistedAddress)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-full">
            <Wallet className="text-violet size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{walletLabel}</p>
            <p className="text-muted-foreground truncate text-xs">
              {address && truncate(address)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
          <Badge variant={wrongNetwork ? "destructive" : "secondary"}>
            {wrongNetwork ? "Wrong network" : xLayerTestnet.name}
          </Badge>
          <p className="text-muted-foreground text-xs whitespace-nowrap">
            {isBalanceLoading
              ? "Loading balance..."
              : balance
                ? `${Number(formatUnits(balance.value, balance.decimals)).toFixed(4)} ${balance.symbol}`
                : "—"}
          </p>
        </div>
      </div>

      {wrongNetwork && (
        <Button
          variant="outline"
          size="sm"
          disabled={isSwitching}
          className="w-full sm:w-fit"
          onClick={() => switchChain({ chainId: xLayerTestnet.id })}
        >
          {isSwitching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <AlertTriangle className="size-4" />
          )}
          Switch to {xLayerTestnet.name}
        </Button>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => disconnect()}
        className="w-full sm:w-fit"
      >
        <LogOut className="size-4" />
        Disconnect
      </Button>
    </div>
  );
}
