// One-off: bundles the isolated VYRON onchainos session into a single
// base64 blob for a Vercel env var, so the heartbeat Lambda can restore a
// real logged-in session at cold start instead of the broken "silent AK
// login via wallet login" approach (confirmed not to exist in this CLI).
import fs from "node:fs";
import path from "node:path";

const home = process.env.ONCHAINOS_HOME;
if (!home) {
  console.error("Set $env:ONCHAINOS_HOME to the .onchainos-home folder first");
  process.exit(1);
}

const files = ["session.json", "wallets.json", "keyring.enc", "machine-identity"];
const bundle = {};
for (const f of files) {
  const p = path.join(home, f);
  if (fs.existsSync(p)) {
    bundle[f] = fs.readFileSync(p).toString("base64");
  }
}
const out = Buffer.from(JSON.stringify(bundle)).toString("base64");

// Write directly (ascii, no BOM) instead of relying on shell redirection —
// PowerShell 5.1's `>` / Out-File defaults to UTF-16, which corrupts plain
// base64 text.
const outPath = path.join(process.cwd(), "vyron-session-bundle.b64.txt");
fs.writeFileSync(outPath, out, "ascii");
console.error("wrote " + outPath + " (" + out.length + " chars)");
