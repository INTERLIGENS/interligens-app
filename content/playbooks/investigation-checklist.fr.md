---
title: "Checklist d'enquête — Affaires de fraude crypto (playbook opérationnel)"
authors: ["INTERLIGENS Research"]
version: "1.0"
date: "2026-05-22"
status: "draft"
license: "CC BY-NC 4.0"
audience: ["enquêteurs", "chercheurs", "journalistes", "conseil-juridique", "analystes-osint"]
abstract: "Une checklist opérationnelle pour la réponse de premier niveau, la préservation des preuves, la collecte d'identifiants on-chain et off-chain, l'analyse comportementale, la construction du dossier d'enquête, et l'orientation des victimes dans les affaires de fraude crypto. Le document est éducatif ; il ne se substitue ni au conseil juridique ni aux procédures des autorités compétentes."
---

## 1. Préface

### 1.1 Objet

Ce playbook propose une séquence opérationnelle pour traiter un signalement de fraude crypto, depuis le moment où il parvient à un enquêteur jusqu'à celui où un dossier structuré peut être remis aux autorités compétentes ou à des journalistes en vue d'une vérification complémentaire. Il est conçu comme une checklist : chaque section est destinée à être lue dans l'ordre lors d'une affaire réelle, cochée, puis reprise au fur et à mesure que de nouvelles informations émergent.

Ce playbook ne remplace pas une formation juridique, une expertise juridictionnelle, ni les procédures institutionnelles d'une agence donnée. C'est un échafaudage méthodologique — un moyen de s'assurer que les premières heures d'une enquête, qui sont aussi celles où la plupart des preuves disparaissent, sont consacrées à la collecte des bons éléments dans le bon ordre.

### 1.2 Public visé

Le document s'adresse à quatre publics dont les pratiques se croisent fréquemment :

- **Les enquêteurs financiers** au sein d'organismes régulés et de cabinets privés, qui trient les signalements de fraude suspectée impliquant des crypto-actifs et décident s'il faut escalader.
- **Les journalistes d'investigation** couvrant les marchés crypto, où la préservation des preuves et la vérification des sources sont opérationnellement similaires à celles d'un enquêteur financier, et où l'exposition juridique liée à la publication est élevée.
- **Les conseils spécialisés** assistant les victimes, pour lesquels une trace structurée précoce influe matériellement sur les chances de récupération, sur le respect des obligations de divulgation, et sur la juste appréciation des délais de prescription.
- **Les analystes OSINT** contribuant à l'un quelconque des éléments ci-dessus, en particulier lorsque les preuves on-chain et off-chain doivent être assemblées en un récit unique.

Les lecteurs occupant des rôles adjacents — responsables conformité, enquêteurs internes d'exchanges, chercheurs académiques — pourront trouver le noyau méthodologique utile même si leur environnement procédural diffère.

### 1.3 Périmètre

Le playbook traite des fraudes crypto retail : rugpulls, exit scams, schémas de pump-and-dump, phishing par drainer, usurpation d'identité, faux services de récupération, et la manipulation au niveau social qui précède habituellement chacun de ces cas. Il aborde ces cas au niveau méthodologique — quoi capturer, comment l'enregistrer, comment raisonner sur le matériau capturé — plutôt qu'à la manière d'une recette propre à un archétype particulier.

### 1.4 Hors-périmètre

Les éléments suivants sont délibérément exclus :

- **Les crimes violents**, y compris l'extorsion, l'enlèvement contre rançon, et le financement de la traite des êtres humains. De tels cas doivent être renvoyés sans délai aux forces de l'ordre et ne se prêtent pas à une enquête civile.
- **Le financement du terrorisme**, encadré par des dispositifs nationaux et internationaux spécifiques (recommandation 5 du GAFI et équivalents) et relevant exclusivement des autorités désignées.
- **Le contournement de sanctions**, qui croise les régimes nationaux et supranationaux de sanctions dont l'interprétation requiert un conseil juridique spécialisé.

Lorsque ces éléments apparaissent au cours d'une enquête qui avait débuté comme un dossier de fraude ordinaire, l'enquêteur doit suspendre les opérations, documenter le déclencheur, et se référer à l'autorité compétente avant de poursuivre.

### 1.5 Résumé de l'avertissement

Ce document est éducatif. Il ne constitue pas un conseil juridique, n'autorise aucune action qui serait elle-même illicite dans la juridiction du lecteur, et ne s'appuie que sur des sources publiques. Un avertissement complet figure en section 12.

## 2. Premiers réflexes — Réception d'un signalement

Le premier contact avec une victime ou un témoin est le moment le plus riche en preuves d'une enquête, et aussi le plus fragile. Le matériau volatil — publications sur les réseaux sociaux, sites web, journaux de discussion, transactions dans la mempool — peut disparaître en quelques heures. La tâche de l'enquêteur dans cette phase est la préservation, non l'analyse.

### 2.1 À faire

