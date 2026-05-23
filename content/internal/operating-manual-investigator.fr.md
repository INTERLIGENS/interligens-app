---
title: "Manuel opérationnel — Beta-testeur enquêteur INTERLIGENS"
authors: ["INTERLIGENS Research"]
version: "1.0"
date: "2026-05-23"
status: "internal-draft"
classification: "INTERNE — NDA REQUIS"
license: "PROPRIÉTAIRE — DIFFUSION INTERDITE"
audience: ["beta-tester-enquêteur"]
abstract: "Manuel pratique d'usage de la beta INTERLIGENS pour enquêteur bêta-testeur sous NDA. Couvre la prise en main, les surfaces principales, les workflows d'enquête, le format de remontée de bugs et de feedback, et les bonnes pratiques de manipulation des données sensibles. Document interne, non publiable."
---

## 1. Préface

Ce document est interne. Il n'est pas destiné à la publication et n'est pas couvert par la licence Creative Commons appliquée au corpus pédagogique public. Vous le recevez parce que vous êtes lié par un accord de confidentialité actif avec l'éditeur de la beta, et parce que votre rôle de bêta-testeur enquêteur exige un cadre opérationnel qu'un guide utilisateur générique ne couvrirait pas.

Le manuel s'adresse à un seul lecteur à la fois. À la date de cette version, vous êtes le seul bêta-testeur extérieur disposant d'un accès actif. Vous ne devez ni transmettre ce document, ni en reproduire d'extraits, ni l'évoquer publiquement, ni le citer dans des communications avec des tiers. Si vous quittez le programme bêta, vous êtes tenu d'en supprimer toute copie locale (y compris dans vos sauvegardes, votre dossier de téléchargements, et tout système de prise de notes synchronisé en ligne). Cette consigne s'étend à tout extrait, citation, capture ou reformulation.

Le manuel est versionné. La présente est la version 1.0, datée du 23 mai 2026. Une nouvelle version sera diffusée à chaque évolution significative de la beta, et la version précédente devra alors être supprimée. Lorsque vous recevez une nouvelle version, vérifiez que le numéro et la date du document que vous utilisez correspondent à la version courante diffusée par David ; en cas de doute, demandez confirmation avant d'agir sur la base d'une procédure qui aurait évolué.

Le rappel suivant tient lieu d'engagement de relecture. En manipulant la beta, vous accédez à des dossiers d'enquête en cours, à des identifiants on-chain et off-chain, à des éléments de scoring, et à des contextes dont la divulgation hors cadre serait nuisible aux victimes, aux enquêtes en cours, aux personnes nommées (y compris celles qui pourraient ultérieurement être disculpées), et à la solidité juridique des dossiers eux-mêmes. La confidentialité absolue sur les casefiles non publics, sur les identités observées dans la beta, et sur les méthodes propres à la plateforme n'est pas un objectif à atteindre : c'est une condition de votre participation.

## 2. Cadre légal et déontologique

### 2.1 Données personnelles et présomption d'innocence

Vous manipulez, à travers la beta, des données qui relèvent pour partie du RGPD européen et pour partie de régimes équivalents dans les juridictions où vous opérez. Les profils de personnalités publiques et semi-publiques (KOL, opérateurs de projets, intervenants médiatiques) restent des personnes physiques au sens du RGPD ; le fait qu'une donnée soit publique ne fonde aucun droit à un traitement libre de tout cadre, et la qualité publique d'une personne ne suspend pas son droit à la rectification, à l'opposition, ou au recours.

La beta utilise un vocabulaire calibré pour cette contrainte. Vous y verrez la formulation « risque critique documenté », accompagnée d'éléments factuels et d'un score. Vous n'y verrez jamais la qualification « scammer », ni aucun équivalent qui présenterait un fait comme acquis avant qu'une autorité compétente ne l'ait établi. Cette discipline vous lie à votre tour : dans vos notes internes, dans vos échanges avec David, dans tout livrable produit à partir de la beta, vous adoptez le même registre. La présomption d'innocence n'est pas une convention rhétorique mais une protection juridique, pour la personne concernée et pour vous-même.

### 2.2 Représentation et publication

Vous ne représentez pas l'éditeur de la beta. Vous n'engagez ni sa parole ni sa responsabilité. Vous ne disposez pas du droit de diffuser, sous quelque forme que ce soit, le contenu observé dans la beta ; cette interdiction couvre les captures d'écran, les transcriptions, les paraphrases, les indices on-chain copiés depuis l'interface, les pseudonymes observés, et les conclusions que la plateforme afficherait sur un dossier.

L'unique cadre dans lequel vous pouvez documenter ce que vous voyez est interne, à destination exclusive de David, sous le format décrit en section 7. Ce cadre interne sert à remonter des observations, des bugs, des intuitions méthodologiques. Il ne sert pas à produire un livrable réutilisable hors du périmètre bêta.

### 2.3 Quand une donnée vous paraît erronée

Si une donnée vue dans la beta vous paraît erronée — score qui ne correspond pas aux signaux affichés, identité ou pseudonyme mal rattaché, casefile dont le périmètre semble surévalué — votre rôle n'est pas de corriger en ligne (vous n'en avez pas les droits, ce qui est intentionnel), mais de documenter le constat dans le format d'investigation interne et de le faire remonter. La beta évolue précisément parce que des observateurs disciplinés signalent ce qui ne tient pas ; un signalement étayé vaut mieux qu'une correction implicite.

