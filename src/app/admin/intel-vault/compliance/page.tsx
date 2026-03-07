// src/app/admin/intel-vault/compliance/page.tsx
import { ENV_KEYS } from "@/lib/vault/complianceEnvKeys";

export default function CompliancePage() {
  const envStatus = ENV_KEYS.map(k => ({ key: k, present: !!process.env[k] }));

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

  return (
    <main style={{ fontFamily: "monospace", padding: "2rem", maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.4rem", marginBottom: "0.25rem" }}>Intel Vault — Compliance & Policy</h1>
      <p style={{ color: "#888", marginBottom: "2rem", fontSize: "0.85rem" }}>
        Vue interne — aucune adresse n&apos;est exposée sur cette page.
      </p>

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
