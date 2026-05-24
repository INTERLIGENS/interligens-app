---
title: "Manuel opérationnel — Enquêteur externe sous NDA (version allégée)"
authors: ["INTERLIGENS Research"]
version: "1.0"
date: "2026-05-24"
status: "internal-light"
classification: "CONFIDENTIEL — NDA REQUIS"
license: "PROPRIÉTAIRE — DIFFUSION INTERDITE"
audience: ["enquêteur externe sous NDA"]
abstract: "Version allégée du manuel opérationnel destinée à l'enquêteur externe sous NDA. Couvre la prise en main, les surfaces accessibles à l'enquêteur, les workflows d'enquête, le format de remontée de bugs et de feedback, et les bonnes pratiques OPSEC. Ne contient pas les éléments d'architecture interne ni les détails de scoring qui figurent dans la version core."
---

> ⚠️ **Version allégée.** Ce document est une version réduite du manuel opérationnel interne. Il ne contient ni les éléments d'architecture de la plateforme, ni les détails de mécanique du scoring, ni la cartographie complète des surfaces internes. Si vous avez besoin d'un élément qui n'y figure pas, demandez-le par le canal direct convenu — il n'a pas été omis par oubli mais par discipline d'usage.

## 1. Préface

Ce document est confidentiel. Il n'est pas destiné à la publication et n'est pas couvert par la licence Creative Commons appliquée au corpus pédagogique public. Vous le recevez parce que vous êtes lié par un accord de confidentialité actif avec l'éditeur de la beta, et parce que votre rôle d'enquêteur exige un cadre opérationnel qu'un guide utilisateur générique ne couvrirait pas.

Le manuel s'adresse à un seul lecteur à la fois. Vous ne devez ni transmettre ce document, ni en reproduire d'extraits, ni l'évoquer publiquement, ni le citer dans des communications avec des tiers. Si vous quittez le programme, vous êtes tenu d'en supprimer toute copie locale (y compris dans vos sauvegardes, votre dossier de téléchargements, et tout système de prise de notes synchronisé en ligne). Cette consigne s'étend à tout extrait, citation, capture ou reformulation.

Le manuel est versionné. La présente est la version 1.0, datée du 24 mai 2026. Une nouvelle version sera diffusée à chaque évolution significative de la beta, et la version précédente devra alors être supprimée. Lorsque vous recevez une nouvelle version, vérifiez que le numéro et la date du document que vous utilisez correspondent à la version courante diffusée par David Douville ; en cas de doute, demandez confirmation avant d'agir sur la base d'une procédure qui aurait évolué.

Le rappel suivant tient lieu d'engagement de relecture. En manipulant la beta, vous accédez à des dossiers d'enquête en cours, à des identifiants on-chain et off-chain, à des éléments de scoring, et à des contextes dont la divulgation hors cadre serait nuisible aux victimes, aux enquêtes en cours, aux personnes nommées (y compris celles qui pourraient ultérieurement être disculpées), et à la solidité juridique des dossiers eux-mêmes. La confidentialité absolue sur les casefiles non publics, sur les identités observées dans la beta, et sur les méthodes propres à la plateforme n'est pas un objectif à atteindre : c'est une condition de votre participation.

## 2. Accès et authentification

### 2.1 URL et entrée

L'application principale est servie sous le domaine public `app.interligens.com`. Vous l'atteignez par votre navigateur courant. Aucune installation locale n'est requise pour la beta ; vos navigateurs habituels (versions à jour) suffisent.

### 2.2 Procédure de login

Vos identifiants vous ont été remis hors bande, c'est-à-dire par un canal distinct du document. Vous les conservez dans un gestionnaire de mots de passe local et chiffré, jamais en clair dans un courriel, un fichier texte non chiffré, ou un service synchronisé non chiffré côté client. Vous n'utilisez pas la fonction de mémorisation de mot de passe du navigateur sans chiffrement de session de profil utilisateur.

Si la beta vous propose un facteur secondaire d'authentification, vous l'activez. Vous privilégiez une clé matérielle ou une application d'authentification locale plutôt qu'un SMS.

### 2.3 Re-login et perte d'accès