- Consigner la date et l'heure exactes du premier contact, en UTC et dans le fuseau local de la victime.
- Capturer le signalement tel quel : transcription écrite ou enregistrement, avec le consentement de la victime.
- Préserver chaque URL citée par la victime, dans son intégralité, y compris les paramètres de requête et les fragments d'ancre.
- Sauvegarder des captures d'écran pleine page de toute surface web mentionnée, avant que le contenu ne soit retiré.
- Collecter toutes les adresses de wallet référencées — wallet de la victime, wallet suspect, wallets intermédiaires — en texte clair, et non sous forme de chaînes affichées tronquées.
- Noter chaque hash de transaction, chaque adresse de contrat de token, et chaque chaîne mentionnée, en identifiant explicitement la chaîne (Ethereum mainnet, Solana mainnet, BNB Smart Chain, Base, Arbitrum One, et ainsi de suite ; l'identification de la chaîne est déterminante).
- Consigner les montants à la fois en unités natives et dans la dénomination du token avancée par la victime, avec le taux de conversion au moment de la perte si connu.
- Noter la plateforme initiale du contact (exchange, réseau social, application de messagerie, site de rencontre, salon de discussion) ainsi que le persona présenté à la victime.
- Prendre une note non clinique de l'état émotionnel de la victime. Les décisions prises sous détresse aiguë devront être contextualisées plus tard.

### 2.2 À ne pas faire

- Ne pas promettre la récupération des fonds. Les taux de récupération dans les fraudes crypto retail sont faibles ; promettre une récupération constitue un risque de revictimisation et peut, dans certaines juridictions, relever de la qualification de tromperie.
- Ne pas annoncer une attribution (« je sais qui est derrière ») avant que les éléments ne le permettent. Une attribution prématurée, même au sein d'une petite équipe, peut compromettre l'enquête et porter atteinte à la personne nommée.
- Ne pas publier des éléments de l'affaire sur les réseaux sociaux. Cela alerte le suspect, contamine les témoins, et peut enfreindre les obligations de protection des données.
- Ne pas contacter directement les suspects présumés. Même un contact courtois peut déclencher la destruction de preuves, peut s'apparenter à du harcèlement selon le droit local, et franchit la frontière entre enquête et action de police.
- Ne pas accéder à des comptes, appareils, ou systèmes qui n'appartiennent pas à l'enquêteur et pour lesquels un accès n'a pas été expressément autorisé. Le faire transforme l'enquêteur en auteur d'une infraction dans la plupart des juridictions.
- Ne pas conserver du matériel sensible (phrases de récupération, pièces d'identité) que la victime pourrait fournir au-delà du strict minimum nécessaire ; lorsqu'il est collecté, il doit être stocké avec une sécurité appropriée et supprimé selon un calendrier défini.

### 2.3 Cinq questions de triage

L'entretien initial peut être ramené à cinq questions dont les réponses structurent tout ce qui suivra :

1. **Quand.** Quand les faits se sont-ils produits ? Quand la perte a-t-elle été constatée ? Quand la victime détenait-elle pour la dernière fois les actifs ?
2. **Où.** Sur quelles plateformes, sites, salons de discussion, ou cadres physiques l'interaction a-t-elle eu lieu ?
3. **Combien.** Quelle est l'ampleur de la perte, exprimée en équivalent fiat au moment des faits et au moment du signalement ?
4. **Qui.** Quelles identités, pseudonymes, noms, ou alias les contreparties ont-elles présentés ?
5. **Comment.** Quel a été le mécanisme apparent — promesse de rendement, approche romantique, offre de récupération, prompt de wallet-connect sur un site, message direct d'un faux support, claim d'airdrop ?

Chaque réponse doit être consignée dans les mots de la victime, l'interprétation de l'enquêteur étant marquée séparément.

### 2.4 Triage de criticité

Une notation initiale de criticité oriente les travaux suivants. La note est provisoire et révisable à mesure que les faits se précisent. La grille ci-dessous combine le montant déclaré et le nombre apparent de victimes ; la plus élevée des deux notations détermine la classification globale.

| Classe   | Montant déclaré par victime (équivalent USD) | Nombre apparent de victimes | Disposition typique |
|----------|----------------------------------------------|------------------------------|---------------------|
| Faible   | Moins de 5 000                                | Une                          | Orientation auto-assistée ; renvoi vers les canaux de protection des consommateurs |
| Moyen    | 5 000 à 50 000                                | Plusieurs (moins de dix)     | Ouverture d'un dossier ; préservation structurée des preuves |
| Élevé    | 50 000 à 500 000                              | Dizaines                     | Ouverture d'un dossier ; coordination envisagée avec les forces de l'ordre |
| Critique | Au-dessus de 500 000, ou inconnu mais plausiblement élevé | Centaines ou non bornées | Escalade immédiate vers les autorités compétentes ; l'enquêteur devient contributeur, non chef de file |

La note doit figurer dans l'en-tête du dossier et être révisée explicitement lorsqu'une nouvelle information lui fait franchir un seuil.

## 3. Préservation des preuves

La préservation des preuves est le socle de tout le reste. Une conclusion n'est utile que dans la mesure où le matériau sous-jacent peut être réinspecté, attribué, et daté. L'hypothèse de travail par défaut est que toute surface web pertinente sera modifiée ou retirée avant la clôture de l'enquête.

### 3.1 Que capturer

- **Captures d'écran pleine page** de chaque page web pertinente, restituant l'intégralité du contenu rendu et non seulement la zone visible. Les outils de développement du navigateur ou les facilités de capture du système d'exploitation suffisent à produire des captures pleine page sans logiciel tiers.
- **Archives web publiques** : soumettre chaque URL pertinente à des services d'archivage publics tels que la Wayback Machine de l'Internet Archive et archive.today. Une soumission produit un instantané daté, hébergé par un tiers, utile en cas de contestation ultérieure.
- **Enregistrements de screencast** pour toute interaction dont le sens dépend d'un comportement temporel (compte à rebours, séquence de boutons, enchaînement de modales). Une vidéo courte capte des éléments qu'aucune capture statique ne peut restituer.
- **Captures de source** : lorsque la page est rendue côté client (applications mono-page lourdes en JavaScript), la sauvegarde du DOM rendu via la fonction « enregistrer sous » du navigateur, accompagnée des ressources chargées, protège contre des modifications ultérieures que les archives risquent de manquer.
- **Exports de conversations** au format natif de la plateforme lorsque disponible ; à défaut, captures d'écran du salon dans leur intégralité, ordonnées chronologiquement.
- **En-têtes d'e-mails** complets, y compris la chaîne de routage, lorsqu'un courriel entre dans le périmètre.

### 3.2 Chaîne de garde

Chaque élément collecté doit être enregistré dans un journal de chaîne de garde comportant au minimum :

- Un identifiant d'élément (une référence séquentielle interne au dossier).
- L'URL source ou la description d'origine.
- L'horodatage de collecte en UTC.
- La méthode de collecte (capture manuelle, service d'archivage, outil d'export).
- Le hash SHA-256 du fichier, calculé immédiatement après la collecte.
- L'emplacement de stockage (chemin ou référence cloud, avec mention des contrôles d'accès).
- L'identité du collecteur (l'enquêteur ayant procédé à la capture).

