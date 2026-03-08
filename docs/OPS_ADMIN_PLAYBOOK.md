# INTERLIGENS — Ops Admin Playbook

> Document interne — ne pas partager publiquement.  
> Dernière mise à jour : 2026-03-08  
> Audience : opérateurs non-dev

---

## 1. Où aller

| Page | URL | Usage |
|---|---|---|
| Intel Vault (import) | `/admin/intel-vault` | Importer une source |
| Quarantaine / Batches | `/admin/intel-vault/batches` | Approuver / rollback |
| Sources | `/admin/intel-vault/sources` | Gérer les sources enregistrées |
| Submissions | `/admin/intel-vault/submissions` | Traiter les soumissions communautaires |
| Compliance | `/admin/intel-vault/compliance` | Vérifier l'état de l'env + auth |
| Santé API | `/api/health` | Vérifier que l'app répond |

---

## 2. Importer une source

1. Aller sur `/admin/intel-vault`
2. Choisir le type de source :
   - **URL** → coller une URL raw GitHub (ex: `https://raw.githubusercontent.com/...`)
   - **Fichier CSV/JSON** → uploader un fichier local normalisé
   - **Texte / Thread** → coller du texte brut contenant des adresses
   - **Adresse unique** → saisir une adresse manuellement
3. Remplir les métadonnées :
   - **Source name** : identifiant court (ex: `forta_network`)
   - **Label** : nom du dataset (ex: `forta_phishing_scams`)
   - **Label type** : `phishing` / `scam` / `exploiter` / `incident_related` / `other`
   - **Visibilité** : toujours `internal_only` sauf décision contraire
4. Cliquer **Analyser & Prévisualiser**
5. Vérifier l'aperçu (10 premières lignes, nombre d'adresses, distribution chains)
6. Cliquer **Approuver & Publier**

### Formats supportés

| Format | Méthode | Notes |
|---|---|---|
| CSV raw GitHub | URL | Utiliser l'URL `raw.githubusercontent.com` |
| JSON raw GitHub | URL | Même principe — vérifier que c'est du raw |
| Google Sheets | URL | OK si le sheet est accessible publiquement |
| GitHub blob | URL | ⚠️ Convertir `/blob/` en `/raw/` ou utiliser `raw.githubusercontent.com` |
| Upload CSV/JSON | Fichier | Colonnes attendues : `address,chain,type,confidence,evidence` |
| Upload PDF | Fichier | Extraction automatique des adresses |
| Paste texte/thread | Texte | Coller un thread X, markdown, ou texte libre |
| Portail sans export | ❌ | Non supporté — chercher un export officiel |
| PDF par URL | ❌ | Non supporté — uploader le PDF directement |

---

## 3. Approuver un batch

1. Aller sur `/admin/intel-vault/batches`
2. Les batches **PENDING** attendent une action
3. Vérifier : nombre d'adresses, distribution chains, warnings éventuels
4. **Approuver** → job chunké, progress en temps réel
5. **Rollback** → si import toxique : désactive toutes les adresses du batch + rebuild cache

---

## 4. Traiter une submission communautaire

1. Aller sur `/admin/intel-vault/submissions`
2. Lire le détail de chaque soumission
3. **Approuver** → crée un label Intel Vault avec `source = community`
4. **Rejeter** → archive sans créer de label

---

## 5. Vérifications prod

### Commandes de vérification (sans secrets)
```bash
# Santé générale
curl https://app.interligens.com/api/health

# Vérifier que le gate admin répond bien 401 sans token
curl -I https://app.interligens.com/api/admin/intel-vault/batches
# → attendu : 401 Unauthorized

# Vérifier avec token (remplacer <ADMIN_TOKEN> par la vraie valeur)
curl -H "x-admin-token: <ADMIN_TOKEN>" \
  https://app.interligens.com/api/admin/intel-vault/batches
# → attendu : 200 + JSON

# Test smoke : scan adresse Forta connue
curl "https://app.interligens.com/api/scan/eth?address=0x000000000532b45f47779fce440748893b257865"
# → attendu : badge Intel Vault présent dans la réponse
```

---

## 6. Règles d'authentification

| Contexte | Méthode |
|---|---|
| Interface admin (`/admin/*`) | Basic Auth (navigateur demande user/pass) |
| API admin (`/api/admin/*`) | Header `x-admin-token: <ADMIN_TOKEN>` |
| API publique (`/api/scan/*`) | Header `x-interligens-api-token: <TOKEN>` |

### Variables d'environnement requises en prod

| Variable | Usage |
|---|---|
| `ADMIN_TOKEN` | Protège toutes les routes `/api/admin/*` |
| `ADMIN_BASIC_USER` | Basic Auth UI — username |
| `ADMIN_BASIC_PASS` | Basic Auth UI — password |
| `DATABASE_URL` | Base de données Prisma |
| `VAULT_AUDIT_SALT` | HMAC audit logs |

---

## 7. Rotation / suppression du token legacy

> **Date cible : 15 mars 2026**

Le header `x-interligens-api-token` est **déprécié**. Il sera supprimé le 15 mars 2026.

### Avant de supprimer

1. Aller sur `/admin/intel-vault/compliance`
2. Vérifier la section **Auth** → "Legacy token usages" doit être **0** depuis plusieurs jours
3. Si des usages sont encore détectés → identifier la source et migrer vers `x-admin-token`

### Étapes de suppression (Vercel UI)

1. Aller sur [vercel.com/dashboard](https://vercel.com/dashboard)
2. Sélectionner le projet **interligens-web**
3. **Settings → Environment Variables**
4. Trouver `INTERLIGENS_API_TOKEN` → cliquer **Delete**
5. ⚠️ Cocher **Production** uniquement
6. Cliquer **Save**
7. Aller sur **Deployments** → **Redeploy** le dernier déploiement prod
8. Vérifier : `curl https://app.interligens.com/api/health` → 200
9. Vérifier : import URL Forta fonctionne depuis `/admin/intel-vault`

### Rollback si problème

Si quelque chose casse après suppression :
1. Remettre `INTERLIGENS_API_TOKEN` dans Vercel env (même valeur)
2. Redeploy
3. Identifier ce qui utilise encore le legacy header via les AuditLogs

---

## 8. En cas de problème

| Symptôme | Cause probable | Action |
|---|---|---|
| `/admin/*` → 401 | Basic Auth incorrect | Vérifier `ADMIN_BASIC_USER` + `ADMIN_BASIC_PASS` |
| `/api/admin/*` → 401 | Header `x-admin-token` manquant | Ajouter le header |
| `/api/admin/*` → 500 "Admin token missing" | `ADMIN_TOKEN` absent de Vercel env | Ajouter dans Settings → Env Vars |
| Import URL → 0 adresses | Format non reconnu | Uploader un CSV normalisé |
| Import CSV → "pas assez de lignes" | Mauvais format ou JSON uploadé comme CSV | Vérifier colonnes : `address,chain,type,confidence,evidence` |

---

*English summary: This playbook covers how to import threat intel sources, approve batches, handle community submissions, verify production health, and rotate legacy auth tokens. See section 7 for the March 15 legacy token removal steps.*