Si votre session expire, vous vous reconnectez par la même procédure. Si vous perdez l'accès — équipement compromis, identifiants oubliés, suspicion d'usage non autorisé — vous contactez David Douville par le canal direct convenu lors de votre onboarding. N'utilisez pas un formulaire de récupération public si la beta en propose un.

En cas de suspicion de compromission (mot de passe possiblement exposé, équipement perdu ou volé), vous notifiez David Douville dans les deux heures. La beta peut être suspendue pour votre compte le temps qu'un nouvel accès soit régénéré.

### 2.4 Durée et hygiène de session

Vous ne laissez pas de session ouverte sur un poste qui n'est pas sous votre garde immédiate. Vous verrouillez votre poste lorsque vous vous absentez, même brièvement. Vous fermez la session de l'application à la fin d'une période de travail, plutôt que de simplement fermer l'onglet.

Vous n'accédez pas à la beta depuis un poste partagé, depuis un cybercafé, ou depuis un équipement professionnel d'une organisation tierce. Si votre poste de travail principal est partagé avec un autre utilisateur (foyer, colocation), vous utilisez un profil utilisateur distinct et vous fermez votre session avant de transférer le poste.

### 2.5 Réseau

Vous évitez les réseaux Wi-Fi publics ou semi-publics pour accéder à la beta. Si vous y êtes contraint, vous utilisez un tunnel chiffré sous votre contrôle.

## 3. Surfaces accessibles à l'enquêteur

Cette section décrit, en liste sobre, ce que vous voyez et ce que vous pouvez en faire. Les descriptions sont fonctionnelles ; elles ne couvrent ni la cartographie interne des surfaces non destinées à l'enquêteur, ni les mécanismes de calcul, dont la divulgation ne servirait pas votre travail.

- **Page d'accueil et scan d'adresse.** Champ de scan où vous entrez une adresse (wallet ou contrat), une empreinte de transaction, ou un identifiant social rattaché. La plateforme couvre plusieurs écosystèmes blockchain ; le détail vous est visible depuis l'application. Le résultat du scan ouvre une vue dépendante du type d'identifiant.