Le calcul de hash est trivial sur tous les systèmes d'exploitation courants ; l'empreinte hexadécimale qui en résulte est consignée à côté du nom de fichier. Un auditeur ultérieur peut recalculer le hash et confirmer que le fichier n'a pas été modifié. Si le fichier est altéré (par exemple, expurgé avant partage), la version expurgée fait l'objet d'une entrée propre, les deux hashes étant consignés et la relation à l'original explicitement décrite.

### 3.3 Identifiants on-chain

Les adresses de wallet, les hashes de transaction, et les adresses de contrats de tokens doivent être capturés à la fois en texte clair et dans leur contexte d'origine. Une adresse de wallet copiée depuis un tweet est davantage probante si le tweet original est préservé avec l'adresse visible que si l'adresse est extraite isolément.

Chaque transaction d'intérêt doit être consignée avec : hash, chaîne d'origine, hauteur de bloc (ou slot, sur Solana), horodatage, expéditeur, destinataire, valeur, et tout transfert de token déclenché par la transaction. Les block explorers exposent tout cela ; l'enquêteur ne doit pas dépendre de la disponibilité continue de l'explorer — les données sous-jacentes doivent être sauvegardées.

### 3.4 La frontière de légalité

La préservation est la collecte licite d'informations publiques. Ce n'est pas une mission de police. Trois lignes doivent être respectées :

- **Aucun accès non autorisé.** Les pages web publiques, les chaînes publiques, et les contenus que la victime partage volontairement entrent dans le périmètre. Les comptes appartenant à d'autres personnes, même quand les identifiants sont aisément devinables ou ont été partagés, n'y entrent pas.
- **Aucune usurpation.** L'enquêteur ne doit pas adopter une identité fausse pour obtenir des informations auprès de suspects, de victimes, ou de tiers, au-delà du pseudonymat minimal que les plateformes admettent ordinairement.
- **Aucune altération.** La preuve est préservée telle qu'elle est trouvée. Modifier le contenu avant sauvegarde, ou sauvegarder d'une manière qui en obscurcit la provenance, en affaiblit ou en détruit la valeur.

Un dossier qui documente des méthodes de collecte illicites est, dans la plupart des juridictions, pire qu'un dossier vide.

## 4. Collecte d'identifiants on-chain

La seconde phase de collecte convertit une liste de mentions en une carte structurée d'entités on-chain et de leurs relations. Cette phase est mécanique lorsqu'elle est conduite correctement, ambiguë lorsqu'elle est conduite trop vite.

### 4.1 Adresses de wallets

Pour chaque adresse de wallet dans le périmètre, consigner :

- La chaîne sur laquelle elle existe (une adresse qui paraît identique entre chaînes EVM ne désigne pas nécessairement le même acteur).
- S'il s'agit d'un compte externe (EOA) ou d'un smart contract, en inspectant l'adresse sur le block explorer de la chaîne.
- Pour les EOAs : date de première activité, date de dernière activité, total des entrées et sorties en devise native, et les éventuels labels proposés par l'explorer (avec prudence — les labels d'explorer ne sont pas audités).
- Pour les smart contracts : adresse de déploiement, bloc de déploiement, source vérifiée si disponible, et l'ensemble effectif des fonctions du contrat.

### 4.2 Contrats de tokens

Les contrats de tokens méritent une fiche dédiée :

- Adresse, chaîne, symbole, nom, décimales.
- Adresse de déploiement et transaction de déploiement.
- État de vérification de la source sur un block explorer.
- Fonctions notables, en particulier celles affectant l'offre (mint, burn), les transferts (taxes, allow-lists, mises en pause), et la gouvernance (renounceOwnership, transferOwnership, proxies upgradeables).
- Distribution initiale de l'offre : combien d'adresses ont reçu des tokens au déploiement, dans quelles proportions.

### 4.3 Relations entre adresses

L'enquêteur doit construire au minimum :

- **Les transactions directes** : quelles adresses ont envoyé de la valeur ou des tokens à quelles autres, pour quels montants et à quels moments.
- **Les flux indirects via agrégateurs** : lorsque les fonds passent par des mixers, des bridges, ou des services agrégateurs, noter les points d'entrée et de sortie même lorsque le trajet intermédiaire n'est pas reconstituable.
- **Les dépôts vers des plateformes centralisées** : lorsque les fonds atteignent une adresse opérée par un exchange centralisé, un dépositaire, ou un processeur de paiement, noter l'adresse et la plateforme si elle peut être identifiée. Les informations KYC du déposant *ne sont pas* publiques et ne peuvent être obtenues que par voie légale.