Si la donnée vous paraît potentiellement diffamatoire ou litigieuse au sens juridique (mention nominative d'un tiers manifestement déconnectée des éléments présentés, par exemple), traitez ce signalement comme prioritaire et notifiez-le séparément dans votre remontée, en l'identifiant comme préoccupation juridique potentielle.

### 2.4 Quand un tiers vous contacte

Si un tiers vous contacte au sujet d'une donnée que vous avez vue dans la beta — par exemple un opérateur d'un projet visé par un casefile, un journaliste qui aurait eu vent de votre rôle, ou un proche d'une victime — votre réponse par défaut est de ne ni confirmer ni démentir votre accès, votre rôle, ou l'existence d'un dossier. Vous redirigez la personne vers un canal officiel de contact (page de contact publique de la plateforme) et vous notifiez David immédiatement, en transmettant la trace de l'échange (sans le poursuivre).

Cette discipline protège trois choses : votre intégrité méthodologique en tant que bêta-testeur, l'intégrité des enquêtes en cours dont une exposition prématurée détruirait les preuves, et votre propre exposition juridique en tant que personne identifiable.

## 3. Accès et authentification

### 3.1 URL et entrée

L'application principale est servie sous le domaine public `app.interligens.com`. Vous l'atteignez par votre navigateur courant. Aucune installation locale n'est requise pour la beta ; vos navigateurs habituels (versions à jour) suffisent.

### 3.2 Procédure de login

Vos identifiants vous ont été remis hors bande, c'est-à-dire par un canal distinct du document. Vous les conservez dans un gestionnaire de mots de passe local et chiffré, jamais en clair dans un courriel, un fichier texte non chiffré, ou un service synchronisé non chiffré côté client. Vous n'utilisez pas la fonction de mémorisation de mot de passe du navigateur sans chiffrement de session de profil utilisateur.

Si la beta vous propose un facteur secondaire d'authentification, vous l'activez. Vous privilégiez une clé matérielle ou une application d'authentification locale plutôt qu'un SMS, dont la solidité face à une attaque ciblée est moindre.

### 3.3 Re-login et perte d'accès

Si votre session expire, vous vous reconnectez par la même procédure. Si vous perdez l'accès — équipement compromis, identifiants oubliés, suspicion d'usage non autorisé — vous contactez David par le canal direct convenu lors de votre onboarding. N'utilisez pas un formulaire de récupération public si la beta en propose un ; un onboarding bêta n'est pas le cycle de vie d'un compte ordinaire.

En cas de suspicion de compromission (mot de passe possiblement exposé, équipement perdu ou volé), vous notifiez David dans les deux heures. La beta peut être suspendue pour votre compte le temps qu'un nouvel accès soit régénéré.

### 3.4 Durée et hygiène de session

Vous ne laissez pas de session ouverte sur un poste qui n'est pas sous votre garde immédiate. Vous verrouillez votre poste lorsque vous vous absentez, même brièvement. Vous fermez la session de l'application à la fin d'une période de travail, plutôt que de simplement fermer l'onglet ; la procédure propre de déconnexion est rappelée en section 11.

Vous n'accédez pas à la beta depuis un poste partagé, depuis un cybercafé, ou depuis un équipement professionnel d'une organisation tierce. Si votre poste de travail principal est partagé avec un autre utilisateur (foyer, colocation), vous utilisez un profil utilisateur distinct et vous fermez votre session avant de transférer le poste.

### 3.5 Réseau

Vous évitez les réseaux Wi-Fi publics ou semi-publics pour accéder à la beta. Si vous y êtes contraint, vous utilisez un tunnel chiffré (VPN) sous votre contrôle, qui ne loggue pas le trafic. Vous évitez les VPN dont la politique de logs ou la juridiction de siège ne sont pas documentées. Vous évitez d'accéder à la beta depuis un point d'accès dont vous ignorez qui le contrôle (réseaux d'événements, salons professionnels, hôtels).

## 4. Carte des surfaces de la beta

Cette section décrit ce que vous voyez et ce que vous pouvez en faire. Les descriptions sont fonctionnelles ; elles ne couvrent ni l'architecture interne de la plateforme ni les mécanismes de calcul, dont la divulgation ne servirait pas votre travail et qui ne sont pas à votre charge.

### 4.1 Page d'accueil et scan d'adresse

L'écran d'accueil propose un champ de scan où vous entrez une adresse (wallet ou contrat), une empreinte de transaction, ou un identifiant social rattaché. La plateforme couvre sept écosystèmes blockchain à la date de cette version. Le résultat du scan ouvre une vue dépendante du type d'identifiant : wallet, contrat de token, ou profil social.

Vous pouvez scanner librement. Le scan n'engage aucune action visible côté tiers. Vos requêtes sont consignées dans le journal interne de la plateforme pour des raisons d'audit et d'amélioration ; ce journal n'est pas visible côté tiers et n'est pas exploité hors de l'équipe restreinte.

Vous ne pouvez pas, depuis cette page, modifier une donnée, requalifier un identifiant, ou supprimer une trace. Les requêtes de correction passent par le format d'investigation interne (section 7).

### 4.2 Vue wallet ou contrat

La vue d'un wallet ou d'un contrat présente trois éléments principaux :

- Un score synthétique de risque (présenté sous le libellé TigerScore), accompagné d'une catégorisation qualitative (faible, modéré, élevé, critique).
- Une liste de signaux observés, regroupés par catégories (signaux on-chain, signaux off-chain, signaux d'écosystème).
- Un contexte agrégé : casefiles dans lesquels l'adresse apparaît, autres adresses connexes, fenêtres temporelles d'activité.

Le score a un sens — il agrège plusieurs signaux pondérés selon une méthodologie interne — mais vous ne devez pas l'interpréter comme un verdict. Un score élevé documente un risque, il n'établit pas une infraction. Un score faible n'absout pas une adresse ; il documente une absence de signal au moment du scan, ce qui n'est pas la même chose qu'une absence de risque.

Vous pouvez naviguer depuis la vue vers les casefiles liés, vers les adresses connexes, et vers les profils sociaux rattachés s'il y en a. Vous ne pouvez pas modifier le score, ajouter un signal, ou requalifier une catégorie depuis l'interface.

### 4.3 Vue KOL

La vue d'un KOL (Key Opinion Leader) agrège, pour un même opérateur social, ses pseudonymes connus, ses adresses on-chain rattachées, un score synthétique, et les casefiles dans lesquels il apparaît. La vue affiche le type d'attachement entre le KOL et chaque casefile : promotion, exécution, financement, observation, sans accusation.

Vous pouvez naviguer depuis la vue KOL vers chaque casefile lié, vers chaque adresse rattachée, et vers d'autres KOL identifiés comme évoluant dans la même grappe. La vue KOL est plus sensible que la vue wallet : un profil agrégé qui regroupe plusieurs pseudonymes peut, par construction, faciliter une ré-identification ; le caractère NDA-gated du contenu est ici particulièrement strict.

### 4.4 Casefiles publiés

À la date de cette version, cinq casefiles publiés sont disponibles depuis la liste publique de la plateforme. Vous pouvez les consulter en mode lecture intégrale depuis votre compte bêta, comme depuis le compte public. Les casefiles publiés ont franchi une revue éditoriale et juridique ; ils sont conçus pour être diffusés tels quels.

D'autres casefiles existent dans le périmètre de travail de la plateforme et vous pourrez en voir mention dans la vue KOL ou dans la vue wallet, sans pouvoir y accéder en lecture intégrale. Ces casefiles non publics ne doivent jamais être nommés ni décrits, même par allusion, hors de votre canal direct avec David. Si la beta vous expose accidentellement un détail d'un casefile non public que vous n'auriez pas dû voir, vous le signalez comme bug (section 8) et vous n'en parlez à personne d'autre.

### 4.5 Investigator Dashboard

L'Investigator Dashboard est votre tableau de bord personnel. Il regroupe vos derniers scans, vos derniers KOL consultés, et les casefiles que vous avez ouverts récemment. Il sert de point de reprise entre deux sessions de travail.

Vous pouvez épingler des éléments pour les retrouver. Vous ne pouvez pas partager le dashboard, ni l'exporter dans un format réutilisable hors de la plateforme. L'objectif est de garder une trace de votre activité, non de produire un livrable réutilisable.

### 4.6 IOC Export Center

L'IOC Export Center vous permet d'exporter, dans un format structuré, les indicateurs (adresses, hashes, domaines, pseudonymes) liés à un casefile publié ou à un scan que vous avez effectué. L'export sert votre dossier d'enquête interne. Il n'est pas une licence de redistribution : les indicateurs exportés restent couverts par votre NDA et ne doivent pas être republié hors du cadre interne.

Vous ne pouvez pas exporter d'éléments issus d'un casefile non public, même si vous en avez vu mention dans la vue KOL ou la vue wallet. La plateforme limite l'export à ce qui est légitimement diffusable ; vous ne devez pas chercher à contourner cette limite.

### 4.7 Evidence Snapshots

Les Evidence Snapshots sont des captures structurées que vous pouvez générer depuis la beta pour figer un état d'observation à un moment donné. Un snapshot conserve l'identifiant scanné, le score affiché, les signaux observés, l'horodatage, et un identifiant interne unique. Vous l'utilisez dans vos notes pour citer ce que vous avez vu, à quel moment, sans avoir à reproduire l'écran.

Les snapshots restent stockés côté plateforme et vous n'en exportez que l'identifiant dans vos notes internes. Vous ne devez pas tenter d'exporter l'image, le PDF, ou la version riche d'un snapshot vers un canal externe. La traçabilité de l'observation est l'élément que vous remontez ; le contenu reste où il est.

### 4.8 Surfaces NDA-gated par rapport aux surfaces publiques

Les casefiles publiés et la page d'accueil de la plateforme sont accessibles en consultation publique. Tout le reste — vue KOL agrégée, vue wallet avec score et signaux, Investigator Dashboard, IOC Export Center, Evidence Snapshots, et toute mention même partielle d'un casefile non public — relève du périmètre NDA. La distinction est binaire : si vous voyez la fonctionnalité dans votre compte bêta et qu'un utilisateur non authentifié ne la verrait pas, le contenu est NDA-gated.

## 5. Workflow type — Recevoir un signalement et démarrer une enquête

Cette section décrit la séquence opérationnelle qu'un signalement standard déclenche. Elle s'articule au playbook public *Checklist d'investigation*, section 2 (premiers réflexes) et sections suivantes ; le présent manuel ne le reproduit pas mais en suit la logique en l'instrumentant pour la beta.

### 5.1 Réception du signalement

Le premier contact avec une victime ou un témoin est le moment le plus riche en preuves et le plus volatil. Avant tout usage de la beta, vous appliquez la séquence préservation rappelée dans la *Checklist d'investigation* publique (§2) : horodatage UTC et local, capture du signalement tel quel avec consentement, préservation des URL pleines, collecte des adresses en texte clair, identification explicite de la chaîne pour chaque hash ou adresse, notation du persona présenté à la victime.

La beta n'a pas vocation à remplacer cette étape. Elle intervient ensuite, lorsque vous disposez d'identifiants exploitables.

### 5.2 Premier scan

Vous ouvrez l'application et entrez le premier identifiant exploitable dans le champ de scan. L'ordre conseillé, lorsque plusieurs identifiants sont disponibles, est :

1. L'adresse de wallet suspect en premier.
2. L'adresse du contrat de token concerné, si la fraude porte sur un token.
3. Le pseudonyme social du persona si la beta dispose d'une vue KOL rattachée.

Ce premier scan vous donne un point d'ancrage. Vous notez immédiatement, dans vos notes internes, l'identifiant, le score observé, et un Evidence Snapshot.

### 5.3 Lecture du score et des signaux

Vous lisez le score comme une synthèse, non comme une conclusion. La grille de lecture conseillée :

- Score critique. Signaux concordants documentent un risque significatif. Vous traitez la suite de l'enquête avec l'hypothèse forte que l'adresse est impliquée dans une opération nuisible, sans pour autant la qualifier vous-même.
- Score élevé. Signaux multiples mais pas tous concordants. Vous notez les divergences et orientez les pivots suivants pour les lever.
- Score modéré ou faible avec une victime crédible. Vous traitez la divergence comme un signal en soi : soit la beta n'a pas encore agrégé les signaux pertinents (signalement pour la section 8), soit le persona perçu par la victime ne correspond pas à l'adresse fournie (à creuser).

Vous lisez les signaux dans l'ordre où la vue les présente. Pour chaque signal, vous notez s'il est on-chain (vérifiable indépendamment via un explorateur de chaîne), off-chain (lié à des sources publiques accessibles indépendamment de la plateforme), ou d'écosystème (issu de l'agrégation propre à la plateforme). Cette discipline vous protège : un signal d'écosystème pèse moins en preuve indépendante qu'un signal on-chain vérifiable.

### 5.4 Élargissement aux casefiles liés

Si la vue indique des casefiles liés, vous les ouvrez dans l'ordre de proximité affiché. Pour chaque casefile, vous repérez si vous avez accès à la lecture intégrale (casefile publié) ou seulement à la mention (casefile non public). Dans le second cas, vous notez l'existence du lien mais vous ne tentez pas d'en savoir davantage hors de votre canal avec David.

Pour les casefiles publiés liés, vous lisez la synthèse, vous notez les éléments qui croisent votre signalement (adresses partagées, KOL partagés, fenêtres temporelles partagées), et vous capturez un Evidence Snapshot des passages utiles.

### 5.5 Capture des Evidence Snapshots

Vous créez un snapshot pour chaque observation que vous citerez ensuite. Les snapshots utiles incluent typiquement : la vue wallet initiale, la vue KOL si vous l'avez ouverte, la liste des casefiles liés, et chaque sous-vue qui a influé sur votre raisonnement. Vous conservez les identifiants dans vos notes, jamais le contenu rendu.

Vous ne capturez pas d'écran avec un outil OS-natif sauf pour un usage strictement local (votre dossier d'investigation chiffré, jamais redistribué). Le snapshot interne suffit pour la traçabilité, et il a l'avantage d'être horodaté côté plateforme.

### 5.6 Documentation dans le format interne

Vous documentez l'enquête au format décrit en section 7 ci-dessous. Vous n'inventez pas un format ad hoc ; la cohérence avec le template facilite à David la lecture et la priorisation des remontées.

### 5.7 Remontée à David

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

## 6. Workflow type — Explorer un KOL et son écosystème

Ce workflow est plus exploratoire que le précédent et il est aussi plus sensible. Vous l'utilisez lorsqu'un pseudonyme ou un wallet émerge d'un signalement, d'une lecture de presse, ou d'une remontée d'une autre source, et que vous voulez en cartographier la grappe immédiate.

### 6.1 Démarrage

Vous démarrez depuis un handle social ou depuis un wallet. Si vous démarrez d'un handle, vous tentez d'abord la résolution dans la vue KOL ; si la vue n'existe pas, l'opérateur n'est pas (encore) profilé dans la plateforme, et vous travaillez à partir des sources publiques avant de revenir à la beta. Si vous démarrez d'un wallet, vous tentez d'abord la résolution inverse vers un ou plusieurs KOL rattachés.

### 6.2 Lecture de la fiche KOL

La fiche KOL agrège plusieurs éléments : les pseudonymes rattachés, les adresses on-chain associées, le score, les casefiles liés, et la fenêtre temporelle d'activité observée. Vous lisez la fiche dans l'ordre :

- Pseudonymes : combien, sur quelles plateformes, depuis quand. Vous notez la cohérence ou les divergences (changements de pseudonyme alignés sur des fenêtres d'activité).
- Adresses : combien, sur quelles chaînes, et le type d'attachement déclaré (signature, transaction répétée, déclaration publique, inférence d'analyse).
- Score : avec la même prudence d'interprétation qu'en section 5.3. Un score KOL synthétise une trajectoire, pas un acte unique.
- Casefiles liés : avec le même filtre publics/non publics qu'en section 5.4.

### 6.3 Identification de la grappe

Si la beta affiche d'autres KOL rattachés à la même grappe, vous notez chacun, le type de lien (co-promotion, transactions croisées, intervention partagée sur un même token), et la robustesse du lien (lien fort = plusieurs vecteurs concordants, lien faible = un seul vecteur).

Vous ne déduisez pas de ces liens une qualification sur les autres KOL de la grappe sans étayer indépendamment. La présence dans une grappe n'établit pas une infraction ; elle documente une co-occurrence dont l'enquête doit ensuite démêler le sens.

### 6.4 Capture et documentation

Vous capturez un Evidence Snapshot pour chaque vue significative. Vous documentez la session selon le format de section 7, en notant explicitement qu'il s'agit d'une session exploratoire (et non d'une réponse à un signalement). Une exploration sans signalement déclencheur doit être notée comme telle ; cela aide David à hiérarchiser vos remontées et à comprendre la généalogie de vos hypothèses.