- **Vue wallet ou contrat.** Présente un score synthétique de risque (libellé TigerScore) avec une catégorisation qualitative (faible, modéré, élevé, critique), une liste de signaux observés, et un contexte agrégé (casefiles liés, adresses connexes, fenêtres temporelles d'activité). Le score doit être lu comme un indicateur d'aide à la priorisation, et non comme une explication de sa mécanique interne. Vous ne pouvez pas modifier le score, ajouter un signal, ou requalifier une catégorie depuis l'interface.

- **Vue KOL.** Agrège pour un même opérateur social ses pseudonymes connus, ses adresses on-chain rattachées, un score synthétique, et les casefiles dans lesquels il apparaît. La vue est plus sensible que la vue wallet : son contenu est strictement NDA-gated.

- **Casefiles publiés.** Cinq casefiles publiés à la date de cette version, consultables en mode lecture intégrale depuis votre compte comme depuis le compte public. D'autres casefiles existent dans le périmètre de travail de la plateforme ; vous pourrez en voir mention dans la vue KOL ou wallet sans pouvoir y accéder. Ces casefiles non publics ne doivent jamais être nommés ni décrits, même par allusion, hors de votre canal direct avec David Douville.

- **Investigator Dashboard.** Tableau de bord personnel regroupant vos derniers scans, vos derniers KOL consultés, et les casefiles ouverts récemment. Sert de point de reprise entre deux sessions. Vous pouvez épingler des éléments ; vous ne pouvez pas partager le dashboard ni l'exporter.

- **IOC Export Center.** Export d'un format structuré des indicateurs liés à un casefile publié ou à un scan que vous avez effectué. L'export sert votre dossier d'enquête interne ; il reste couvert par votre NDA et ne doit pas être republié hors du cadre interne. L'export d'éléments issus d'un casefile non public n'est pas autorisé.

- **Evidence Snapshots.** Capture horodatée d'un élément observable dans la plateforme, identifiée par un identifiant interne. Vous les référencez dans vos notes par leur identifiant uniquement, sans extraire le contenu rendu vers un canal externe.

La distinction est binaire : si vous voyez la fonctionnalité dans votre compte et qu'un utilisateur non authentifié ne la verrait pas, le contenu est NDA-gated.

## 4. Workflow type — Recevoir un signalement et démarrer une enquête

Cette section décrit la séquence opérationnelle qu'un signalement standard déclenche. Elle s'articule au playbook public *Checklist d'investigation*, §2 (premiers réflexes) et sections suivantes ; le présent manuel ne le reproduit pas mais en suit la logique en l'instrumentant pour la beta.

### 4.1 Réception du signalement

Le premier contact avec une victime ou un témoin est le moment le plus riche en preuves et le plus volatil. Avant tout usage de la beta, vous appliquez la séquence préservation rappelée dans la *Checklist d'investigation* publique (§2) : horodatage UTC et local, capture du signalement tel quel avec consentement, préservation des URL pleines, collecte des adresses en texte clair, identification explicite de la chaîne pour chaque hash ou adresse, notation du persona présenté à la victime.

La beta n'a pas vocation à remplacer cette étape. Elle intervient ensuite, lorsque vous disposez d'identifiants exploitables.

### 4.2 Premier scan

Vous ouvrez l'application et entrez le premier identifiant exploitable dans le champ de scan. L'ordre conseillé, lorsque plusieurs identifiants sont disponibles, est :

1. L'adresse de wallet suspect en premier.
2. L'adresse du contrat de token concerné, si la fraude porte sur un token.
3. Le pseudonyme social du persona si la beta dispose d'une vue KOL rattachée.

Ce premier scan vous donne un point d'ancrage. Vous notez immédiatement, dans vos notes internes, l'identifiant, le score observé, et un identifiant d'Evidence Snapshot.

### 4.3 Lecture du score et des signaux

Vous lisez le score comme une synthèse, non comme une conclusion. La grille de lecture conseillée :

- Score critique. Signaux concordants documentent un risque significatif. Vous traitez la suite de l'enquête avec l'hypothèse forte que l'adresse est impliquée dans une opération nuisible, sans pour autant la qualifier vous-même.
- Score élevé. Signaux multiples mais pas tous concordants. Vous notez les divergences et orientez les pivots suivants pour les lever.
- Score modéré ou faible avec une victime crédible. Vous traitez la divergence comme un signal en soi : soit la beta n'a pas encore agrégé les signaux pertinents (signalement pour la section 7), soit le persona perçu par la victime ne correspond pas à l'adresse fournie.

Vous lisez les signaux dans l'ordre où la vue les présente. Pour chaque signal, vous notez s'il est on-chain, off-chain, ou issu de l'agrégation de la plateforme. Cette discipline vous protège : un signal d'écosystème pèse moins en preuve indépendante qu'un signal on-chain vérifiable.

### 4.4 Élargissement aux casefiles liés

Si la vue indique des casefiles liés, vous les ouvrez dans l'ordre de proximité affiché. Pour chaque casefile, vous repérez si vous avez accès à la lecture intégrale (casefile publié) ou seulement à la mention (casefile non public). Dans le second cas, vous notez l'existence du lien mais vous ne tentez pas d'en savoir davantage hors de votre canal avec David Douville.

Pour les casefiles publiés liés, vous lisez la synthèse, vous notez les éléments qui croisent votre signalement (adresses partagées, KOL partagés, fenêtres temporelles partagées), et vous capturez un identifiant d'Evidence Snapshot des passages utiles.

### 4.5 Capture des Evidence Snapshots

Vous créez un snapshot pour chaque observation que vous citerez ensuite. Vous conservez les identifiants dans vos notes, jamais le contenu rendu.

Vous ne capturez pas d'écran avec un outil OS-natif sauf pour un usage strictement local (votre dossier d'investigation chiffré, jamais redistribué).

### 4.6 Documentation dans le format interne

Vous documentez l'enquête au format décrit en section 6 ci-dessous. Vous n'inventez pas un format ad hoc ; la cohérence avec le template facilite la lecture et la priorisation des remontées.

### 4.7 Remontée

Vous remontez ce qui est notable :

