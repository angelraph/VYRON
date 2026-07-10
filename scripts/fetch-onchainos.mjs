// Downloads and SHA256-verifies the Linux onchainos CLI binary at build time
// so `/api/asp/honeypot` can shell out to it on Vercel, where the binary
// isn't preinstalled (unlike local dev, where it's on PATH from the
// interactive installer). Skipped on non-Linux build hosts (e.g. local
// Windows dev) since PATH-based `onchainos` already works there.
import { createHash } from "node:crypto";
import { chmod, mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const VERSION = "v4.2.2";
const ASSET = "onchainos-x86_64-unknown-linux-musl";
const EXPECTED_SHA256 =
  "89eafa29fcf779758a742bb2fa80f799364306f7407d5cb3695d7ae8b5b8b713";
const BASE_URL = `https://github.com/okx/onchainos-skills/releases/download/${VERSION}`;

const outDir = path.join(process.cwd(), "bin");
const outFile = path.join(outDir, "onchainos");

async function alreadyValid() {
  if (!existsSync(outFile)) return false;
  const buf = await readFile(outFile);
  return createHash("sha256").update(buf).digest("hex") === EXPECTED_SHA256;
}

async function main() {
  if (process.platform !== "linux") {
    console.log("[fetch-onchainos] non-Linux build host, skipping (using PATH onchainos instead)");
    return;
  }
  if (await alreadyValid()) {
    console.log("[fetch-onchainos] cached binary already verified, skipping download");
    return;
  }

  console.log(`[fetch-onchainos] downloading ${ASSET} ${VERSION}...`);
  const res = await fetch(`${BASE_URL}/${ASSET}`);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const actualSha256 = createHash("sha256").update(buf).digest("hex");
  if (actualSha256 !== EXPECTED_SHA256) {
    throw new Error(
      `SHA256 mismatch for ${ASSET}: expected ${EXPECTED_SHA256}, got ${actualSha256}`,
    );
  }

  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, buf);
  await chmod(outFile, 0o755);
  console.log(`[fetch-onchainos] verified and installed to ${outFile}`);
}

main().catch((err) => {
  console.error("[fetch-onchainos] failed:", err.message);
  process.exit(1);
});
