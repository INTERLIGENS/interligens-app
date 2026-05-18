// src/lib/digest/emailTemplate.ts
import type { DigestData } from "./generator";

function formatUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function generateDigestHtml(data: DigestData, lang: "en" | "fr"): string {
  const isFr = lang === "fr";

  const t = {
    title:         isFr ? "INTELLIGENCE DIGEST HEBDOMADAIRE" : "WEEKLY INTELLIGENCE DIGEST",
    subtitle:      isFr ? `Semaine du ${formatDate(data.week_start)}` : `Week of ${formatDate(data.week_start)}`,
    newThreats:    isFr ? "NOUVELLES MENACES" : "NEW THREATS",
    newCasefiles:  isFr ? "NOUVEAUX CASEFILES" : "NEW CASEFILES",
    byNumbers:     isFr ? "CHIFFRES DE LA SEMAINE" : "BY THE NUMBERS",
    proceeds:      isFr ? "Proceeds tracés" : "Tracked proceeds",
    kols:          isFr ? "Profils KOL flaggés" : "KOL profiles flagged",
    casefiles:     isFr ? "Casefiles publiés" : "Casefiles published",
    noThreats:     isFr ? "Aucun nouveau profil cette semaine." : "No new profiles this week.",
    noCasefiles:   isFr ? "Aucun casefile cette semaine." : "No new casefiles this week.",
    unsubscribe:   isFr ? "Se désabonner" : "Unsubscribe",
    footer:        isFr ? "Vous recevez cet email car vous êtes bêta testeur INTERLIGENS." : "You receive this email as an INTERLIGENS beta tester.",
    ctaLabel:      isFr ? "Ouvrir l'app →" : "Open app →",
  };

  const kolRows = data.new_kols_flagged.length > 0
    ? data.new_kols_flagged.map((k) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #1a1a1a;font-family:monospace;font-size:12px">@${k.handle}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #1a1a1a;color:${k.tier === "RED" ? "#FF3B5C" : "#FFB800"};font-size:12px;font-family:monospace">${k.tier}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #1a1a1a;font-size:12px;font-family:monospace">${k.rugCount > 0 ? `${k.rugCount} rug${k.rugCount > 1 ? "s" : ""}` : "—"}</td>
      </tr>`).join("")
    : `<tr><td colspan="3" style="padding:8px;color:#6b7280;font-size:12px;font-family:monospace">${t.noThreats}</td></tr>`;

  const casefileRows = data.new_casefiles.length > 0
    ? data.new_casefiles.map((c) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #1a1a1a;font-family:monospace;font-size:12px">${c.title}</td>
      </tr>`).join("")
    : `<tr><td style="padding:8px;color:#6b7280;font-size:12px;font-family:monospace">${t.noCasefiles}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title}</title>
</head>
<body style="margin:0;padding:0;background:#000000;color:#ffffff;font-family:monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;min-height:100vh">
    <tr><td align="center" style="padding:32px 16px">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

        <!-- HEADER -->
        <tr>
          <td style="padding:0 0 24px">
            <p style="margin:0;font-size:10px;letter-spacing:0.2em;color:#FF6B00;font-weight:900;text-transform:uppercase">🐯 INTERLIGENS</p>
            <h1 style="margin:8px 0 4px;font-size:18px;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;color:#ffffff">${t.title}</h1>
            <p style="margin:0;font-size:11px;color:#6b7280;letter-spacing:0.1em">${t.subtitle}</p>
            <p style="margin:12px 0 0;font-size:13px;color:#FF6B00">${data.top_stat}</p>
          </td>
        </tr>

        <!-- DIVIDER -->
        <tr><td style="height:1px;background:#1a1a1a;margin-bottom:24px"></td></tr>

        <!-- NEW THREATS -->
        <tr>
          <td style="padding:24px 0 16px">
            <p style="margin:0 0 12px;font-size:10px;letter-spacing:0.2em;font-weight:900;text-transform:uppercase;color:#FF6B00">${t.newThreats}</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <thead>
                <tr style="border-bottom:1px solid #333">
                  <th style="text-align:left;padding:4px 8px;font-size:10px;color:#6b7280;font-weight:400;letter-spacing:0.1em;text-transform:uppercase">HANDLE</th>
                  <th style="text-align:left;padding:4px 8px;font-size:10px;color:#6b7280;font-weight:400;letter-spacing:0.1em;text-transform:uppercase">TIER</th>
                  <th style="text-align:left;padding:4px 8px;font-size:10px;color:#6b7280;font-weight:400;letter-spacing:0.1em;text-transform:uppercase">RUGS</th>
                </tr>
              </thead>
              <tbody>${kolRows}</tbody>
            </table>
          </td>
        </tr>

        <!-- NEW CASEFILES -->
        <tr>
          <td style="padding:0 0 16px">
            <p style="margin:0 0 12px;font-size:10px;letter-spacing:0.2em;font-weight:900;text-transform:uppercase;color:#FF6B00">${t.newCasefiles}</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tbody>${casefileRows}</tbody>
            </table>
          </td>
        </tr>

        <!-- BY THE NUMBERS -->
        <tr>
          <td style="padding:16px 0;border-top:1px solid #1a1a1a;border-bottom:1px solid #1a1a1a">
            <p style="margin:0 0 12px;font-size:10px;letter-spacing:0.2em;font-weight:900;text-transform:uppercase;color:#FF6B00">${t.byNumbers}</p>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:4px 16px 4px 0;font-size:11px;color:#6b7280">${t.proceeds}</td>
                <td style="padding:4px 0;font-size:14px;font-weight:900;color:#FF3B5C">${formatUsd(data.total_proceeds_usd)}</td>
              </tr>
              <tr>
                <td style="padding:4px 16px 4px 0;font-size:11px;color:#6b7280">${t.kols}</td>
                <td style="padding:4px 0;font-size:14px;font-weight:900">${data.new_kols_flagged.length}</td>
              </tr>
              <tr>
                <td style="padding:4px 16px 4px 0;font-size:11px;color:#6b7280">${t.casefiles}</td>
                <td style="padding:4px 0;font-size:14px;font-weight:900">${data.new_casefiles.length}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:24px 0">
            <a href="https://app.interligens.com" style="display:inline-block;background:#FF6B00;color:#000;font-weight:900;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;padding:10px 20px;text-decoration:none">${t.ctaLabel}</a>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="padding:16px 0;border-top:1px solid #1a1a1a">
            <p style="margin:0;font-size:10px;color:#6b7280">${t.footer}</p>
            <p style="margin:4px 0 0;font-size:10px"><a href="https://app.interligens.com" style="color:#6b7280">${t.unsubscribe}</a></p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
