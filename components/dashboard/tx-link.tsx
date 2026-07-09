import { CheckCircle2, ExternalLink } from "lucide-react";

function truncateHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

/** Shown next to an activity row only when it was settled by a real
 * on-chain provider — absent entirely under the simulated provider. */
export function TxLink({
  txHash,
  explorerUrl,
}: {
  txHash?: string | null;
  explorerUrl?: string | null;
}) {
  if (!txHash) return null;

  return (
    <span className="mt-1 flex items-center gap-1.5 text-xs text-emerald-400">
      <CheckCircle2 className="size-3" />
      Confirmed
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground flex items-center gap-0.5 underline underline-offset-2"
        >
          {truncateHash(txHash)}
          <ExternalLink className="size-3" />
        </a>
      )}
    </span>
  );
}
