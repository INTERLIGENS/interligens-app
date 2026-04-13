import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const results = [];

function log(label, pass, detail) {
  const status = pass ? "PASS" : "FAIL";
  console.log(`${status} ${label}${detail ? " — " + detail : ""}`);
  results.push({ label, pass, detail });
}

async function safe(label, fn) {
  try {
    await fn();
  } catch (err) {
    log(label, false, `ERROR: ${String(err).slice(0, 120)}`);
  }
}

// ── 2.1 VaultCase encryption ─────────────────────────────────────────────
await safe("2.1 VaultCase encryption shape", async () => {
  const rows = await prisma.$queryRaw`
    SELECT id, LENGTH("titleEnc") as title_len,
      LENGTH("titleIv") as iv_len, status
    FROM "VaultCase" LIMIT 10
  `;
  if (rows.length === 0) {
    log("2.1 VaultCase encryption", true, "no cases in DB (SKIP)");
    return;
  }
  let ok = 0;
  let bad = [];
  for (const r of rows) {
    const titleLen = Number(r.title_len);
    const ivLen = Number(r.iv_len);
    if (titleLen > 20 && ivLen > 10) ok++;
    else bad.push({ id: r.id, titleLen, ivLen });
  }
  log(
    "2.1 VaultCase encryption",
    bad.length === 0,
    `${ok}/${rows.length} rows valid${bad.length > 0 ? " · bad: " + JSON.stringify(bad).slice(0, 120) : ""}`
  );
});

// ── 2.2 VaultCaseNote encryption ─────────────────────────────────────────
await safe("2.2 VaultCaseNote encryption shape", async () => {
  const rows = await prisma.$queryRaw`
    SELECT id, LENGTH("contentEnc") as content_len,
      LENGTH("contentIv") as iv_len
    FROM "VaultCaseNote" LIMIT 10
  `;
  if (rows.length === 0) {
    log("2.2 VaultCaseNote encryption", true, "no notes in DB (SKIP)");
    return;
  }
  let ok = 0;
  let bad = [];
  for (const r of rows) {
    const cl = Number(r.content_len);
    const il = Number(r.iv_len);
    if (cl > 20 && il > 10) ok++;
    else bad.push({ id: r.id, contentLen: cl, ivLen: il });
  }
  log(
    "2.2 VaultCaseNote encryption",
    bad.length === 0,
    `${ok}/${rows.length} rows valid${bad.length > 0 ? " · bad: " + JSON.stringify(bad).slice(0, 120) : ""}`
  );
});

