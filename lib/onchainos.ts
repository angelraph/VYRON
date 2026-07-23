import { execFile } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
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

const BUNDLED_HOME = "/tmp/.onchainos";

/** Only /tmp is writable in Vercel's Lambda sandbox — `/var/task` (where the
 * bundled binary lives) is read-only, so onchainos's own config/session dir
 * has to be redirected there via ONCHAINOS_HOME. Local dev already has a
 * persisted email-login session under the real $HOME, so this is skipped
 * there. */
export const ONCHAINOS_ENV = IS_BUNDLED
  ? { ...process.env, ONCHAINOS_HOME: BUNDLED_HOME }
  : process.env;

let bundledLoginDone = false;

/** `onchainos wallet login` has no headless mode — it only ever mints a
 * browser URL and waits for a human to complete OAuth, regardless of
 * OKX_API_KEY/SECRET/PASSPHRASE (confirmed by testing: those env vars are
 * silently ignored by this command). So a fresh Lambda container can't log
 * itself in. Instead, a session established once via a real interactive
 * login (session.json/wallets.json/keyring.enc/machine-identity from
 * ~/.onchainos, see scripts/bundle-session.mjs) is stored base64-JSON-encoded
 * in ONCHAINOS_SESSION_BUNDLE and restored onto disk here before the first
 * command each cold start. The session token itself has a multi-month
 * expiry (see sessionKeyExpireAt in session.json) but isn't renewed
 * automatically — re-run scripts/bundle-session.mjs and update the env var
 * if the heartbeat starts failing again after that date. */
export async function ensureBundledLogin(): Promise<void> {
  if (!IS_BUNDLED || bundledLoginDone) return;

  const bundleB64 = process.env.ONCHAINOS_SESSION_BUNDLE;
  if (bundleB64) {
    const bundle = JSON.parse(Buffer.from(bundleB64, "base64").toString("utf8")) as Record<string, string>;
    mkdirSync(BUNDLED_HOME, { recursive: true });
    for (const [filename, contentB64] of Object.entries(bundle)) {
      writeFileSync(path.join(BUNDLED_HOME, filename), Buffer.from(contentB64, "base64"));
    }
  } else {
    await execFileAsync(ONCHAINOS_BIN, ["wallet", "login"], { env: ONCHAINOS_ENV });
  }
  bundledLoginDone = true;
}