- Bug observé dans la beta (toujours, et au plus vite).
- Anomalie de score ou de signal qui suggère un problème de couverture.
- Élément de casefile qui semble incomplet ou contradictoire.
- Intuition d'enquête qu'un humain peut creuser et qu'aucun automate ne formulerait spontanément.

Vous ne remontez pas :

- Le résumé exhaustif de chaque scan effectué (l'Investigator Dashboard y suffit).
- Les éléments déjà visibles dans un casefile publié.
- Les hypothèses non étayées qui pourraient nuire à un tiers nommé si elles fuitaient.

La règle de filtrage : remontez ce qui aide à améliorer la beta, à protéger une victime, ou à orienter une enquête. Le reste, vous le gardez dans vos notes locales.

## 5. Workflow type — Explorer un KOL et son écosystème

Ce workflow est plus exploratoire que le précédent et il est aussi plus sensible. Vous l'utilisez lorsqu'un pseudonyme ou un wallet émerge d'un signalement, d'une lecture de presse, ou d'une remontée d'une autre source, et que vous voulez en cartographier la grappe immédiate.

### 5.1 Démarrage

Vous démarrez depuis un handle social ou depuis un wallet. Si vous démarrez d'un handle, vous tentez d'abord la résolution dans la vue KOL ; si la vue n'existe pas, l'opérateur n'est pas (encore) profilé dans la plateforme, et vous travaillez à partir des sources publiques avant de revenir à la beta. Si vous démarrez d'un wallet, vous tentez d'abord la résolution inverse vers un ou plusieurs KOL rattachés.

### 5.2 Lecture de la fiche KOL

La fiche KOL agrège plusieurs éléments : les pseudonymes rattachés, les adresses on-chain associées, le score, les casefiles liés, et la fenêtre temporelle d'activité observée. Vous lisez la fiche dans l'ordre :

- Pseudonymes : combien, sur quelles plateformes, depuis quand. Vous notez la cohérence ou les divergences (changements de pseudonyme alignés sur des fenêtres d'activité).
- Adresses : combien, sur quelles chaînes, et le type d'attachement déclaré.
- Score : avec la même prudence d'interprétation qu'en §4.3. Un score KOL synthétise une trajectoire, pas un acte unique.
- Casefiles liés : avec le même filtre publics/non publics qu'en §4.4.

### 5.3 Identification de la grappe

Si la beta affiche d'autres KOL rattachés à la même grappe, vous notez chacun, le type de lien (co-promotion, transactions croisées, intervention partagée sur un même token), et la robustesse du lien (lien fort = plusieurs vecteurs concordants, lien faible = un seul vecteur).

Vous ne déduisez pas de ces liens une qualification sur les autres KOL de la grappe sans étayer indépendamment. La présence dans une grappe n'établit pas une infraction ; elle documente une co-occurrence dont l'enquête doit ensuite démêler le sens.

### 5.4 Capture et documentation

Vous capturez un identifiant d'Evidence Snapshot pour chaque vue significative. Vous documentez la session selon le format de section 6, en notant explicitement qu'il s'agit d'une session exploratoire (et non d'une réponse à un signalement). Une exploration sans signalement déclencheur doit être notée comme telle ; cela aide à hiérarchiser vos remontées et à comprendre la généalogie de vos hypothèses.

## 6. Format d'investigation interne — Template casefile

Vous documentez chaque session significative dans un fichier Markdown local, suivant le gabarit ci-dessous. Vous ne stockez pas ces fichiers sur un service de synchronisation cloud non chiffré ; vous les conservez en local sur un volume chiffré, et vous transmettez par le canal direct convenu (au choix : courrier chiffré end-to-end ou dépôt dans un espace qui vous aura été indiqué).

Le gabarit :

```markdown
# CASEFILE BÊTA — [titre court anonymisé]

**Date** : YYYY-MM-DD
**Enquêteur** : [pseudonyme NDA]
**Source du signalement** : [type, sans nom de victime]
**Criticité estimée** : faible / moyenne / élevée / critique

## 1. Synthèse (3-5 lignes)
[résumé factuel]

## 2. Éléments observés dans la beta
- Adresse / Token / KOL scanné : [...]
- TigerScore observé : [...]
- Signaux remarquables : [...]
- Casefiles liés observés : [...]

## 3. Hypothèses (jamais d'accusation, jamais d'identité présumée)
[liste]

## 4. Evidence Snapshots capturés
[IDs ou références internes, pas de contenu]

## 5. Limites / incertitudes
[honnêteté méthodologique]

## 6. Remontée
[ce que l'enquêteur souhaite signaler comme bug, anomalie ou intuition à approfondir]
```

Quelques règles d'usage du gabarit :

- Le titre court anonymisé évite toute mention de la victime, du KOL, ou du token. Vous utilisez une étiquette opérationnelle (« Rugpull Q2 — entrée du 17 mai ») plutôt qu'une étiquette identifiante.
- Le pseudonyme NDA est celui convenu lors de votre onboarding ; il vous permet d'apparaître dans les notes internes sans que votre identité réelle y figure.
- La source du signalement est un type (« victime directe », « relais médiatique », « observation propre ») et non une identité.
- Les hypothèses sont formulées sans nommer de personne présumée responsable. Vous écrivez « un acteur correspondant au persona @X aurait pu… » plutôt que « X est… ».
- Les snapshots sont référencés par identifiant interne. Vous ne copiez pas le contenu rendu d'un snapshot dans vos notes ; le but est de pouvoir retrouver l'observation, non de la dupliquer.
- La section 5 (limites) doit être remplie. Une enquête sans incertitudes documentées est suspecte ; la lucidité méthodologique vaut plus qu'une certitude affichée.

## 7. Bugs et feedback — Procédure

### 7.1 Bug report

Un bug report utile contient toujours, au minimum :

- L'URL exacte à laquelle vous étiez (sans la coller publiquement si elle contient un identifiant sensible ; dans ce cas, transmettez-la par le canal direct).
- L'action que vous étiez en train d'effectuer.
- Le résultat attendu.
- Le résultat observé (incluant message d'erreur ou comportement inattendu).
- L'horodatage UTC précis au moment du bug.
- Le navigateur et la version (utile pour les bugs front).
- Une capture d'écran locale conservée chiffrée, jamais redistribuée ; si la capture contient une donnée sensible, vous floutez avant transmission.

### 7.2 Feedback design

Un feedback design est une suggestion sur l'ergonomie, le vocabulaire affiché, la disposition, la navigation. Le format minimal :

- La surface concernée.
- L'élément précis (un bouton, une étiquette, un ordre de tri, un comportement par défaut).
- La raison du feedback (ce qui vous a frotté ou ralenti en usage réel).
- La suggestion (concrète, pas une plainte abstraite).

### 7.3 Feedback méthodologique

C'est le feedback le plus précieux. Il porte sur la qualité de l'output de la beta : un score qui vous paraît mal calibré sur un cas, un signal absent que vous auriez attendu, un signal présent dont vous comprenez mal la source, une catégorisation qualitative qui vous semble inadaptée à ce que vous voyez du dossier. Le format minimal :

- Le contexte (sans révéler la victime, le KOL, ou le token de manière identifiante).
- Le constat (ce que la beta affiche).
- Votre interprétation (ce que vous comprenez après votre propre travail d'OSINT).
- L'écart (en quoi la beta sur-évalue, sous-évalue, ou manque le sujet).
- L'hypothèse (ce qui pourrait expliquer l'écart, et ce qui aiderait à le réduire).

### 7.4 Canal et délai

Vous remontez par le canal direct convenu lors de l'onboarding. Vous ne remontez pas à un email générique de la plateforme, sauf si vous n'avez pas d'autre option. Vous ne remontez pas non plus par les réseaux sociaux, par messagerie publique, ou par tout canal dont vous ne maîtrisez pas la chaîne de transmission.

Le délai indicatif de réponse est de 24 à 48 heures ouvrées pour un signalement standard et de 12 à 24 heures pour un signalement bloquant (impossibilité d'accéder à la beta, suspicion de fuite, élément potentiellement diffamatoire). Pendant la fenêtre du 1er juin 2026 au 27 juillet 2026, David Douville est en déplacement prolongé et le délai de réponse est étendu ; un message d'absence vous précisera, à l'entrée dans cette fenêtre, le canal de relais et le rythme attendu de réponse.

## 8. Bonnes pratiques OPSEC

Cette section pose les règles génériques d'hygiène et de discrétion. Elle ne décrit pas la mécanique interne ; elle décrit ce que vous devez faire et ne pas faire.

### 8.1 Réseau

Vous n'accédez pas à la beta depuis un réseau public sans tunnel chiffré sous votre contrôle. Vous évitez les réseaux dont vous ignorez la politique de logs.

### 8.2 Captures et redistribution

Vous ne prenez pas de capture d'écran pour des tiers. Vous ne partagez pas une capture, fût-elle floutée, sur un canal public. Vous ne décrivez pas, en public ou en demi-privé, ce que vous avez vu dans la beta. La règle est binaire et n'admet pas d'exception « pour une seule personne de confiance » : un seul partage hors NDA suffit à compromettre votre rôle et l'enquête.

### 8.3 Existence des casefiles non publics

Vous ne confirmez ni ne démentez l'existence d'un casefile non public à un tiers. Vous ne répondez pas par silence éloquent, par sourire entendu, ou par formule ambiguë. La réponse correcte est : « Je ne commente pas l'existence ou l'inexistence d'un dossier dans la beta. » Cette formule est non négociable ; elle protège les enquêtes et elle vous protège.

### 8.4 Gestion du poste de travail

Vous travaillez sur un poste dont le volume principal est chiffré. Vous verrouillez le poste au-delà d'une période d'inactivité courte (90 secondes recommandées). Vous fermez la session de la beta plutôt que de simplement fermer l'onglet, à chaque pause longue. Vous ne sauvegardez pas vos notes d'investigation sur un service cloud non chiffré côté client.

Lorsque vous êtes en déplacement, vous n'ouvrez pas la beta dans un transport public sans écran de confidentialité. Vous évitez d'y accéder dans un espace où une caméra de surveillance pointe vers votre écran. Vous évitez d'y accéder à proximité d'un tiers qui pourrait lire au-dessus de votre épaule.

### 8.5 Données extraites

Toute donnée que vous extrayez de la beta (identifiant de snapshot, IOC exporté, adresse copiée) est traitée avec la même rigueur que la beta elle-même. Vous la conservez dans votre dossier d'investigation chiffré. Vous ne la collez pas dans un éditeur en ligne, dans un service de transcription tiers, dans un assistant conversationnel sans déploiement local, ou dans un outil dont les conditions d'utilisation autorisent une réutilisation par l'opérateur.

### 8.6 Fuite suspectée

Si vous suspectez qu'une donnée a fuité depuis la beta — vous voyez en ligne un élément qui ne devrait pas y être, un tiers vous mentionne un détail propre à la beta que vous n'avez pas partagé, un casefile non public est commenté hors NDA — vous notifiez immédiatement, vous documentez l'observation (URL, horodatage, capture locale chiffrée), et vous n'agissez pas autrement avant retour.

### 8.7 Phishing et social engineering ciblé

Vous êtes une cible plausible pour une tentative d'extraction d'information. Le scénario typique : un tiers vous contacte sous une identité professionnelle plausible (journaliste, chercheur, conseil juridique d'une partie nommée), engage la conversation sur un sujet qui semble adjacent, et fait progressivement glisser la demande vers des informations propres à la beta. Vous ne répondez à aucune demande de ce type sans validation explicite, indépendamment de la respectabilité apparente du tiers.

Si vous identifiez une tentative caractérisée, vous transmettez la trace (canal, identité revendiquée, contenu de l'échange) sans poursuivre l'échange. Vous ne répondez pas pour démentir, pour clore la conversation par une formule éloquente, ou pour piéger à votre tour : votre silence est la réponse la plus solide.

## 9. FAQ

### Q. Que faire si le score d'une adresse me semble manifestement incorrect ?

Vous remplissez un casefile selon le format de section 6, vous documentez l'écart (votre lecture indépendante par rapport à ce que la beta affiche), vous capturez un identifiant d'Evidence Snapshot de l'état observé, et vous transmettez le tout selon la procédure de §7.3. Vous ne tentez pas de modifier le score (vous n'en avez pas les droits) et vous ne le partagez avec personne d'autre.

### Q. Puis-je partager une capture d'un casefile à un tiers ?

Non. Aucune capture d'aucun élément vu dans la beta n'est diffusable à un tiers, indépendamment du statut du tiers (collègue, journaliste, conseil, autorité). Les casefiles publiés peuvent être communiqués sous leur forme publique (lien vers la page publique de la plateforme), pas sous forme de capture issue de votre compte.

### Q. Comment savoir si une adresse est déjà dans un casefile ?

Vous la scannez. Si elle est référencée dans un casefile, la vue wallet affichera le ou les casefiles liés, avec la distinction publique/non public.

### Q. Comment exporter un IOC pour mon dossier interne ?

Vous utilisez l'IOC Export Center, en sélectionnant le casefile ou le scan dont vous voulez extraire les indicateurs. Le format exporté est structuré et destiné à votre dossier interne. Vous ne redistribuez pas l'export hors de votre périmètre couvert par le NDA.

### Q. Que faire si je trouve un comportement de la beta qui m'inquiète sur le plan éthique ou légal ?

Vous documentez l'observation avec la rigueur d'un casefile, vous la remontez comme préoccupation prioritaire (section 7), et vous suspendez l'utilisation de la fonctionnalité concernée en attendant un retour. Vous ne diffusez pas la préoccupation hors du canal direct, y compris si vous estimez que la diffusion serait dans l'intérêt général ; la décision de publication n'est pas à votre charge.

### Q. Si on me demande quelle est ma source, que je réponds ?

Vous répondez par votre travail d'OSINT public et par les sources publiques que vous avez croisées. Vous ne mentionnez pas la beta. Si la question insiste, vous indiquez que vous ne commentez pas vos outils de travail dans un contexte d'enquête en cours, et vous notifiez le contact (§8.7).

### Q. Que faire pendant l'absence de David Douville (Lombok) ?

David Douville est en déplacement prolongé du 1er juin 2026 au 27 juillet 2026. Pendant cette fenêtre, le délai de réponse est étendu et un canal de relais vous sera précisé en début de période. Pour un signalement non bloquant, vous documentez et vous attendez son retour. Pour un signalement bloquant ou pour une suspicion de fuite, vous utilisez le canal de relais selon la procédure qu'il vous aura précisée. Vous ne forcez pas une décision irréversible en son absence.

### Q. Puis-je créer un casefile moi-même dans l'interface ?

Non. La création de casefile dans la plateforme passe par l'équipe éditoriale et n'est pas exposée à votre compte. Votre rôle est de documenter, dans le format casefile interne (section 6), les éléments que vous remontez pour qu'ils soient pris en compte par l'équipe. Le format interne est votre livrable.

### Q. Que faire si une victime me contacte directement à cause de mon usage de la beta ?

C'est un cas à signaler immédiatement (§8.7). Vous ne poursuivez pas la conversation au-delà des éléments strictement nécessaires pour que la personne ne soit pas laissée sans repère (vous l'orientez vers une ressource publique d'aide aux victimes ; le glossaire et la *Checklist d'investigation* publique en mentionnent plusieurs). Vous documentez la prise de contact et vous transmettez la trace. Vous ne confirmez pas votre rôle, et vous ne diffusez aucune donnée vue dans la beta.

### Q. Comment me déconnecter proprement à la fin d'une session ?

Vous utilisez le menu utilisateur de l'application et vous choisissez l'option de déconnexion. Vous vérifiez que vous êtes ramené à un écran public (page d'accueil non authentifiée). Vous fermez ensuite l'onglet, puis le navigateur si vous en avez fini pour la session. Vous ne vous contentez pas de fermer l'onglet : une session restée active dans un cookie peut être rouverte par toute personne qui réouvre l'onglet sans authentification supplémentaire.

### Q. Que faire si je découvre par accident un élément d'un casefile non public que je n'aurais pas dû voir ?

Vous signalez le fait comme bug (§7.1), vous ne le mentionnez à personne d'autre, et vous ne le copiez pas dans vos notes au-delà du strict nécessaire pour que le bug puisse être reproduit et corrigé. Une fois le bug remonté, vous oubliez activement l'élément ; vous ne le réutilisez pas, vous ne le citez pas, vous ne le sous-entendez pas.

### Q. Que faire si je suis sollicité par une partie nommée dans un casefile publié ?

Vous redirigez vers la page de contact publique de la plateforme et vous notifiez David Douville. Vous ne discutez pas du dossier au-delà de ce qui est déjà public dans le casefile, et vous n'engagez ni rectification, ni justification, ni complément en votre nom. Toute mise au point relève de l'éditeur, pas de vous.

### Q. La beta enregistre-t-elle ce que je consulte ?

Oui, pour des raisons d'audit interne. Vos requêtes, vos consultations de casefiles, et vos exports sont consignés. Ce journal n'est pas visible côté tiers et il sert à diagnostiquer les bugs et à comprendre l'usage. Vous adaptez votre activité en conséquence : ne consultez pas des dossiers que vous n'avez pas une raison opérationnelle de consulter.

## 10. Annexes

### 10.1 Lexique court

Cette annexe rappelle quelques termes que vous croiserez fréquemment. Les définitions complètes figurent au *Glossaire OSINT-Crypto* public dans le corpus pédagogique.

- **OSINT.** Renseignement de sources ouvertes.
- **SOCMINT.** Sous-ensemble de l'OSINT centré sur les réseaux sociaux.
- **Pivot.** Utilisation d'un identifiant connu pour en trouver un connexe.
- **Sockpuppet.** Compte opéré par un acteur distinct de l'identité présentée.
- **Astroturfing.** Activité coordonnée de comptes simulant un soutien spontané.
- **KOL.** Key Opinion Leader, opérateur d'influence sur une communauté.
- **Casefile.** Dossier d'enquête structuré, publié ou non, agrégeant les éléments d'une affaire.
- **TigerScore.** Score synthétique de risque attribué à un wallet, un contrat, ou un KOL par la plateforme.
- **Evidence Snapshot.** Capture interne, horodatée et identifiée, d'un état d'observation.
- **IOC.** Indicator of Compromise. Identifiant exploitable (adresse, hash, domaine, pseudonyme) extrait pour usage dans un dossier d'enquête.
- **Dark pattern.** Motif d'interface ou de discours bénéficiant à l'opérateur d'un service au détriment de l'utilisateur.
- **Rugpull.** Retrait soudain de liquidité ou de fonds par les opérateurs d'un projet.

### 10.2 Renvois vers le corpus public

Vous utilisez la beta en complément du corpus pédagogique public. Les documents de référence :

- *Les Dark Patterns dans le Crypto* (whitepaper, taxonomie des dark patterns crypto) : `content/whitepapers/dark-patterns-crypto.fr.md`.
- *Anatomy of a Rugpull* (whitepaper) : `content/whitepapers/anatomy-of-a-rugpull.fr.md`.
- *Checklist d'investigation — Affaires de fraude crypto* (playbook opérationnel) : `content/playbooks/investigation-checklist.fr.md` (en cours de publication).
- *Glossaire OSINT, Crypto et Investigation* : `content/glossary/osint-crypto-glossary.fr.md`.
- *Études de cas — Fraudes crypto anonymisées et fictionnalisées* : `content/case-studies/anonymized-cases.fr.md` (en cours de publication).
- *Crypto pour Enquêteurs — Cours en 10 leçons* : `content/courses/crypto-for-investigators-10-lessons.fr.md` (en cours de publication).

Les chemins ci-dessus correspondent au dépôt source ; la version diffusée publiquement est accessible depuis le site de la plateforme une fois les documents publiés.

### 10.3 Historique de version

- **V1.0** — 24 mai 2026. Première version allégée, dérivée du manuel core v1.0 du 23 mai 2026. À mettre à jour à la prochaine évolution significative de la beta.

---

Ce manuel est un outil de travail. S'il vous paraît incomplet, ambigu, ou décalé par rapport à votre usage réel de la beta, c'est aussi le format d'investigation interne (section 6) qui vous permet de le faire évoluer : remontez vos questions, vos angles morts, vos suggestions de section manquante. La prochaine version intégrera ce qui sera, à la relecture, jugé utile à l'enquêteur suivant.
