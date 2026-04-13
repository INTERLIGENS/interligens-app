import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = "https://app.interligens.com";
const results = [];

function log(label, pass, detail) {
  console.log(`${pass ? "PASS" : "FAIL"} ${label}${detail ? " — " + detail : ""}`);
  results.push({ label, pass, detail });
}

// ── 4.1 Find an active share ─────────────────────────────────────────────
let shares = [];
try {
  shares = await prisma.$queryRaw`
    SELECT id, token, "expiresAt", "titleSnapshot", "entitySnapshot"
    FROM "VaultCaseShare"
    WHERE "expiresAt" > NOW()
    LIMIT 5
  `;
} catch (err) {
  const msg = String(err).slice(0, 80);
  log(
    "4.1 VaultCaseShare table",
    false,
    `table missing/error — V2C migration not applied: ${msg}`
  );
  console.log("\n__JSON__\n" + JSON.stringify(results));
  await prisma.$disconnect();
  process.exit(0);
}

log("4.1 find active share", shares.length > 0, `found=${shares.length}`);

if (shares.length === 0) {
  console.log("\n__JSON__\n" + JSON.stringify(results));
  await prisma.$disconnect();
  process.exit(0);
}

// ── 4.2 Fetch the public share page ──────────────────────────────────────
const active = shares[0];
const url = `${BASE}/shared/case/${active.token}`;
try {
  const res = await fetch(url);
  log("4.2a share page responds 200", res.status === 200, `status=${res.status}`);
  const html = await res.text();

  // Check no forbidden fields appear in rendered HTML
  const forbidden = ["contentEnc", "titleEnc", "r2Key", "contentIv", "titleIv", "filenameEnc", "kdfSalt"];
  const leaked = forbidden.filter((k) => html.includes(k));
  log(
    "4.2b no forbidden fields in rendered HTML",
    leaked.length === 0,
    leaked.length > 0 ? `LEAK: ${leaked.join(",")}` : "clean"
  );

  // Sanity: page includes the title snapshot
  const titleInPage = html.includes(String(active.titleSnapshot).slice(0, 20));
  log("4.2c page includes title snapshot", titleInPage, `titleSnapshot="${active.titleSnapshot}"`);
} catch (err) {
  log("4.2 fetch share page", false, `error: ${String(err).slice(0, 100)}`);
}

// ── 4.3 Test expired link ────────────────────────────────────────────────
try {
  const expiredRows = await prisma.$queryRaw`
    SELECT token FROM "VaultCaseShare"
    WHERE "expiresAt" <= NOW()
    LIMIT 1
  `;
  if (expiredRows.length === 0) {
    log("4.3 expired share test", true, "no expired share available (SKIP)");
  } else {
    const res = await fetch(`${BASE}/shared/case/${expiredRows[0].token}`);
    const html = await res.text();
    const showsExpired =
      /expired|Expired|EXPIRED|link has expired/i.test(html) && res.status < 500;
    log("4.3 expired link shows graceful state", showsExpired, `status=${res.status}`);
  }
} catch (err) {
  log("4.3 expired link test", false, `error: ${String(err).slice(0, 100)}`);
}

// ── 4.4 Snapshot safety at DB level ──────────────────────────────────────
let snapshotIssues = 0;
let checked = 0;
for (const s of shares) {
  checked++;
  const entityStr = JSON.stringify(s.entitySnapshot ?? []);
  if (/[A-Za-z]Enc["']\s*:/.test(entityStr)) snapshotIssues++;
  if (/[A-Za-z]Iv["']\s*:/.test(entityStr)) snapshotIssues++;
  if (/r2Key["']\s*:/.test(entityStr)) snapshotIssues++;
}
log(
  "4.4 entitySnapshot contains no forbidden keys",
  snapshotIssues === 0,
  `${checked} snapshots checked, ${snapshotIssues} issues`
);

console.log("\n__JSON__\n" + JSON.stringify(results));
await prisma.$disconnect();
