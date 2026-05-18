# AUDIT PRE-OUTREACH — INTERLIGENS

**Date** : 2026-05-08
**Branche** : `main` (HEAD `f66dc55` — *feat: wallet scan EVM uses Alchemy getTokenBalances*)
**Build prod** : `pnpm build` — exit 0 ✓
**Typecheck** : `npx tsc --noEmit` — exit 0 ✓
**Portée** : audit seulement, aucune correction appliquée. Périmètre = surfaces que verra un destinataire d'outreach (BA-XX investigateur / journaliste / investisseur sous NDA), depuis `/access` jusqu'aux pages KOL publiques et au PDF Police Annex.

---

## 🔴 CRITIQUE — à traiter AVANT envoi

### 1. Cyan `#00E5FF` rendu dans l'app principale (4 surfaces)

Règle système (`src/CLAUDE.md:17`) : *« Zéro cyan (#00E5FF interdit dans l'app principale) »*. Le PDF MM est exempté. Tout le reste ne l'est pas.

Surfaces concernées, toutes derrière le gating beta donc **visibles au destinataire d'outreach** :

| Fichier | Ligne | Usage | Visible où |
|---|---|---|---|
| `src/components/LaundryTrailCard.tsx` | 29 | `BRIDGE: '#00E5FF'` (signal color) | `/en/kol/[handle]` (l. 464), `/fr/kol/[handle]` (l. 469) — **toutes les pages KOL avec un signal BRIDGE** |
| `src/app/en/investigator/page.tsx` | 10 + ~13 occurrences | Couleur principale d'éléments d'UI : badges, hovers, liens | Toute la page `/en/investigator` |
| `src/app/en/investigator/login/page.tsx` | 8 | Couleur d'UI | `/en/investigator/login` |
| `src/app/history/page.tsx` | 9, 202, 205, 206 | Badge "résultats" | `/history` (page lookup historique) |
| `src/lib/pdf/kol/templateKol.ts` | 222 | `BRIDGE: '#00E5FF'` dans le PDF KOL | **Tout PDF KOL généré** (export deliverable) |

`LaundryTrailCard` et `templateKol.ts` sont les plus chauds : un destinataire qui consulte un dossier KOL ou télécharge le PDF tombera dessus. Aux yeux d'un investigateur sérieux, la couleur cassée de la charte annule la crédibilité visuelle vendue par la Police Annex en parallèle.

**Action minimale** : remplacer `#00E5FF` par `#FF6B00` (ou un blanc-gris pour BRIDGE si on veut conserver une distinction visuelle des signaux).

> Note : `src/lib/mm/reporting/templateMm.ts:110` (`ACCENT_CYAN`) et `src/lib/watcher/__tests__/campaignClusterer.test.ts:331` sont OK — assertions PDF-only et test garde-fou. À conserver tels quels.

### 2. Welcome email — silencieux si `RESEND_API_KEY` manque

`src/lib/email/betaWelcome.ts:252-256` :

```ts
const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.warn("[betaWelcome] RESEND_API_KEY missing — email skipped");
  return { delivered: false, skipped: "no_api_key" };
}
```

Le caller (`src/app/api/beta/auth/login/route.ts:80-90`) est en fire-and-forget : aucun signal côté UI ne dit que l'email a sauté. Le destinataire valide son NDA, est redirigé vers `/en/demo`, ne reçoit jamais rien — et il n'y a aucune trace serveur autre qu'un `console.warn` perdu dans les logs Vercel.

Risque outreach : on envoie un code BA-XX par email manuel, l'investigateur l'utilise, attend "la confirmation", elle n'arrive jamais.

**Action** :
1. Vérifier en prod que `RESEND_API_KEY` ET `BETA_FROM_EMAIL` sont posés sur Vercel (rappel CLAUDE.md : `vercel env pull` n'inclut pas `ADMIN_TOKEN` — vérifier directement dans l'UI Vercel).
2. Tester le flow end-to-end avec un compte test avant le premier envoi réel.

---

## 🟠 IMPORTANT — à reprendre rapidement

### 3. Welcome email CTA → `https://app.interligens.com` (mismatch d'attente)

`src/lib/email/betaWelcome.ts:173` : le bouton "Open your workspace →" pointe vers `https://app.interligens.com` (racine). Or :
- Le redirect post-NDA va vers `/en/demo` (commit `0f514db`, 2026-05-XX) — démo investisseur, pas la "workspace".
- La vraie workspace investigateur est `/investigators/box` (rendu dynamique, derrière la session).

Conséquence : le destinataire clique "Open your workspace", arrive sur la racine, qui le renvoie au `/access` s'il a perdu son cookie (autre browser, mobile, ou expiration). Au mieux il refait NDA + code. Au pire il pense "c'est cassé".

**Actions** au choix :
- (a) Renommer le CTA en "Open the platform →" et garder la racine.
- (b) Pointer le CTA explicitement vers `/en/demo` (ou `/investigators/box` selon le profil destinataire).
- (c) Différencier deux templates : "investor demo" vs "investigator workspace".

### 4. Welcome email BCC → `admin@interligens.com`

`src/lib/email/betaWelcome.ts:272` : tout email de bienvenue est BCC à `admin@interligens.com`. C'est utile pour le suivi opérationnel mais à confirmer côté privacy si l'envoi est fait à un journaliste / investigateur externe / autorité — leur adresse personnelle se retrouve archivée chez Resend + dans la boîte admin sans qu'ils en soient informés. Le NDA accepté à l'étape précédente couvre la plateforme, pas explicitement ce BCC.

**Action** : décider si on conserve le BCC. Si oui, ajouter une mention dans la NDA ou dans le footer email ("This confirmation was copied to our operations team").

### 5. Naming smell — `CYAN = "#FF6B00"` (deux pages)

`src/app/access/page.tsx:7` et `src/app/access/nda/page.tsx:9` :

```ts
const CYAN = "#FF6B00";
```

Visuellement OK (la couleur rendue est l'orange brand). Mais variable nommée CYAN dans une codebase où le cyan est explicitement interdit ailleurs → piège pour le prochain qui touchera ces fichiers. Trivial à corriger : renommer en `ACCENT2` ou `ACCENT_LIGHT`.

### 6. KOL profile URL — domaine incohérent

`src/app/api/v1/kol/route.ts:80` : `profileUrl: \`https://interligens.com/en/kol/${p.handle}\`` — sans `app.`. Ailleurs, le canonical est `https://app.interligens.com` (`robots.ts:10`, `sitemap.ts:10`, `scan/[chain]/[address]/page.tsx`). Vérifier que `interligens.com` redirige bien vers `app.interligens.com` côté DNS, sinon les profileUrl sortis par `/api/v1/kol` (utilisés par les partenaires) cassent.

---

## 🟢 OK — vérifié, pas d'action

### 7. TigerScore — règles intelligence en place

`src/lib/intelligence/scorer.ts` :
- Hard-cap intelligence delta à `baseScore * 0.20` (l. 107) ✓
- OFAC / AMF / FCA stack, dedup goplus / scamsniffer / forta (winner max IMS) ✓
- Floor 15 si SANCTION active (l. 117-118) ✓
- Ceiling 72 si IMS > 20 ET ICS > 0.40 (cf. test `scorer.test.ts`) ✓

Conforme à CLAUDE.md.

### 8. PERSON-type retail-visibility

`src/app/api/admin/intelligence/safety/route.ts:50` :

```ts
if (entity.type === "PERSON" && body.displaySafety === "RETAIL_SAFE") {
  return ... { error: "PERSON-type entities cannot be set to RETAIL_SAFE" } ...
}
```

Garde-fou serveur en place. Conforme à CLAUDE.md.

### 9. Police Annex PDF (`src/lib/vault/iocExportPdf.ts`)

Audit visuel + structurel :
- Page A4 portrait, marges 25/20/28/20mm, en-tête + pied fixés via `position:fixed` ✓
- Fond blanc, accent `#FF6B00` (eyebrow, bordures cards) — **aucun #00E5FF** ✓
- Bandeau "LEGAL CAUTION" + section Methodology ✓
- Hash SHA-256 du set d'IOCs imprimé pour intégrité ✓
- Pied : *"Investigative material — Not a legal determination — Not financial advice"* sur chaque page ✓
- Tables IOCs + snapshots avec badge `pub-publishable / pub-shareable / pub-private / pub-redacted` ✓
- Filtre "private excluded" tracé (count) ✓

Court-grade. Bon pour outreach + pour archive police.

### 10. Beta access flow — sécurité

`src/app/api/beta/auth/login/route.ts` :
- Rate limit IP : 5 tentatives / 5 minutes (l. 14-18) ✓
- NDA acceptation explicite, fail-closed (l. 51-54) ✓
- Code minimum 4 chars + délai uniforme 200-300ms anti-timing (l. 65-67) ✓
- Audit log (`nda_accepted` event, version `beta-v1`, l. 71-77) ✓
- Hash IP via `hashIP()`, jamais l'IP brute (l. 30, 76) ✓

Solide.

### 11. Middleware — admin / beta gating

`src/middleware.ts` :
- Admin pages : cookie `admin_session` obligatoire en prod, redirect `/admin/login` (l. 118-124) ✓
- Admin APIs : cookie OU Basic Auth, le route handler peut layer `requireAdminApi` au-dessus (l. 126-133) ✓
- SEC-003 : `/[locale]/admin/...` aussi gardé (regex l. 90-92) ✓
- Beta gating fail-closed : tout chemin non exempté → `/access` si pas de cookie (l. 158-165) ✓
- Fix Cloudflare 307 cache pour assets statiques (l. 60-66) ✓

### 12. Build + typecheck

```
$ npx tsc --noEmit       → exit 0 (clean)
$ pnpm build             → exit 0 (pages générées, middleware compilé)
```

Aucun nouveau warning par rapport à `POST_FREEZE_POLISH_REPORT.md` (2026-05-01).

---

## Checklist pré-envoi (à cocher avant le premier email)

- [ ] **§1** — `#00E5FF` purgé de `LaundryTrailCard.tsx`, `templateKol.ts`, `/en/investigator/*`, `/history` *(ou décision documentée d'exemption)*
- [ ] **§2** — `RESEND_API_KEY` + `BETA_FROM_EMAIL` confirmés présents dans Vercel UI (prod)
- [ ] **§2** — Test end-to-end : créer une access code via `seedAccess.ts create "BA-TEST"`, le consommer depuis `/access/nda` avec un email perso, vérifier réception + contenu
- [ ] **§3** — CTA welcome email aligné avec le redirect réel (`/en/demo` ou clarifié dans le copy)
- [ ] **§4** — Décision sur le BCC `admin@interligens.com` (conserver / retirer / mentionner dans NDA)
- [ ] **§6** — `interligens.com` redirige bien vers `app.interligens.com` (test `curl -I`)
- [ ] Tag git posé sur le commit d'outreach (ex. `outreach-2026-05`) pour pouvoir reproduire l'état exact si question

---

## Synthèse

| Catégorie               | État | Note |
|-------------------------|------|------|
| Build prod              | ✓    | exit 0 |
| Typecheck               | ✓    | exit 0 |
| Beta access auth flow   | ✓    | rate-limit + NDA + audit + hash IP |
| Welcome email pipeline  | ⚠    | silencieux si pas de clé Resend, CTA flou |
| Police Annex PDF        | ✓    | court-grade, hash SHA-256, no cyan |
| TigerScore (cap 0.20)   | ✓    | conforme CLAUDE.md |
| PERSON retail-safe gate | ✓    | bloqué côté API admin |
| Design system (no cyan) | ✗    | 4 surfaces app + 1 PDF KOL violent la règle |
| Admin / middleware      | ✓    | cookie/basic, fail-closed, SEC-003 OK |
| KOL filter              | ✓    | `PUBLIC_KOL_FILTER` appliqué sur `/api/v1/kol` |

### Recommandation

**Bloquant pour l'outreach** : §1 (cyan visible sur les pages KOL et dans le PDF KOL) et §2 (welcome email peut sauter sans alerte).
**Non-bloquant mais à corriger sous 48h** : §3, §4, §6.

Le reste — sécurité, conformité légale, intégrité PDF, scoring — est en état d'envoi.