// ── 2.3 VaultCaseFile safety ─────────────────────────────────────────────
await safe("2.3 VaultCaseFile safety", async () => {
  const rows = await prisma.$queryRaw`
    SELECT id, "filenameEnc", "mimeType", "r2Key"
    FROM "VaultCaseFile" LIMIT 10
  `;
  if (rows.length === 0) {
    log("2.3 VaultCaseFile safety", true, "no files in DB (SKIP)");
    return;
  }
  let ok = 0;
  let issues = [];
  // r2Key shape: workspaceId/caseId/nanoid or similar (contains slashes, no path traversal)
  for (const r of rows) {
    const r2 = String(r.r2Key || "");
    const fn = String(r.filenameEnc || "");
    const slashes = (r2.match(/\//g) || []).length;
    const r2ok = slashes >= 2 && !r2.includes("..");
    // filenameEnc must not look like a plain filename — check for lack of common extensions and presence of base64-ish chars
    const looksLikeCiphertext = fn.length > 20 && !/\.(pdf|png|jpg|csv|json|txt|md|docx?)$/i.test(fn);
    if (r2ok && looksLikeCiphertext) ok++;
    else issues.push({ id: r.id, r2Slashes: slashes, filenameLen: fn.length });
  }
  log(
    "2.3 VaultCaseFile safety",
    issues.length === 0,
    `${ok}/${rows.length} valid${issues.length > 0 ? " · issues: " + JSON.stringify(issues).slice(0, 120) : ""}`
  );
});

// ── 2.4 VaultAuditLog actions distribution ───────────────────────────────
await safe("2.4 VaultAuditLog actions", async () => {
  const rows = await prisma.$queryRaw`
    SELECT action, COUNT(*)::int as count
    FROM "VaultAuditLog"
    GROUP BY action ORDER BY count DESC LIMIT 20
  `;
  if (rows.length === 0) {
    log("2.4 VaultAuditLog actions", true, "no audit logs (SKIP)");
    return;
  }
  // Expected key actions (subset check)
  const actions = new Set(rows.map((r) => r.action));
  const expectedSubset = ["CASE_CREATED", "CASE_VIEWED", "ENTITIES_ADDED"];
  const missing = expectedSubset.filter((a) => !actions.has(a));
  const topActions = rows.slice(0, 5).map((r) => `${r.action}(${r.count})`).join(", ");
  log(
    "2.4 VaultAuditLog actions",
    missing.length === 0 || rows.length < 3,
    `top: ${topActions}${missing.length > 0 ? " · missing: " + missing.join(",") : ""}`
  );

  // Check metadata does not contain message content (sample)
  const sampleMeta = await prisma.$queryRaw`
    SELECT metadata FROM "VaultAuditLog"
    WHERE action IN ('ASSISTANT_QUERY', 'AI_SUMMARY_GENERATED')
    LIMIT 5
  `;
  let metaLeak = false;
  let metaBadDetail = "";
  for (const row of sampleMeta) {
    const meta = row.metadata;
    if (!meta) continue;
    const str = JSON.stringify(meta).toLowerCase();
    if (str.includes("contentenc") || str.includes("message") || /\b(messages|text|content)\s*:/.test(str)) {
      metaLeak = true;
      metaBadDetail = str.slice(0, 120);
      break;
    }
  }
  log(
    "2.4b VaultAuditLog no message content in metadata",
    !metaLeak,
    metaLeak ? `leak: ${metaBadDetail}` : `${sampleMeta.length} AI audit rows checked, clean`
  );
});

// ── 2.5 VaultWorkspace ───────────────────────────────────────────────────
await safe("2.5 VaultWorkspace config", async () => {
  const rows = await prisma.$queryRaw`
    SELECT id, "encMode", LENGTH("kdfSalt") as salt_len,
      "assistantTokensUsed", "assistantTokensLimit"
    FROM "VaultWorkspace" LIMIT 5
  `;
  if (rows.length === 0) {
    log("2.5 VaultWorkspace config", true, "no workspaces (SKIP)");
    return;
  }
  let ok = 0;
  let bad = [];
  for (const r of rows) {
    const mode = String(r.encMode || "");
    const saltLen = Number(r.salt_len);
    if (mode === "CLIENT_SIDE_AES256GCM" && saltLen === 32) ok++;
    else bad.push({ id: r.id, mode, saltLen });
  }
  log(
    "2.5 VaultWorkspace config",
    bad.length === 0,
    `${ok}/${rows.length} valid${bad.length > 0 ? " · bad: " + JSON.stringify(bad).slice(0, 120) : ""}`
  );
});

// ── 2.6 VaultCaseShare safety ────────────────────────────────────────────
await safe("2.6 VaultCaseShare snapshot safety", async () => {
  const rows = await prisma.$queryRaw`
    SELECT id, LENGTH(token) as token_len, "expiresAt",
      "titleSnapshot", "entitySnapshot", "hypothesisSnapshot"
    FROM "VaultCaseShare" LIMIT 10
  `;
  if (rows.length === 0) {
    log("2.6 VaultCaseShare snapshot safety", true, "no shares (SKIP)");
    return;
  }
  let ok = 0;
  let issues = [];
  for (const r of rows) {
    const tlen = Number(r.token_len);
    const tokOk = tlen === 64;
    // Check JSON snapshots for forbidden keys
    const entityStr = JSON.stringify(r.entitySnapshot ?? []);
    const hypStr = JSON.stringify(r.hypothesisSnapshot ?? []);
    const hasForbidden = /[A-Za-z]Enc["']\s*:/.test(entityStr + hypStr) || /[A-Za-z]Iv["']\s*:/.test(entityStr + hypStr);
    if (tokOk && !hasForbidden) ok++;
    else issues.push({ id: r.id, tokenLen: tlen, forbidden: hasForbidden });
  }
  log(
    "2.6 VaultCaseShare snapshot safety",
    issues.length === 0,
    `${ok}/${rows.length} valid${issues.length > 0 ? " · issues: " + JSON.stringify(issues).slice(0, 120) : ""}`
  );
});

// ── Write JSON blob for report builder ───────────────────────────────────
console.log("\n__JSON__\n" + JSON.stringify(results));
await prisma.$disconnect();