## 7. Format d'investigation interne — Template casefile bêta-testeur

Vous documentez chaque session significative dans un fichier Markdown local, suivant le gabarit ci-dessous. Vous ne stockez pas ces fichiers sur un service de synchronisation cloud non chiffré ; vous les conservez en local sur un volume chiffré, et vous transmettez à David par le canal direct convenu (au choix : courrier chiffré end-to-end ou dépôt dans un espace que David vous aura indiqué).

Le gabarit :

```markdown
# CASEFILE BÊTA — [titre court anonymisé]

**Date** : YYYY-MM-DD
**Enquêteur** : [pseudonyme NDA, ex. @dethective]
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

## 6. Remontée à David
[ce que l'enquêteur souhaite signaler comme bug, anomalie ou intuition à approfondir]
```

Quelques règles d'usage du gabarit :

- Le titre court anonymisé évite toute mention de la victime, du KOL, ou du token. Vous utilisez une étiquette opérationnelle (« Rugpull Q2 — entrée du 17 mai ») plutôt qu'une étiquette identifiante.
- Le pseudonyme NDA est celui que vous avez convenu avec David lors de votre onboarding ; il vous permet d'apparaître dans les notes internes sans que votre identité réelle y figure.
- La source du signalement est un type (« victime directe », « relais médiatique », « observation propre ») et non une identité.
- Les hypothèses sont formulées sans nommer de personne présumée responsable. Vous écrivez « un acteur correspondant au persona @X aurait pu… » plutôt que « X est… ».
- Les snapshots sont référencés par identifiant interne. Vous ne copiez pas le contenu rendu d'un snapshot dans vos notes ; le but est de pouvoir retrouver l'observation, non de la dupliquer.
- La section 5 (limites) doit être remplie. Une enquête sans incertitudes documentées est suspecte ; David apprécie plus la lucidité méthodologique qu'une certitude affichée.