### 4.4 Inspection des pools de liquidité

Lorsque l'affaire concerne un token lancé contre un pool de liquidité, l'enquêteur doit consigner :

- L'adresse du pool, la paire qu'il contient, et la chaîne.
- L'adresse ayant fourni la liquidité initiale, les LP tokens reçus, et la localisation actuelle de ces tokens.
- Toute addition ou retrait de liquidité ultérieurs, avec adresses, horaires, et montants.
- Si la position LP est verrouillée (dans un contrat de lock reconnaissable) ou demeure transférable.

Un retrait de liquidité qui coïncide avec un silence des canaux sociaux et un effondrement du prix constitue la signature on-chain d'un rugpull ; la comparaison temporelle doit être précise.

### 4.5 Outillage générique

Les block explorers sont la source primaire canonique pour les données on-chain. Les principaux réseaux EVM (Ethereum, BNB Smart Chain, Polygon, Arbitrum, Base, Optimism) disposent chacun d'au moins un explorer largement utilisé ; Solana a le sien ; les autres écosystèmes ont leurs équivalents locaux. Des plateformes commerciales d'analyse de chaîne existent et offrent un étiquetage au niveau de l'entité et du clustering à l'échelle ; leurs résultats ne sont pas de source publique et doivent être cités avec précaution si utilisés dans un livrable susceptible d'être contesté.

Pour les enquêteurs ne disposant pas d'abonnements à des outils commerciaux, le flux pratique est : block explorer pour les transactions individuelles, accès à un nœud complet (en propre ou hébergé) pour les requêtes par lot, et un ou plusieurs scripts légers de clustering pour la cartographie des relations. Aucun de ces outils n'est nécessaire pour une enquête qui n'exige pas d'affirmations quantitatives sur les flux ; la chronologie simple des adresses nommées suffit souvent.

### 4.6 Public versus non public

Une confusion persistante mérite d'être explicitement cadrée. La chaîne est publique ; les identités derrière les adresses ne le sont pas. Tout ce que l'enquêteur peut dériver des seules données on-chain est en principe reproductible et publiable. Tout ce qui relie une adresse à une identité réelle doit être dérivé soit d'une déclaration publique du titulaire de l'adresse, soit d'une association ayant fait l'objet d'une fuite ou rendue publique d'une autre manière, soit d'une procédure légale. Le dossier doit refléter cette distinction ; confondre données de chaîne et données d'identité est l'erreur méthodologique la plus fréquente dans l'enquête crypto retail.

## 5. Collecte d'identifiants off-chain (OSINT)

La phase off-chain raccorde la carte on-chain à la couche sociale. C'est aussi la phase où le plus grand nombre d'enquêteurs commettent une faute du mauvais côté de la frontière de légalité.

### 5.1 Que collecter

- **Identités du fondateur et de l'équipe** telles que présentées sur le site du projet, sur la page de launchpad, et sur les réseaux professionnels (LinkedIn, GitHub, profils académiques). L'identité présentée est collectée telle quelle ; la vérification suit séparément.
- **Historique des domaines** : enregistrements WHOIS (en tenant compte de la généralisation du masquage par les registrars), historique DNS si disponible, identité du registrar, et archives historiques via les services d'archivage web publics.
- **Présence sur les réseaux sociaux** : comptes du projet, comptes du fondateur, comptes promoteurs. Pour chacun, consigner le handle, le nom affiché, la date de création, le nombre d'abonnés au moment de la collecte, la localisation et les autres métadonnées déclarées, et au minimum les premières et dernières publications visibles.
- **Canaux de messagerie publics** : serveurs Telegram et Discord, avec nom de canal, date de création, liste d'administrateurs (lorsqu'elle est visible), et export chronologique des annonces.
- **Activité promotionnelle** : lorsque des KOLs ont soutenu le projet, capturer les publications correspondantes, leurs dates, et la mention de divulgation qui y est attachée (ou son absence).
- **Couverture presse et références secondaires** : billets de blog, apparitions en podcast, listes de conférences. Ces éléments sont utiles à la fois comme contenu primaire et comme renvois croisés vers les propres affirmations du projet.

### 5.2 La ligne rouge OSINT

L'OSINT, correctement défini, est la collecte structurée d'informations véritablement publiques. Ce n'est pas un euphémisme pour intrusion. Les techniques suivantes *ne sont pas* de l'OSINT et ne doivent pas figurer dans le playbook d'un enquêteur crédible :

- **L'ingénierie sociale** de suspects, de victimes, ou de tiers en vue d'obtenir des informations non publiques.
- **Le SIM swap, le phishing, ou toute technique visant la prise de contrôle d'un compte**, y compris celui d'un suspect. L'enquêteur qui s'y livre devient lui-même auteur d'infraction et perd la protection de toutes les autres sections de ce document.
- **L'exploitation de fuites d'identifiants**, sauf dans des contextes de recherche étroitement définis et autorisés par le conseil juridique.
- **L'accès à des conversations privées** auxquelles l'enquêteur n'a pas été sciemment invité.
- **Le doxxing**, au sens de la publication d'informations personnellement identifiables sur des personnes physiques à des fins de représailles, à distinguer de la consignation de ces informations dans un dossier en vue d'une remise légitime aux autorités.

Aucune technique qui constituerait une infraction si elle était commise par un particulier contre un autre particulier ne devient licite parce que la cible est soupçonnée de fraude. La présomption d'innocence demeure ; le rôle de l'enquêteur est de constituer le dossier, non de rendre un verdict.

