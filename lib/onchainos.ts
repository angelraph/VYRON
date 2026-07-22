import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

export const execFileAsync = promisify(execFile);

/** Vercel's build has no `onchainos` on PATH — `scripts/fetch-onchainos.mjs`
 * downloads a verified Linux binary to `bin/onchainos` at build time and
 * `outputFileTracingIncludes` (next.config.ts) bundles it into whichever
 * route functions need it. Local dev keeps using the PATH-installed binary. */
const BUNDLED_BINARY = path.join(process.cwd(), "bin", "onchainos");
const IS_BUNDLED = existsSync(BUNDLED_BINARY);
export const ONCHAINOS_BIN = IS_BUNDLED ? BUNDLED_BINARY : "onchainos";

/** Only /tmp is writable in Vercel's Lambda sandbox — `/var/task` (where the
 * bundled binary lives) is read-only, so onchainos's own config/session dir
 * has to be redirected there via ONCHAINOS_HOME. Local dev already has a
 * persisted email-login session under the real $HOME, so this is skipped
 * there; instead the bundled path does a silent API-Key login (OKX_API_KEY /
 * OKX_SECRET_KEY / OKX_PASSPHRASE env vars) before every call, since a fresh
 * Lambda container has no prior session to reuse. */
export const ONCHAINOS_ENV = IS_BUNDLED
  ? { ...process.env, ONCHAINOS_HOME: "/tmp/.onchainos" }
  : process.env;

let bundledLoginDone = false;
export async function ensureBundledLogin(): Promise<void> {
  if (!IS_BUNDLED || bundledLoginDone) return;
  await execFileAsync(ONCHAINOS_BIN, ["wallet", "login"], { env: ONCHAINOS_ENV });
  bundledLoginDone = true;
}