## 8. Bugs et feedback — Procédure

### 8.1 Bug report

Un bug report utile contient toujours, au minimum :

- L'URL exacte à laquelle vous étiez (sans la coller publiquement si elle contient un identifiant sensible ; dans ce cas, transmettez-la à David par le canal direct).
- L'action que vous étiez en train d'effectuer (par exemple, « scan d'un wallet Solana de 44 caractères », « ouverture de la fiche KOL @persona depuis un casefile lié »).
- Le résultat attendu (par exemple, « ouverture de la vue KOL »).
- Le résultat observé (par exemple, « écran blanc, console navigateur affiche une erreur 500 »).
- L'horodatage UTC précis au moment du bug.
- Le navigateur et la version (utile pour les bugs front).
- Une capture d'écran locale conservée chiffrée, jamais redistribuée ; si la capture contient une donnée sensible, vous floutez avant transmission.

### 8.2 Feedback design

Un feedback design est une suggestion sur l'ergonomie, le vocabulaire affiché, la disposition, la navigation. Le format minimal :

- La surface concernée (vue wallet, vue KOL, Investigator Dashboard, IOC Export Center, Evidence Snapshots, page d'accueil).
- L'élément précis (un bouton, une étiquette, un ordre de tri, un comportement par défaut).
- La raison du feedback (ce qui vous a frotté ou ralenti en usage réel).
- La suggestion (concrète, pas une plainte abstraite).

### 8.3 Feedback méthodologique

C'est le feedback le plus précieux. Il porte sur la qualité de l'output de la beta : un score qui vous paraît mal calibré sur un cas, un signal absent que vous auriez attendu, un signal présent dont vous comprenez mal la source, une catégorisation qualitative qui vous semble inadaptée à ce que vous voyez du dossier. Le format minimal :

- Le contexte (sans révéler la victime, le KOL, ou le token de manière identifiante).
- Le constat (ce que la beta affiche).
- Votre interprétation (ce que vous comprenez après votre propre travail d'OSINT).
- L'écart (en quoi la beta sur-évalue, sous-évalue, ou manque le sujet).
- L'hypothèse (ce qui pourrait expliquer l'écart, et ce qui aiderait à le réduire).

### 8.4 Canal et délai

Vous remontez à David par le canal direct convenu lors de l'onboarding. Vous ne remontez pas à un email générique de la plateforme, sauf si vous n'avez pas d'autre option. Vous ne remontez pas non plus par les réseaux sociaux, par messagerie publique, ou par tout canal dont vous ne maîtrisez pas la chaîne de transmission.

Le délai indicatif de réponse est de 24 à 48 heures ouvrées pour un signalement standard et de 12 à 24 heures pour un signalement bloquant (impossibilité d'accéder à la beta, suspicion de fuite, élément potentiellement diffamatoire). Pendant la fenêtre du 1er juin 2026 au 27 juillet 2026, David est en déplacement prolongé et le délai de réponse est étendu ; un message d'absence vous précisera, à l'entrée dans cette fenêtre, le canal de relais et le rythme attendu de réponse.

## 9. Bonnes pratiques OPSEC pour l'enquêteur

### 9.1 Réseau

Vous n'accédez pas à la beta depuis un réseau public sans tunnel chiffré sous votre contrôle (rappel de la section 3.5). Vous évitez les réseaux dont vous ignorez la politique de logs.

### 9.2 Captures et redistribution

Vous ne prenez pas de capture d'écran pour des tiers. Vous ne partagez pas une capture, fût-elle floutée, sur un canal public. Vous ne décrivez pas, en public ou en demi-privé, ce que vous avez vu dans la beta. La règle est binaire et n'admet pas d'exception « pour une seule personne de confiance » : un seul partage hors NDA suffit à compromettre votre rôle et l'enquête.

### 9.3 Existence des casefiles non publics

Vous ne confirmez ni ne démentez l'existence d'un casefile non public à un tiers. Vous ne répondez pas par silence éloquent, par sourire entendu, ou par formule ambiguë. La réponse correcte est : « Je ne commente pas l'existence ou l'inexistence d'un dossier dans la beta. » Cette formule est non négociable ; elle protège les enquêtes et elle vous protège.

### 9.4 Gestion du poste de travail

Vous travaillez sur un poste dont le volume principal est chiffré (chiffrement complet du disque). Vous verrouillez le poste au-delà d'une période d'inactivité courte (90 secondes recommandées). Vous ne laissez pas votre poste déverrouillé sans surveillance. Vous fermez la session de la beta plutôt que de simplement fermer l'onglet, à chaque pause longue. Vous ne sauvegardez pas vos notes d'investigation sur un service cloud non chiffré côté client.

Lorsque vous êtes en déplacement, vous n'ouvrez pas la beta dans un transport public sans écran de confidentialité. Vous évitez d'y accéder dans un espace où une caméra de surveillance pointe vers votre écran. Vous évitez d'y accéder à proximité d'un tiers qui pourrait lire au-dessus de votre épaule.

### 9.5 Données extraites

Toute donnée que vous extrayez de la beta (identifiant de snapshot, IOC exporté, adresse copiée) est traitée avec la même rigueur que la beta elle-même. Vous la conservez dans votre dossier d'investigation chiffré. Vous ne la collez pas dans un éditeur en ligne, dans un service de transcription tiers, dans un assistant conversationnel sans déploiement local, ou dans un outil dont les conditions d'utilisation autorisent une réutilisation par l'opérateur.

### 9.6 Fuite suspectée

Si vous suspectez qu'une donnée a fuité depuis la beta — vous voyez en ligne un élément qui ne devrait pas y être, un tiers vous mentionne un détail propre à la beta que vous n'avez pas partagé, un casefile non public est commenté hors NDA — vous notifiez David immédiatement, vous documentez l'observation (URL, horodatage, capture locale chiffrée), et vous n'agissez pas autrement avant son retour.

### 9.7 Phishing et social engineering ciblé

Vous êtes une cible plausible pour une tentative d'extraction d'information. Le scénario typique : un tiers vous contacte sous une identité professionnelle plausible (journaliste, chercheur, conseil juridique d'une partie nommée), engage la conversation sur un sujet qui semble adjacent, et fait progressivement glisser la demande vers des informations propres à la beta. Vous ne répondez à aucune demande de ce type sans validation explicite de David, indépendamment de la respectabilité apparente du tiers.

Si vous identifiez une tentative caractérisée, vous transmettez la trace (canal, identité revendiquée, contenu de l'échange) à David, sans poursuivre l'échange. Vous ne répondez pas pour démentir, pour clore la conversation par une formule éloquente, ou pour piéger à votre tour : votre silence est la réponse la plus solide.

## 10. Limites connues de la beta

### 10.1 Périmètre de chaînes

La beta couvre sept chaînes principales à la date de cette version. Le détail des chaînes couvertes vous est visible depuis l'application elle-même ; il n'est pas reproduit ici parce qu'il est appelé à évoluer.

Plusieurs chaînes restent hors périmètre. Vous y rencontrerez à l'usage : la majorité des chaînes layer-2 émergentes après la date de cette version, les chaînes monérisées orientées confidentialité, et les couches qui ne sont pas adressées par les explorateurs publics standards. Lorsqu'un signalement porte sur une chaîne hors périmètre, vous ne forcez pas un scan ; vous notez le périmètre manquant dans votre remontée et vous documentez l'enquête à partir des sources externes.

### 10.2 Latence des scans

La beta met à jour ses agrégats périodiquement. Vous pouvez donc rencontrer un décalage entre une activité on-chain très récente et son apparition dans la vue wallet ou la vue KOL. La durée typique de ce décalage est de quelques minutes à quelques heures selon le type d'élément. Lorsqu'un dossier est en cours d'évolution rapide, vous re-scannez à intervalles raisonnables plutôt qu'en continu, et vous notez l'horodatage de chaque snapshot.

### 10.3 Faux positifs et faux négatifs

Aucune plateforme de scoring n'échappe à un taux résiduel d'erreur. La beta peut signaler comme risquée une adresse qui s'avère neutre après enquête, et peut ne pas signaler une adresse réellement impliquée si les signaux que sa méthodologie pondère ne sont pas encore présents. Vous gardez cette possibilité à l'esprit en lisant un score, et vous remontez les cas qui vous paraissent illustratifs d'un faux positif ou d'un faux négatif (section 8.3).

### 10.4 Casefiles publiés et casefiles non publics

Cinq casefiles sont publiés à la date de cette version. D'autres sont en cours d'instruction et ne seront publiés qu'au terme d'une revue éditoriale et juridique. Le rapport entre les deux populations évoluera ; vous ne le commentez pas hors canal direct avec David.

### 10.5 Versionnage et stabilité

La beta évolue rapidement. Une fonctionnalité que vous utilisez aujourd'hui peut bouger, être renommée, ou être déplacée d'ici à la prochaine version du manuel. Vous adaptez votre usage en conséquence, et vous signalez les ruptures qui ralentissent votre travail. Le présent manuel est versionné précisément pour absorber ces évolutions ; vérifiez à chaque session que la version du document que vous utilisez correspond à la version courante diffusée par David.

## 11. FAQ

### Q. Que faire si le score d'une adresse me semble manifestement incorrect ?

Vous remplissez un casefile bêta selon le format de section 7, vous documentez l'écart (votre lecture indépendante par rapport à ce que la beta affiche), vous capturez un Evidence Snapshot de l'état observé, et vous transmettez le tout à David selon la procédure de section 8.3. Vous ne tentez pas de modifier le score (vous n'en avez pas les droits) et vous ne le partagez avec personne d'autre.

### Q. Puis-je partager une capture d'un casefile à un tiers ?

Non. Aucune capture d'aucun élément vu dans la beta n'est diffusable à un tiers, indépendamment du statut du tiers (collègue, journaliste, conseil, autorité). Les casefiles publiés peuvent être communiqués sous leur forme publique (lien vers la page publique de la plateforme), pas sous forme de capture issue de votre compte bêta.

### Q. Comment savoir si une adresse est déjà dans un casefile ?

Vous la scannez. Si elle est référencée dans un casefile, la vue wallet affichera le ou les casefiles liés, avec la distinction publique/non public.

### Q. Comment exporter un IOC pour mon dossier interne ?

Vous utilisez l'IOC Export Center (section 4.6), en sélectionnant le casefile ou le scan dont vous voulez extraire les indicateurs. Le format exporté est structuré et destiné à votre dossier interne. Vous ne redistribuez pas l'export hors de votre périmètre couvert par le NDA.

### Q. Que faire si je trouve un comportement de la beta qui m'inquiète sur le plan éthique ou légal ?

Vous documentez l'observation avec la rigueur d'un casefile bêta, vous la remontez à David comme préoccupation prioritaire (section 8), et vous suspendez l'utilisation de la fonctionnalité concernée en attendant un retour. Vous ne diffusez pas la préoccupation hors du canal direct avec David, y compris si vous estimez que la diffusion serait dans l'intérêt général ; la décision de publication n'est pas à votre charge en tant que bêta-testeur.

### Q. Si on me demande quelle est ma source, que je réponds ?

Vous répondez par votre travail d'OSINT public et par les sources publiques que vous avez croisées. Vous ne mentionnez pas la beta. Si la question insiste, vous indiquez que vous ne commentez pas vos outils de travail dans un contexte d'enquête en cours, et vous notifiez David du contact (section 9.7).

### Q. Que faire pendant l'absence de David (Lombok) ?

David est en déplacement prolongé du 1er juin 2026 au 27 juillet 2026. Pendant cette fenêtre, le délai de réponse est étendu et un canal de relais vous sera précisé en début de période. Pour un signalement non bloquant, vous documentez et vous attendez son retour. Pour un signalement bloquant ou pour une suspicion de fuite, vous utilisez le canal de relais selon la procédure qu'il vous aura précisée. Vous ne forcez pas une décision irréversible en son absence.

### Q. Puis-je créer un casefile moi-même dans l'interface ?

Non. La création de casefile dans la plateforme passe par l'équipe éditoriale et n'est pas exposée à votre compte bêta. Votre rôle est de documenter, dans le format casefile bêta interne (section 7), les éléments que vous remontez pour qu'ils soient pris en compte par l'équipe. Le format interne est votre livrable ; le casefile plateforme est, le cas échéant, le produit d'une décision éditoriale ultérieure.

### Q. Que faire si une victime me contacte directement à cause de mon usage de la beta ?

C'est un cas à signaler immédiatement à David (section 9.7). Vous ne poursuivez pas la conversation au-delà des éléments strictement nécessaires pour que la personne ne soit pas laissée sans repère (vous l'orientez vers une ressource publique d'aide aux victimes ; le glossaire et la *Checklist d'investigation* publique en mentionnent plusieurs). Vous documentez la prise de contact et vous transmettez la trace à David. Vous ne confirmez pas votre rôle de bêta-testeur, et vous ne diffusez aucune donnée vue dans la beta.

### Q. Comment me déconnecter proprement à la fin d'une session ?

Vous utilisez le menu utilisateur de l'application (en haut à droite dans la version courante) et vous choisissez l'option de déconnexion. Vous vérifiez que vous êtes ramené à un écran public (page d'accueil non authentifiée). Vous fermez ensuite l'onglet, puis le navigateur si vous en avez fini pour la session. Vous ne vous contentez pas de fermer l'onglet : une session restée active dans un cookie peut être rouverte par toute personne qui réouvre l'onglet sans authentification supplémentaire.

### Q. Que faire si je découvre par accident un élément d'un casefile non public que je n'aurais pas dû voir ?

Vous signalez le fait comme bug (section 8.1), vous ne le mentionnez à personne d'autre, et vous ne le copiez pas dans vos notes au-delà du strict nécessaire pour que David puisse reproduire et corriger. Une fois le bug remonté, vous oubliez activement l'élément ; vous ne le réutilisez pas, vous ne le citez pas, vous ne le sous-entendez pas.

### Q. Que faire si je suis sollicité par une partie nommée dans un casefile publié ?

Vous redirigez vers la page de contact publique de la plateforme et vous notifiez David. Vous ne discutez pas du dossier au-delà de ce qui est déjà public dans le casefile, et vous n'engagez ni rectification, ni justification, ni complément en votre nom. Toute mise au point relève de l'éditeur, pas de vous.

### Q. La beta enregistre-t-elle ce que je consulte ?

Oui, pour des raisons d'audit interne. Vos requêtes, vos consultations de casefiles, et vos exports sont consignés. Ce journal n'est pas visible côté tiers et il sert à diagnostiquer les bugs et à comprendre l'usage. Vous adaptez votre activité en conséquence : ne consultez pas des dossiers que vous n'avez pas une raison opérationnelle de consulter.

## 12. Annexes

### 12.1 Lexique court

Cette annexe rappelle quelques termes que vous croiserez fréquemment. Les définitions complètes figurent au *Glossaire OSINT-Crypto* public dans le corpus pédagogique (voir 12.2).

- **OSINT.** Renseignement de sources ouvertes. Voir glossaire entrée #1.
- **SOCMINT.** Sous-ensemble de l'OSINT centré sur les réseaux sociaux. Entrée #2.
- **Pivot.** Utilisation d'un identifiant connu pour en trouver un connexe. Entrée #4.
- **Sockpuppet.** Compte opéré par un acteur distinct de l'identité présentée. Entrée #5.
- **Astroturfing.** Activité coordonnée de comptes simulant un soutien spontané. Entrée #6.
- **KOL.** Key Opinion Leader, opérateur d'influence sur une communauté.
- **Casefile.** Dossier d'enquête structuré, publié ou non, agrégeant les éléments d'une affaire.
- **TigerScore.** Score synthétique de risque attribué à un wallet, un contrat, ou un KOL par la plateforme.
- **Evidence Snapshot.** Capture interne, horodatée et identifiée, d'un état d'observation.
- **IOC.** Indicator of Compromise. Identifiant exploitable (adresse, hash, domaine, pseudonyme) extrait pour usage dans un dossier d'enquête.
- **Dark pattern.** Motif d'interface ou de discours bénéficiant à l'opérateur d'un service au détriment de l'utilisateur. Voir whitepaper *Dark Patterns*.
- **Rugpull.** Retrait soudain de liquidité ou de fonds par les opérateurs d'un projet. Voir étude de cas Cas 1 du corpus public.

### 12.2 Renvois vers le corpus public

Vous utilisez la beta en complément du corpus pédagogique public produit par la même équipe. Lorsque ce manuel renvoie à un document du corpus, les chemins de référence sont :

- *Les Dark Patterns dans le Crypto* (whitepaper, taxonomie des dark patterns crypto) : `content/whitepapers/dark-patterns-crypto.fr.md`. Sections particulièrement utiles à un enquêteur : §A.1 faux compte à rebours, §A.2 théâtre de la rareté, §A.3 déclencheurs FOMO, §B.1 astroturfing et sockpuppets, §B.2 FOMO orchestré par KOL.
- *Checklist d'investigation — Affaires de fraude crypto* (playbook opérationnel) : `content/playbooks/investigation-checklist.fr.md`. Sections particulièrement utiles : §2 premiers réflexes, §3 préservation des preuves, §4 wallets, §5 collecte d'identifiants off-chain, §5.4 sockpuppets, §6.4 astroturfing, §7 structuration du dossier.
- *Glossaire OSINT, Crypto et Investigation* : `content/glossary/osint-crypto-glossary.fr.md`. Vous y trouverez les 70 entrées de référence, organisées en cinq catégories (OSINT, Crypto, Schémas de fraude, Analyse on-chain, Écosystème).
- *Études de cas — Fraudes crypto anonymisées et fictionnalisées* : `content/case-studies/anonymized-cases.fr.md`. Quatre cas pédagogiques (rugpull, exit scam centralisé, pump-and-dump, drainer) utilisables pour aligner votre lecture des signaux de la beta avec une grammaire commune.

Les chemins ci-dessus correspondent au dépôt source ; la version diffusée publiquement est accessible depuis le site de la plateforme une fois les documents publiés. La *Checklist*, le *Glossaire* et les *Études de cas* sont, à la date de la présente version, en cours de revue éditoriale et de publication ; le *Whitepaper Dark Patterns* est publié.

### 12.3 Historique de version

- **V1.0** — 23 mai 2026. Première version. À mettre à jour à la prochaine évolution significative de la beta (nouvelle surface, nouveau format d'export, modification du périmètre de chaînes, modification de la politique de remontée).

---

Ce manuel est un outil de travail. S'il vous paraît incomplet, ambigu, ou décalé par rapport à votre usage réel de la beta, c'est aussi le format d'investigation interne (section 7) qui vous permet de le faire évoluer : remontez à David vos questions, vos angles morts, vos suggestions de section manquante. La prochaine version intégrera ce qui sera, à la relecture, jugé utile au bêta-testeur suivant.