### 5.3 Vérification de l'identité du fondateur

Lorsqu'un fondateur est nommé, la vérification s'effectue par confrontation à des traces institutionnelles préexistantes. Une identité authentique laisse en général une piste antérieure au projet : publication académique, inscription au registre du commerce, emploi antérieur corroboré par une institution plutôt que simplement déclaré, photographie de qualité passeport dans un contexte étranger au projet. L'absence de telles traces ne prouve pas la fabrication, mais c'est un élément pertinent à consigner.

Les recherches inversées d'images sur la photographie du fondateur, la comparaison des dates d'emploi déclarées aux registres publics correspondants, et le croisement avec les bases de brevets ou de publications, sont dans le périmètre et licites. Inférer une identité par des moyens qui empièteraient sur des tiers — par exemple en contactant d'anciens employeurs sous un prétexte trompeur — ne l'est pas.

### 5.4 Détection des sockpuppets

La détection d'activité inauthentique coordonnée s'appuie sur des signaux observables : dates de création de compte agglomérées autour d'une fenêtre de lancement, photos de profil dont la recherche inversée renvoie à de la génération par IA ou à des banques d'images, cadence de publication incompatible avec un emploi du temps humain, gabarits lexicaux répétés sur des comptes nominalement indépendants. La précaution méthodologique : les signaux de clustering sont statistiques, non déterministes, et de prétendus sockpuppets peuvent n'être que des admirateurs ordinaires d'un projet. Le dossier doit consigner les observations comme des observations, et non comme des conclusions.

### 5.5 Recoupement avec la carte on-chain

Une phase off-chain productive reviendra sur la section 4 à plusieurs reprises. Un wallet ayant reçu des tokens au déploiement peut appartenir à un compte ayant publiquement soutenu le projet par la suite ; un compte qui publie une adresse de wallet comme adresse de pourboire a lié les deux surfaces. Chaque pont de ce type doit être consigné explicitement et daté.

## 6. Analyse comportementale

La phase comportementale relit ce qui a été collecté à la recherche de motifs récurrents dans les affaires de fraude. L'objectif est de caractériser le cas, non de rendre un jugement.

### 6.1 Catalogue des dark patterns

Un document distinct dans cette série recense quinze motifs d'interface et de discours observés dans les affaires de fraude crypto. L'enquêteur doit s'y référer comme à un vocabulaire contrôlé pour nommer les motifs dans le dossier, plutôt que de redériver les catégories au cas par cas. Les cinq catégories de haut niveau — urgence fabriquée, pression sociale, manipulation technique de l'interface, désinformation financière, manipulation d'identité — couvrent la majeure partie de la surface pertinente.

### 6.2 Promesses de rendement irréalistes

Les éléments marketing promettant des rendements fixes ou élevés (« rendement garanti », « prochain 100x ») sont l'une des signatures les plus fiables. Les observations à consigner incluent la formulation exacte, la date de première apparition, la plateforme sur laquelle elle est apparue, et toute affirmation quantitative (pourcentages, multiples, échéances). L'enquêteur doit résister à la tentation de balayer ces éléments comme simple « emphase commerciale » ; dans de nombreuses juridictions, les promesses de rendement précises dans le contexte d'un produit d'investissement constituent un acte régulé.

### 6.3 Modifications brutales du comportement d'équipe

La signature d'une sortie est opérationnelle : des éléments de roadmap disparaissent, les administrateurs de canaux se taisent ou changent, des publications sont supprimées, de la liquidité est déplacée ou retirée, et les canaux de support clients cessent de répondre. Une reconstitution chronologique de la dernière semaine d'activité du projet révèle souvent un motif reconnaissable. Le dossier doit préserver, sous forme archivée, les surfaces qui disparaissent avant qu'elles ne soient perdues.

### 6.4 Astroturfing et sockpuppets

En reprenant la section 5.4 dans le registre analytique : la démonstration d'astroturfing se construit sur plusieurs signaux faibles, non sur un signal fort. La concentration des dates de création de comptes, la réutilisation lexicale, le chevauchement d'abonnés, l'incohérence des fuseaux horaires de publication, et le déséquilibre entre engagement et portée contribuent chacun. Le dossier doit énumérer les signaux observés et l'inférence opérée, plutôt que d'affirmer la conclusion comme un fait.

### 6.5 Profil de victime

Sans spéculer sur des individus, le dossier peut utilement consigner les vulnérabilités cognitives que l'opération paraît exploiter. Les archétypes courants incluent : la victime « peur de manquer » (rendements promis élevés ; cadrage d'urgence), la victime « déférence à l'autorité » (approbation apparente par une figure respectée), la victime « rattrapage » (perception d'une dernière chance pour récupérer des pertes antérieures), la victime « relation amoureuse » (relation sociale étalée sur plusieurs mois précédant la demande financière), et la victime « arnaque à la récupération » (seconde perte infligée par un acteur prétendant aider à récupérer la première).

Ce profil est descriptif : il caractérise ce que l'opération cible, non ce qui « ne va pas » chez la victime. Le glissement de l'un à l'autre registre est un échec éthique récurrent du champ.

## 7. Construction du dossier

Le dossier d'enquête (casefile) est l'artefact durable produit par l'enquête. La structure ci-dessous est un minimum : elle capture les éléments qui doivent être présents pour que le dossier soit utile à un tiers — successeur, avocat, journaliste, autorité — qui n'a pas participé au travail original.

### 7.1 C1 — Identification

