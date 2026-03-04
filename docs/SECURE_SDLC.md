# Secure SDLC — INTERLIGENS-WEB
_Ajouté: 2026-03-04_

## Vue d'ensemble

Chaque Pull Request et push sur `main` déclenche automatiquement 4 jobs de sécurité.
Pour merger, **tous doivent être verts**. On configure une seule règle branch protection
sur le job `All Security Gates Passed`.
cat > docs/SECURE_SDLC.md << 'EOF'
# Secure SDLC — INTERLIGENS-WEB
_Ajouté: 2026-03-04_

## Vue d'ensemble

Chaque Pull Request et push sur `main` déclenche automatiquement 4 jobs de sécurité.
Pour merger, **tous doivent être verts**. On configure une seule règle branch protection
sur le job `All Security Gates Passed`.
```
PR / Push
   │
   ├── 🔍 Secret Scanning (Gitleaks)
   ├── 🛡  SAST (Semgrep)
   ├── 📦 Dependency Audit (pnpm audit)
   └── ✅ Quality Gates (lint → typecheck → test → build)
         │
         └── All Security Gates Passed ← Branch protection pointe ici
```

---

## 1. Secret Scanning — Gitleaks

**Quoi :** Scanne tous les commits de la PR pour détecter des clés API, tokens,
mots de passe ou secrets hardcodés (patterns AWS, GitHub, Stripe, etc.).

**Config :** `.gitleaks.toml` à la racine.

**Usage local (avant de pusher) :**
```bash
# Installation
brew install gitleaks

# Scanner le repo complet
gitleaks detect --source . -v

# Scanner seulement les fichiers non commités
gitleaks protect --staged
```

**Faux positifs :** Les adresses wallet (cibles forensic) et les fixtures de test
sont ignorées via l'allowlist dans `.gitleaks.toml`.

---

## 2. SAST — Semgrep

**Quoi :** Analyse statique du code TypeScript/React à la recherche de patterns
vulnérables (OWASP Top Ten, injections, mauvais usages crypto, etc.).

**Règles activées :**
- `p/typescript` — patterns TypeScript dangereux
- `p/react` — XSS, dangerouslySetInnerHTML, etc.
- `p/owasp-top-ten` — injections, auth, exposition de données
- `p/secrets` — secrets dans le code (couche supplémentaire à Gitleaks)

**Usage local :**
```bash
# Installation
pip install semgrep

# Scan complet (même config que CI)
semgrep scan \
  --config p/typescript \
  --config p/react \
  --config p/owasp-top-ten \
  --config p/secrets \
  --exclude 'node_modules/**' \
  --exclude '.next/**' \
  --exclude 'backups/**' \
  .
```

---

## 3. Dependency Audit

**Quoi :** Vérifie les dépendances npm contre la base CVE publique.
Bloque sur les vulnérabilités de niveau `moderate` et supérieur.

**Usage local :**
```bash
pnpm audit --audit-level=moderate

# Pour voir le détail complet
pnpm audit

# Pour tenter une résolution automatique (attention aux breaking changes)
pnpm audit --fix
```

**Politique :** Les vulnérabilités `low` sont tolérées (bruit).
Les `moderate`, `high` et `critical` bloquent le merge.

---

## 4. Quality Gates

Les gates qualité s'exécutent dans l'ordre — chaque étape bloque la suivante.

| Étape | Commande | Bloquant |
|-------|----------|----------|
| Lint | `pnpm lint` | Oui |
| Type check | `pnpm typecheck` | Oui |
| Tests | `pnpm test` | Oui |
| Build | `pnpm build` | Oui |

**État actuel du lint :** 254 erreurs (majoritairement `no-explicit-any`) — voir
`docs/SECURITY_BASELINE.md`. Le job `quality` échouera tant que ces erreurs ne
sont pas résorbées. Plan : typer progressivement les routes API (P1 backlog).

---

## 5. Branch Protection — Configuration GitHub

Aller dans **Settings → Branches → Add rule** sur `main` :
```
☑ Require status checks to pass before merging
  └── Status check: "All Security Gates Passed"

☑ Require branches to be up to date before merging
☑ Do not allow bypassing the above settings
```

Un seul status check à surveiller — le job `all-gates-passed` agrège tout.

---

## 6. Commandes dev quotidiennes
```bash
# Avant chaque commit — vérification rapide secrets
gitleaks protect --staged

# Avant chaque PR — vérification complète locale
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm audit --audit-level=moderate
semgrep scan --config p/typescript --config p/react .

# Mettre à jour les dépendances (hebdomadaire)
pnpm update --interactive
pnpm audit --audit-level=moderate
```

---

## 7. Variables secrètes — où les stocker

| Environnement | Stockage |
|---------------|----------|
| Local dev | `.env.local` (non commité) |
| CI GitHub Actions | Settings → Secrets → Actions |
| Production Vercel | Settings → Environment Variables |

**Règle absolue :** Aucune clé n'apparaît dans le code source, les logs, ou les
messages de commit. Gitleaks vérifie ça automatiquement.

---

_Ce document est mis à jour à chaque modification du pipeline CI._
