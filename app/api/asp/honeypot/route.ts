import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { fulfillAdHocTask } from "@/lib/engine/executor";
import { checkRateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const execFileAsync = promisify(execFile);

/** Vercel's build has no `onchainos` on PATH — `scripts/fetch-onchainos.mjs`
 * downloads a verified Linux binary to `bin/onchainos` at build time and
 * `outputFileTracingIncludes` (next.config.ts) bundles it into this route's
 * function. Local dev keeps using the PATH-installed binary. */
const BUNDLED_BINARY = path.join(process.cwd(), "bin", "onchainos");
const ONCHAINOS_BIN = existsSync(BUNDLED_BINARY) ? BUNDLED_BINARY : "onchainos";

/** Fulfillment bridge for the "Honeypot & Rug Risk Scanner" ASP service
 * registered on OKX.AI (agent #4962). Orders arrive over OKX's A2A channel,
 * not HTTP — this route exists so the agent handling that conversation can
 * get a real analysis to submit, instead of one written by hand.
 *
 * The model is NEVER asked to guess at on-chain facts. `onchainos security
 * token-scan` (real, server-computed by OKX — riskLevel, taxes, honeypot/
 * renounce flags) is fetched first; the model's only job is to synthesize
 * that real data into a plain-English verdict. If the scan can't identify
 * the contract, this returns an honest "no data" result rather than
 * fabricating findings. */

const requestSchema = z.object({
  contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid 0x EVM contract address."),
  chainId: z.string().regex(/^\d+$/, "chainId must be numeric (e.g. 196 for X Layer, 56 for BSC, 1 for Ethereum)."),
  concern: z.string().max(300).optional(),
});

const RATE_LIMIT = { max: 20, windowMs: 60_000 };

const VYRON_PERSONA = {
  name: "VYRON",
  tagline: "Autonomous objective execution",
  bio: "VYRON plans, executes, and independently verifies every piece of work it delivers — including this scan, which is grounded in real on-chain risk data (not model guesswork) before being explained in plain English.",
};

interface TokenScanResult {
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | string;
  buyTaxes: string | null;
  sellTaxes: string | null;
  isHoneypot: boolean;
  isNotRenounced: boolean;
  isMintable: boolean;
  isHasFrozenAuth: boolean;
  isLowLiquidity: boolean;
  isLiquidityRemoval: boolean;
  isFundLinkage: boolean;
  [key: string]: unknown;
}

async function fetchRealTokenRisk(
  contractAddress: string,
  chainId: string,
): Promise<TokenScanResult | null> {
  const { stdout } = await execFileAsync(ONCHAINOS_BIN, [
    "security",
    "token-scan",
    "--tokens",
    `${chainId}:${contractAddress}`,
  ]);
  const parsed = JSON.parse(stdout) as { ok: boolean; data: TokenScanResult[] };
  if (!parsed.ok || parsed.data.length === 0) return null;
  return parsed.data[0];
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  const rateLimit = checkRateLimit("asp:honeypot", RATE_LIMIT);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many scan requests — please wait a moment." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)) } },
    );
  }

  const { contractAddress, chainId, concern } = parsed.data;
  const startedAt = Date.now();

  let riskData: TokenScanResult | null;
  try {
    riskData = await fetchRealTokenRisk(contractAddress, chainId);
  } catch (error) {
    const execError = error as NodeJS.ErrnoException & { code?: number | string; signal?: string; stderr?: string; stdout?: string };
    logger.error("asp_fulfillment", {
      stage: "honeypot_scan",
      outcome: "failure",
      error: error instanceof Error ? error.message : String(error),
      errCode: execError?.code,
      errSignal: execError?.signal,
      errStderr: execError?.stderr,
      errStdout: execError?.stdout,
      binPath: ONCHAINOS_BIN,
    });
    return Response.json({ error: "Could not reach the on-chain risk scanner. Try again." }, { status: 502 });
  }

  if (!riskData) {
    return Response.json({
      deliverable: null,
      summary: `No on-chain risk data found for ${contractAddress} on chain ${chainId} — this address may not be a recognized token contract, or this chain isn't supported by the scanner. Verify the address and chain before proceeding.`,
      approved: false,
      qualityScore: 0,
      feedback: "No real data to ground an analysis in — refusing to fabricate one.",
    });
  }

  const riskFacts = [
    `riskLevel: ${riskData.riskLevel}`,
    `buyTax: ${riskData.buyTaxes ?? "none"}%`,
    `sellTax: ${riskData.sellTaxes ?? "none"}%`,
    `isHoneypot: ${riskData.isHoneypot}`,
    `ownershipRenounced: ${!riskData.isNotRenounced}`,
    `isMintable: ${riskData.isMintable}`,
    `hasFreezeAuthority: ${riskData.isHasFrozenAuth}`,
    `lowLiquidity: ${riskData.isLowLiquidity}`,
    `liquidityRemovalDetected: ${riskData.isLiquidityRemoval}`,
    `linkedToKnownRugpullGang: ${riskData.isFundLinkage}`,
  ].join(", ");

  const description = [
    `A real on-chain security scan already ran for ${contractAddress} on chain ${chainId}.`,
    `Real findings (do not invent anything beyond these): ${riskFacts}.`,
    concern ? `The requester specifically asked about: ${concern}.` : "",
    `Explain what these real findings actually mean for someone deciding whether to`,
    `buy or hold this token, in plain English. Do not state any specific technical`,
    `detail (tax %, flags) that isn't listed above — only synthesize and explain`,
    `the given facts.`,
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const result = await fulfillAdHocTask({
      goalTitle: `Honeypot & rug risk scan — ${contractAddress} (chain ${chainId})`,
      task: {
        title: "Honeypot & Rug Risk Scan",
        description,
        specialization: "Security Audit",
      },
      agent: VYRON_PERSONA,
    });

    logger.info("asp_fulfillment", {
      stage: "honeypot_scan",
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      durationMs: Date.now() - startedAt,
      outcome: result.approved ? "approved" : "rejected",
      qualityScore: result.qualityScore,
    });

    return Response.json({ ...result, riskData });
  } catch (error) {
    logger.error("asp_fulfillment", {
      stage: "honeypot_scan",
      durationMs: Date.now() - startedAt,
      outcome: "failure",
      error: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ error: "Analysis failed. Try again." }, { status: 500 });
  }
}