- Nom du projet, ticker, adresse de mint ou de contrat.
- Chaîne(s) sur lesquelles le projet opère.
- Date de première observation ; date de signalement ; date présumée de sortie, si connue.
- Plateformes sur lesquelles le projet a été promu.

### 7.2 C2 — Chronologie

Un tableau daté des événements : création du projet, débuts sur les réseaux sociaux, presale, événement de génération du token, ajout de liquidité, pic d'activité, anomalies, sortie suspectée, signalements publics. Chaque événement est daté en UTC lorsque possible, et la source de la date est citée (une page archivée, un hash de transaction, une publication publique).

### 7.3 C3 — Acteurs

- **Équipe du projet** : noms présentés, handles sur les réseaux sociaux, traces institutionnelles corroborantes (ou leur absence).
- **Promoteurs** : KOLs, avec handles, dates des publications pertinentes, et statut de divulgation.
- **Victimes** : numérotées et anonymisées. Le dossier ne doit jamais identifier les victimes par leur nom dans un document susceptible d'être partagé. Un registre séparé et soumis à contrôle d'accès peut conserver, pour la durée nécessaire à l'enquête, le lien entre numéros de cas et identités.

### 7.4 C4 — Flux on-chain

La carte structurée produite en section 4 : wallets, transactions, contrats de tokens, activité de pool, et les relations entre ces éléments. Lorsque le dossier formule une affirmation quantitative (entrée totale, perte totale, part du bénéficiaire), les transactions sous-jacentes sont citées.

### 7.5 C5 — Flux off-chain

Le matériau structuré de la section 5 : domaines, comptes de réseaux sociaux, exports de canaux, couverture presse. Chaque artefact est référencé par son identifiant de chaîne de garde plutôt que ré-inclus dans le récit ; le dossier est l'index, le dépôt de preuves est le stockage.

### 7.6 C6 — Motifs détectés

Les motifs nommés issus de la section 6 que le cas présente, avec les éléments spécifiques qui les étayent. Un motif n'est pas affirmé sans éléments ; s'il est suspecté mais non étayé, il est consigné comme hypothèse en attente de vérification.

### 7.7 C7 — Estimation des pertes

L'estimation des pertes est la section où l'humilité méthodologique importe le plus. Une estimation défendable distingue les sorties brutes des wallets de victimes, les sorties nettes après récupération de prix, et le produit effectif de l'opérateur, qui peut différer des deux précédents. Le dossier doit :

- Définir la mesure de perte employée.
- Citer la source de prix et l'horodatage auquel les prix ont été relevés.
- Fournir un intervalle plutôt qu'une estimation ponctuelle lorsque les données sont éparses.
- Noter les hypothèses, en particulier sur la question de savoir si les transactions sont nettes du slippage et des frais, et si le volume on-chain inclut du wash trading.

### 7.8 C8 — Recommandations

Les recommandations adressées aux victimes sont descriptives des options qui existent dans leur juridiction. Les éléments possibles incluent : les canaux de signalement (section 9), la possibilité de consulter un conseil, les associations d'aide aux victimes, et le fait opérationnel que les taux de récupération sont faibles et que les nouveaux « services de récupération » sollicitant la victime sont eux-mêmes typiquement frauduleux.

Le dossier ne dirige pas les victimes ; il présente des options. La ligne entre informer et conseiller dépend de la juridiction et doit être respectée.

## 8. Limites méthodologiques et red flags

### 8.1 Biais de confirmation

L'erreur la plus courante en enquête consiste à construire une théorie tôt puis à collecter le matériau qui la conforte. La discipline de la réfutation — chercher activement les éléments qui invalideraient la théorie de travail — en est l'antidote pratique. Un dossier qui ne comporte pas de section sur les éléments examinés puis écartés est incomplet.

### 8.2 Attribution

« Wallet contrôlé par X » n'est pas équivalent à « wallet utilisé par X ». Les adresses se prêtent, se font compromettre, sont phishées, échangées comme accessoires, et opérées par des services pour le compte d'utilisateurs. Une attribution qui repose sur un signal unique est fragile ; une attribution qui repose sur plusieurs signaux, chacun vérifiable indépendamment, est durable. Le dossier doit étiqueter ses attributions sur cette échelle et éviter l'apparence d'une certitude qu'il n'a pas méritée.

### 8.3 Reconstruction des prix

Les prix historiques de tokens peu liquides sont difficiles à recouvrer fidèlement. Les API d'agrégation peuvent diverger ; la reconstruction on-chain demande une gestion soignée du slippage, des frais, et de la MEV ; les volumes rapportés intègrent fréquemment du wash trading. Les estimations de perte qui dépendent du prix sont nécessairement des intervalles ; le dossier doit les exprimer comme tels.

### 8.4 Identité erronée

Les identités réelles sont régulièrement confondues sur le terrain : homonymes, handles similaires, photographies réutilisées, identités elles-mêmes compromises ou assumées par un tiers sans rapport. Lorsque le dossier nomme un individu, l'enquêteur doit être prêt à défendre l'attribution contre la contestation la plus rigoureuse.

### 8.5 L'enveloppe éthique

Une enquête publique mal calibrée peut blesser un innocent. Les enquêteurs sont tenus à un devoir de prudence qui survit à la force de leur croyance dans la théorie de travail. La rigueur ici n'est pas un ornement procédural ; c'est l'obligation éthique qui distingue l'enquête de l'accusation.

## 9. Signalement et orientation des victimes

### 9.1 Canaux de signalement par juridiction

