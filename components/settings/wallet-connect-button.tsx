"use client";

import { useState } from "react";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function WalletConnectButton() {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  function handleClick() {
    if (connected) return;
    setConnecting(true);
    setTimeout(() => {
      setConnecting(false);
      setConnected(true);
      toast.success("X Layer wallet connected (simulated)", {
        description: "0x8f3e...92aC — escrow settlement is simulated for this demo.",
      });
    }, 1200);
  }

  return (
    <Button
      variant={connected ? "secondary" : "default"}
      className={connected ? "" : "bg-gradient-brand text-primary-foreground"}
      onClick={handleClick}
      disabled={connecting}
    >
      {connecting ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Wallet className="size-4" />
      )}
      {connected ? "Wallet connected" : connecting ? "Connecting..." : "Connect X Layer wallet"}
    </Button>
  );
}
