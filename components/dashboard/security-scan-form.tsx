"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, ScanSearch, ShieldAlert, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CHAINS = [
  { id: "196", label: "X Layer" },
  { id: "1", label: "Ethereum" },
  { id: "56", label: "BNB Chain" },
  { id: "137", label: "Polygon" },
  { id: "42161", label: "Arbitrum" },
  { id: "8453", label: "Base" },
  { id: "501", label: "Solana" },
];

const SOLANA_CHAIN_ID = "501";
const EVM_ADDRESS_PATTERN = "^0x[a-fA-F0-9]{40}$";
/** Base58 (no 0/O/I/l), 32-44 chars — Solana's actual address shape, not an
 * EVM one with the 0x lopped off. */
const SOLANA_ADDRESS_PATTERN = "^[1-9A-HJ-NP-Za-km-z]{32,44}$";

interface RiskData {
  riskLevel: string;
  buyTaxes: string | null;
  sellTaxes: string | null;
  isHoneypot: boolean;
  isNotRenounced: boolean;
  isMintable: boolean;
  isLowLiquidity: boolean;
}

interface ScanResult {
  deliverable: string | null;
  summary: string;
  approved: boolean;
  qualityScore: number;
  feedback: string;
  riskData?: RiskData;
  error?: string;
}

const RISK_STYLE: Record<string, string> = {
  LOW: "text-emerald-400",
  MEDIUM: "text-amber-400",
  HIGH: "text-orange-400",
  CRITICAL: "text-destructive",
};

export function SecurityScanForm() {
  const [contractAddress, setContractAddress] = useState("");
  const [chainId, setChainId] = useState("196");
  const [concern, setConcern] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/asp/honeypot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractAddress, chainId, concern: concern || undefined }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Scan failed. Try again.");
      } else {
        setResult(body);
      }
    } catch {
      setError("Lost connection to the scanner. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="glass border-0 py-6">
        <CardContent className="px-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="contractAddress">
                {chainId === SOLANA_CHAIN_ID ? "Token mint address" : "Contract address"}
              </Label>
              <Input
                id="contractAddress"
                placeholder={chainId === SOLANA_CHAIN_ID ? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" : "0x..."}
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                required
                pattern={chainId === SOLANA_CHAIN_ID ? SOLANA_ADDRESS_PATTERN : EVM_ADDRESS_PATTERN}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex flex-col gap-2 sm:max-w-xs">
              <Label htmlFor="chain">Chain</Label>
              <Select value={chainId} onValueChange={setChainId}>
                <SelectTrigger id="chain">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHAINS.map((chain) => (
                    <SelectItem key={chain.id} value={chain.id}>
                      {chain.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="concern">Specific concern (optional)</Label>
              <Textarea
                id="concern"
                placeholder="e.g. sell tax, ownership renouncement, liquidity locks..."
                rows={2}
                value={concern}
                onChange={(e) => setConcern(e.target.value)}
                className="resize-none text-sm"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="bg-gradient-brand text-primary-foreground w-fit"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <ScanSearch className="size-4" />
                  Scan contract
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card className="glass border-0 py-5">
          <CardContent className="text-destructive flex items-center gap-2 px-5 text-sm">
            <AlertTriangle className="size-4 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="glass border-0 py-6">
          <CardContent className="flex flex-col gap-5 px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {result.approved ? (
                  <ShieldCheck className="size-5 text-emerald-400" />
                ) : (
                  <ShieldAlert className="text-destructive size-5" />
                )}
                <p className="text-sm font-medium">
                  {result.approved ? "Passed verification" : "Flagged for review"}
                </p>
              </div>
              <span className="text-muted-foreground text-xs tabular-nums">
                Quality score: {result.qualityScore}/100
              </span>
            </div>

            {result.riskData && (
              <div className="border-border/60 grid grid-cols-2 gap-3 rounded-xl border p-4 text-xs sm:grid-cols-3">
                <div>
                  <p className="text-muted-foreground">Risk level</p>
                  <p className={`font-medium ${RISK_STYLE[result.riskData.riskLevel] ?? ""}`}>
                    {result.riskData.riskLevel}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Honeypot</p>
                  <p className="font-medium">{result.riskData.isHoneypot ? "Yes ⚠️" : "No"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ownership renounced</p>
                  <p className="font-medium">{result.riskData.isNotRenounced ? "No" : "Yes"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Buy / sell tax</p>
                  <p className="font-medium">
                    {result.riskData.buyTaxes ?? "0"}% / {result.riskData.sellTaxes ?? "0"}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Mintable</p>
                  <p className="font-medium">{result.riskData.isMintable ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Low liquidity</p>
                  <p className="font-medium">{result.riskData.isLowLiquidity ? "Yes ⚠️" : "No"}</p>
                </div>
              </div>
            )}

            {result.deliverable ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.deliverable}</p>
            ) : (
              <p className="text-muted-foreground text-sm">{result.summary}</p>
            )}

            <p className="text-muted-foreground border-border/60 border-t pt-3 text-xs">
              Reviewer note: {result.feedback}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