Le tableau ci-dessous liste les principaux canaux de signalement de première ligne dans des juridictions choisies. Il n'est pas exhaustif ; le lecteur doit vérifier chaque entrée par rapport aux supports en vigueur de l'autorité concernée, les noms et les compétences des agences évoluant.

| Juridiction | Signalement principal de fraude | Conduite liée aux titres financiers | Blanchiment / cellule de renseignement financier |
|-------------|--------------------------------|--------------------------------------|----------------------------------------------------|
| France      | Procureur de la République ; PHAROS (contenus en ligne) ; SignalConso | Autorité des marchés financiers (AMF) | Tracfin |
| Allemagne   | Police locale ; unités centrales cybercriminalité (LKA) | Bundesanstalt für Finanzdienstleistungsaufsicht (BaFin) | Financial Intelligence Unit (Zoll-FIU) |
| Italie      | Polizia Postale ; Carabinieri | Commissione Nazionale per le Società e la Borsa (CONSOB) | Unità di Informazione Finanziaria (UIF) |
| Espagne     | Policía Nacional ; Guardia Civil GDT | Comisión Nacional del Mercado de Valores (CNMV) | SEPBLAC |
| Royaume-Uni | Action Fraud | Financial Conduct Authority (FCA) | National Crime Agency (NCA) |
| Pays-Bas    | Politie ; Fraudehelpdesk | Autoriteit Financiële Markten (AFM) | FIU-Nederland |
| États-Unis  | FBI Internet Crime Complaint Center (IC3) ; Federal Trade Commission (FTC) | Securities and Exchange Commission (SEC) ; Commodity Futures Trading Commission (CFTC) | Financial Crimes Enforcement Network (FinCEN) |
| Canada      | Centre antifraude du Canada (CAFC) | Autorités provinciales en valeurs mobilières | CANAFE / FINTRAC |
| Australie   | Scamwatch ; ReportCyber | Australian Securities and Investments Commission (ASIC) | AUSTRAC |
| Suisse      | Police cantonale ; Centre national pour la cybersécurité (NCSC) | Eidgenössische Finanzmarktaufsicht (FINMA) | MROS |
| Singapour   | Singapore Police Force | Monetary Authority of Singapore (MAS) | Suspicious Transaction Reporting Office |
| Japon       | National Police Agency Cyber Bureau | Financial Services Agency (FSA) | Japan Financial Intelligence Center (JAFIC) |

La coordination au niveau de l'Union européenne est assurée par l'ESMA sur les questions de titres financiers et par Europol sur la grande criminalité transfrontalière ; aucune des deux ne reçoit directement les signalements individuels des victimes.

### 9.2 Associations d'aide aux victimes

Plusieurs organisations à but non lucratif dédiées aux victimes de fraude crypto opèrent sur les marchés principaux. Elles fournissent typiquement une orientation initiale, un soutien par les pairs, et une mise en relation avec un conseil spécialisé. Leur existence est mentionnée ici sans en nommer aucune en particulier, car cette population est mouvante et une liste à jour à la date de publication a peu de chances de le rester. L'enquêteur doit tenir à jour une liste locale en dehors de ce document.

### 9.3 Avertissement sur l'arnaque à la récupération

Les victimes ayant déjà subi une perte sont en risque accru d'être ciblées à nouveau par des acteurs prétendant récupérer ces fonds. Le motif est suffisamment répandu pour que les recommandations du dossier le mentionnent explicitement, avec l'indication pratique que la récupération légitime n'exige normalement pas de paiement préalable, ni le partage de phrases de récupération, ni un accès à distance aux wallets.

### 9.4 Limites

Le signalement ouvre une procédure ; il ne garantit pas un résultat. L'enquêteur qui conseille une victime doit calibrer ses attentes avec honnêteté : la plupart des affaires de fraude crypto retail ne produisent aucune récupération, même lorsqu'elles sont signalées rapidement et correctement. Un dossier non poursuivi reste néanmoins une contribution au registre public et à la prévention des récidives.

## 10. Glossaire

**Astroturfing.** Activité coordonnée de comptes présentés comme indépendants, conçue pour manufacturer une apparence de consensus organique.

**Attribution.** Le rattachement raisonné d'une action, d'une adresse, ou d'un artefact, à un acteur déterminé ; en pratique toujours une affirmation probabiliste, jamais une certitude.

**Block height (hauteur de bloc).** Le numéro séquentiel d'un bloc au sein de sa chaîne, employé comme substitut d'horodatage stable.

