// src/app/admin/intel-vault/compliance/page.tsx
import { ENV_KEYS } from "@/lib/vault/complianceEnvKeys";
import { prisma } from "@/lib/prisma";

async function getLegacyUsageCount(): Promise<number> {
  try {
    return await prisma.auditLog.count({
      where: { action: "LEGACY_TOKEN_USED" },
    });
  } catch {
    return -1;
  }
}

export default async function CompliancePage() {
  const envStatus = ENV_KEYS.map(k => ({ key: k, present: !!process.env[k] }));
  const adminTokenPresent = !!process.env.ADMIN_TOKEN;
  const legacyUsageCount = await getLegacyUsageCount();
  const shimDeadline = "15 mars 2026";

  const guarantees = [
    { label: "Provenance obligatoire", detail: "sourceName + sourceUrl stockés sur chaque label" },
    { label: "Base non consultable", detail: "Aucun endpoint ne liste les adresses en mode browse" },
    { label: "Admin-only", detail: "Toutes les routes admin exigent x-admin-token (checkAuth)" },
    { label: "Export admin-only", detail: "Guard max rows (EXPORT_MAX_ROWS) + entityName exclu par défaut (ALLOW_ENTITY_EXPORT)" },
    { label: "Quarantine engine", detail: "5 règles automatiques : license_missing, mixed_chains, invalid_ratio, weak_evidence, source_paused" },
    { label: "Anti-énumération adaptive", detail: "Fingerprint IP+UA, throttle après 20 matchs / 5 min, cooldown 10 min" },
    { label: "Audit logs hashés", detail: "HMAC-SHA256 sur chaque entrée AuditLog via VAULT_AUDIT_SALT" },
    { label: "Rollback par batch", detail: "isActive=false sur tous les labels du batch + rebuild cache + AuditLog BATCH_ROLLBACK" },
    { label: "Approve chunké", detail: "Traitement par chunks (APPROVE_CHUNK_SIZE) — pas de timeout serverless" },
  ];

  const quickOps = [
    { label: "Health check", cmd: "curl https://app.interligens.com/api/health" },
    { label: "Gate admin (attendu: 401)", cmd: "curl -I https://app.interligens.com/api/admin/intel-vault/batches" },
    { label: "Appel admin authentifié", cmd: 'curl -H "x-admin-token: <ADMIN_TOKEN>" https://app.interligens.com/api/admin/intel-vault/batches' },
    { label: "Smoke test scan Forta", cmd: "curl https://app.interligens.com/api/scan/eth?address=0x000000000532b45f47779fce440748893b257865" },
  ];

  return (
    <main style={{ fontFamily: "monospace", padding: "2rem", maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Intel Vault — Compliance & Policy</h1>
      <p style={{ color: "#888", marginBottom: "2rem", fontSize: "0.85rem" }}>
        Vue interne — aucune adresse n&apos;est exposée sur cette page.
      </p>

      {/* ── ADMIN API AUTH ── */}
      <section style={{ marginBottom: "2rem", border: "1px solid #333", borderRadius: 8, padding: "1.25rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "1rem", color: "#f97316" }}>
          Admin API Auth
        </h2>

        {!adminTokenPresent && (
          <div style={{ background: "#3b0000", border: "1px solid #ef4444", borderRadius: 6, padding: "0.75rem", marginBottom: "1rem", color: "#fca5a5", fontSize: "0.85rem" }}>
            ⚠ ADMIN_TOKEN manquant en production — les routes /api/admin/* répondront 500.
            Ajouter dans Vercel → Settings → Environment Variables.
          </div>
        )}

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", marginBottom: "1rem" }}>
          <tbody>
            <tr style={{ borderBottom: "1px solid #222" }}>
              <td style={{ padding: "0.4rem 0", color: "#e2e8f0" }}>ADMIN_TOKEN</td>
              <td style={{ color: adminTokenPresent ? "#22c55e" : "#f87171", fontWeight: "bold" }}>
                {adminTokenPresent ? "✓ present" : "✗ missing"}
              </td>
              <td style={{ color: "#888", fontSize: "0.8rem" }}>Header: x-admin-token</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── QUICK OPS ── */}
      <section style={{ marginBottom: "2rem", border: "1px solid #333", borderRadius: 8, padding: "1.25rem" }}>
        <h2 style={{ fontSize: "1rem", marginBottom: "1rem", color: "#f97316" }}>
          Quick Ops — Commandes de vérification
        </h2>
        <p style={{ color: "#888", fontSize: "0.8rem", marginBottom: "1rem" }}>
          Remplacer &lt;ADMIN_TOKEN&gt; par la vraie valeur. Ne jamais partager ces commandes avec le token réel.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {quickOps.map(op => (
            <div key={op.label} style={{ background: "#0d1117", borderRadius: 6, padding: "0.75rem" }}>
              <div style={{ color: "#888", fontSize: "0.75rem", marginBottom: "0.35rem" }}>{op.label}</div>
              <code style={{ color: "#06b6d4", fontSize: "0.8rem", wordBreak: "break-all" }}>{op.cmd}</code>
            </div>
          ))}
        </div>
      </section>

      {/* ── GARANTIES ── */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1rem", borderBottom: "1px solid #333", paddingBottom: "0.4rem", marginBottom: "1rem" }}>
          Garanties opérationnelles
        </h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {guarantees.map(g => (
            <li key={g.label} style={{ display: "flex", gap: "0.75rem", marginBottom: "0.6rem", alignItems: "flex-start" }}>
              <span style={{ color: "#22c55e", flexShrink: 0 }}>✓</span>
              <span>
                <strong>{g.label}</strong>
                <span style={{ color: "#aaa", marginLeft: "0.5rem", fontSize: "0.85rem" }}>{g.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── ENV VARS ── */}
      <section>
        <h2 style={{ fontSize: "1rem", borderBottom: "1px solid #333", paddingBottom: "0.4rem", marginBottom: "1rem" }}>
          Variables d&apos;environnement
        </h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#888" }}>
              <th style={{ paddingBottom: "0.4rem" }}>Clé</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {envStatus.map(e => (
              <tr key={e.key} style={{ borderTop: "1px solid #222" }}>
                <td style={{ padding: "0.35rem 0", color: "#e2e8f0" }}>{e.key}</td>
                <td style={{ color: e.present ? "#22c55e" : "#f87171" }}>
                  {e.present ? "present" : "missing"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