**Casefile (dossier d'enquête).** Le registre structuré d'une enquête, incluant chronologie, acteurs, renvois aux preuves, et conclusions analytiques.

**Chain analysis (analyse de chaîne).** L'étude structurée des graphes de transactions blockchain, incluant le regroupement d'adresses en entités et le suivi des flux.

**Chain of custody (chaîne de garde).** La séquence documentée des personnes ayant possédé un élément de preuve et des moments où elles l'ont possédé, suffisante pour démontrer que l'élément n'a pas été altéré entre la collecte et la présentation.

**Doxx.** La divulgation d'une identité réelle derrière une présence pseudonyme en ligne. Documenter une identité dans un dossier d'enquête est distinct de la publier à des fins de représailles ; ce dernier sens est celui que recouvre habituellement le terme dans l'usage courant.

**Drainer.** Une catégorie de smart contract ou de script malveillant qui, une fois autorisé par une signature de la victime, transfère la valeur hors du wallet de celle-ci.

**Dusting.** L'envoi d'un montant trivial de token à de nombreuses adresses, souvent comme tactique pour suivre les liens entre wallets ou pour amorcer une opération de phishing.

**EOA.** Externally-owned account ; une adresse blockchain contrôlée par une clé privée, par opposition à une adresse de smart contract.

**Hash.** Empreinte de longueur fixe d'une entrée arbitraire, employée ici à la fois comme identifiant cryptographique de fichiers de preuves (typiquement SHA-256) et de transactions (le hash de transaction).

**KOL.** Key opinion leader ; un compte à forte portée dont les approbations influencent les abonnés.

**LP.** Liquidity provider, ou par extension le LP token représentant une créance sur les réserves d'un pool de liquidité.

**MEV.** Maximal extractable value ; la valeur captée en réordonnant, incluant, ou excluant des transactions à l'intérieur d'un bloc.

**Mixer.** Un protocole qui mutualise les dépôts de nombreux utilisateurs et les redistribue à des adresses nouvelles, dans l'intention de briser le lien public entre source et destination.

**OSINT.** Open-source intelligence ; la collecte structurée d'informations véritablement publiques à des fins d'enquête.

**Peeling chain (chaîne d'épluchage).** Un motif de transferts successifs dans lequel un wallet envoie l'essentiel de son solde à une adresse fraîche et le reliquat à une autre adresse, motif répété ; il est associé à l'obfuscation de flux importants.

**Plain sight (vue publique).** Registre descriptif pour les preuves accessibles sans intrusion : publications publiques, chaînes publiques, registres publics.

**Red team.** Perspective dans laquelle un analyste cherche délibérément à invalider une hypothèse de travail.

**Retail.** Participants individuels non professionnels aux marchés financiers, par contraste avec les participants institutionnels.

**Slippage.** L'écart entre le prix annoncé pour un swap et celui auquel il est effectivement exécuté ; le slippage admis est une permission accordée au contrat de routage.

**Smart contract.** Code déployé sur une blockchain s'exécutant de manière déterministe lorsqu'invoqué ; fonctionnellement distinct d'un compte externe.

**Sockpuppet.** Un compte opéré par un acteur distinct de l'identité présentée.

**Txhash.** Hash de transaction ; l'identifiant unique d'une transaction confirmée sur une blockchain.

## 11. Références

Les références suivantes sont citées dans le playbook ou dans la taxonomie des dark patterns qui lui est étroitement liée. Le lecteur est encouragé à vérifier leur actualité et à consulter les sources primaires directement ; lorsque des documents institutionnels sont référencés, le nom de l'institution constitue le localisateur faisant foi.

1. Brignull, H. (2010). *Dark Patterns* (originellement darkpatterns.org, désormais deceptive.design). Traitement fondateur du terme utilisé en section 6.
2. Parlement européen et Conseil. (2022). *Règlement (UE) 2022/2065 relatif à un marché intérieur des services numériques (Digital Services Act)*. Article 25 sur les dark patterns.
3. Parlement européen et Conseil. (2023). *Règlement (UE) 2023/1114 sur les marchés de crypto-actifs (MiCA)*. Obligations relatives aux communications marketing.
4. Groupe d'action financière (GAFI). (2021). *Updated Guidance for a Risk-Based Approach to Virtual Assets and Virtual Asset Service Providers*. FATF.
5. Federal Trade Commission. (2022, septembre). *Bringing Dark Patterns to Light*. FTC Staff Report.
6. Mathur, A., Acar, G., Friedman, M. J., Lucherini, E., Mayer, J., Chetty, M., & Narayanan, A. (2019). *Dark Patterns at Scale: Findings from a Crawl of 11K Shopping Websites*. Proceedings of the ACM on Human-Computer Interaction, CSCW.
7. Mathur, A., Kshirsagar, M., & Mayer, J. (2021). *What Makes a Dark Pattern... Dark? Design Attributes, Normative Considerations, and Measurement Methods*. Proceedings of the 2021 CHI Conference.
8. Europol. *Internet Organised Crime Threat Assessment (IOCTA)*, éditions annuelles. Publications d'Europol.
9. Eurojust. *Report on Eurojust's Casework on Crypto Assets*. Publications d'Eurojust.
10. OCDE. (2022). *Dark commercial patterns*. OECD Digital Economy Papers, n° 336.

Des références complémentaires sur l'analyse de chaîne et la méthodologie d'enquête on-chain sont disponibles dans la littérature académique sur la criminalistique des cryptomonnaies ; le lecteur entreprenant des travaux quantitatifs gagnera à consulter cette littérature directement plutôt qu'à s'appuyer sur des résumés intermédiés.

## 12. Avertissement

Ce document est éducatif. Il décrit une méthodologie et ne nomme aucune entité, projet, personne, ou affaire spécifiques. Il ne constitue pas un conseil juridique, n'autorise aucune action qui serait illicite dans la juridiction du lecteur, et ne se substitue pas aux procédures institutionnelles d'une autorité.

Les canaux de signalement listés en section 9 étaient supposés à jour à la date de publication ; les noms et compétences des agences changent, et il revient au lecteur de confirmer les coordonnées actuelles avant tout usage opérationnel des listes.

Les renvois aux cadres juridiques (Digital Services Act, MiCA, recommandations du GAFI, et autres) sont synthétiques par nature et ne se substituent ni à la lecture des textes sous-jacents ni à un avis émis par un conseil qualifié dans la juridiction concernée.

L'enquêteur qui applique ce playbook le fait sous sa propre responsabilité. Les auteurs déclinent toute responsabilité quant aux conséquences de son usage ou de son mauvais usage.

INTERLIGENS Research, 2026. Sous licence Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0). Autorisé à être redistribué et adapté à des fins non commerciales avec attribution.
