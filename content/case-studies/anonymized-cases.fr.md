---
title: "Études de cas — Fraudes crypto anonymisées et fictionnalisées"
authors: ["INTERLIGENS Research"]
version: "1.0"
date: "2026-05-23"
status: "draft"
license: "CC BY-NC 4.0"
audience: ["enquêteurs", "chercheurs", "journalistes", "étudiants", "formateurs"]
abstract: "Quatre études de cas fictives illustrant des schémas récurrents de fraude crypto : un rugpull sur token, un exit scam centralisé, un pump-and-dump orchestré et une campagne de phishing par drainer. Tous les noms, adresses, dates et montants sont inventés. Les cas sont construits à partir de schémas documentés dans la littérature académique et d'incidents publiquement rapportés, mais aucun cas dans ce document ne reproduit, ne représente ou n'évoque une enquête réelle spécifique. Les études sont conçues pour un usage pédagogique aux côtés du whitepaper Dark Patterns, de la Checklist d'investigation et du Glossaire OSINT-Crypto."
---

## 1. Préface méthodologique

Les quatre études rassemblées dans ce document sont fictives. Chaque nom de projet, chaque nom de plateforme, chaque identifiant social, chaque adresse de portefeuille, chaque empreinte de transaction, chaque montant en dollar et chaque date a été inventé à des fins d'illustration pédagogique. Aucun cas présenté ici ne représente, ne reproduit ou n'évoque une enquête réelle spécifique, qu'elle soit interne à l'institution éditrice ou déjà discutée dans le domaine public. Les compositions s'appuient sur des schémas documentés dans la littérature académique et réglementaire (voir références) et sur la phénoménologie générale de la fraude crypto retail telle qu'elle a été rapportée par l'industrie, par les autorités de protection des consommateurs et par les agences de répression compétentes. Ce ne sont pas des récits déguisés.

Le choix de la fictionnalisation, plutôt que celui de l'anonymisation de cas réels, est délibéré. Les cas réels anonymisés portent une identifiabilité résiduelle : une date, un symbole de token, une chaîne d'intermédiaires ou un montant peuvent suffire à ré-identifier un projet, une équipe ou une victime, particulièrement dans un écosystème restreint. La ré-identification peut exposer les victimes à un renouvellement du harcèlement, exposer les enquêteurs à des contestations juridiques de la part de parties nommées (dont certaines pourront ultérieurement être disculpées), et exposer l'institution éditrice à un risque de diffamation. Des cas entièrement fictifs contournent ces écueils sans perdre leur valeur pédagogique, à condition que les schémas sous-jacents soient fidèles.

Les cas qui suivent ont été construits en sélectionnant un schéma cible, en tirant son anatomie structurelle de la littérature documentée, puis en peuplant les emplacements — acteurs, infrastructure, chronologie, montants — avec des paramètres inventés. Les paramètres ont été choisis pour rester plausibles à l'échelle de la fraude crypto retail : des sommes modestes, de l'ordre du bas à moyen six chiffres en équivalent dollar, de petites équipes nommées, des écosystèmes ressemblant approximativement au triangle DEX/CEX/médias sociaux sur lequel se déploie effectivement la majorité de la fraude retail. Les sommes en centaines de millions et les chronologies se mesurant en journées de saturation médiatique relèvent d'une autre catégorie d'événements et ne serviraient pas l'objectif pédagogique.

Les cas ne prétendent pas être exhaustifs. Un rugpull, un exit scam, une opération de pump-and-dump ou une campagne de drainer réels sont presque toujours plus enchevêtrés qu'un cas écrit ne peut le restituer. Plusieurs schémas coexistent, les éléments de preuve arrivent fragmentairement, et certains éléments qui paraissent centraux rétrospectivement étaient invisibles en temps réel. Un lecteur qui traiterait ces cas comme des gabarits plutôt que comme des illustrations ne deviendrait pas un meilleur enquêteur. Ils sont conçus comme un vocabulaire, non comme un manuel.

Les quatre cas sont conçus pour être lus aux côtés du whitepaper *Dark Patterns in Crypto*, du playbook *Investigation Checklist* et du *Glossaire OSINT-Crypto* produits dans la même série. Lorsque ce document utilise un numéro d'entrée (par exemple #36), la référence renvoie au *Glossaire* ; un symbole de section (par exemple §A.1) renvoie au whitepaper *Dark Patterns* ; un numéro de section (par exemple §5.4) renvoie à la *Checklist d'investigation*. La clause de non-responsabilité figurant en section finale s'applique à l'ensemble du document.

---

## 2. Comment lire ces cas

Chacun des quatre cas suit une structure interne identique, conçue pour refléter la séquence de dossier proposée en §7 de la *Checklist d'investigation* :

1. **Contexte** — quel type de projet, quel écosystème, quel public.
2. **Chronologie** — la séquence des événements observables, donnée à la précision pertinente pour le schéma (typiquement des semaines ou des mois, non des minutes).
3. **Acteurs** — les entités nommées visibles dans le cas (toutes inventées), avec le rôle de chacune.
4. **Indices on-chain** — portefeuilles, contrats, pools de liquidité, motifs de transaction. Toutes les adresses et empreintes de transaction présentées sont fictives ; le format est correct (base58 Solana ou hex EVM) mais les valeurs ne correspondent à aucune adresse réelle.
5. **Indices off-chain** — activité sur les réseaux sociaux, supports marketing, communications hors plateforme, signalements de victimes. Les publications et messages sont reformulés ; aucune capture d'écran revendiquée n'est reproduite.
6. **Schémas détectés** — correspondance explicite avec la taxonomie *Dark Patterns*, plus références aux entrées de glossaire pertinentes.
7. **Leçons pédagogiques** — trois à cinq enseignements formulés comme heuristiques de reconnaissance ou précautions méthodologiques, non comme conseils à un acteur spécifique.

Les quatre cas se situent en 2024-2025. La précision temporelle est volontairement grossière (un trimestre, un mois, occasionnellement une semaine) afin d'éviter tout alignement fortuit avec un événement réel. Le lecteur ne doit pas tenter de projeter la chronologie sur un calendrier réel ; si une date paraît coïncider avec un incident réel, la coïncidence est un artefact des fenêtres temporelles larges utilisées.

---

## 3. Cas 1 — « Le token PhotonGarden : un rugpull classique avec retrait de liquidité »

### 3.1 Contexte

PhotonGarden était un memecoin fictif sur Solana émis au milieu de l'année 2024, sous le ticker $PGRD. Le projet se présentait comme un « micro-écosystème DeFi à thème solaire », étiquette caractéristique de la période : une identité thématique suffisante pour occuper quelques semaines d'attention sur les réseaux sociaux sans s'engager sur aucune feuille de route technique précise. Les canaux officiels du projet se résumaient à un site web monopage, un compte X, un canal de diffusion Telegram et un serveur Discord avec un seul salon ouvert.

L'équipe était pseudonyme. Le site listait trois prénoms — Kai, Solenn et Ravi — sans patronymes, sans photographies vérifiées par croisement avec un dossier institutionnel, et sans aucun parcours public antérieur à l'annonce du token. Le contrat était déployé sur Solana ; le token était négociable via le principal teneur de marché automatisé Solana, désigné dans ce cas comme « l'AMM principal » pour éviter de nommer le lieu spécifique, ce qui est indifférent au schéma.

Le public retail était estimé, sur la base des portefeuilles uniques ayant interagi avec le pool de liquidité, à environ 1 400 à 1 800 adresses distinctes. L'exposition retail agrégée a culminé à environ 380 000 USD en dépôts de liquidité, plus une estimation de 220 000 USD en achats au comptant routés via l'AMM mais jamais déposés en liquidité. Ces chiffres sont fictifs mais ont été choisis pour refléter l'échelle à laquelle opère typiquement un rugpull de petite ampleur sur un cycle unique.

### 3.2 Chronologie

La chronologie visible s'est déroulée sur environ six semaines.

- **Semaine 1** (début Q3 2024). Le compte X a publié son premier message, une image teaser et une accroche. Trois comptes pseudonymes ont commencé à amplifier le teaser dans les heures qui ont suivi. Le site web est devenu accessible.
- **Semaines 2-3.** Publications quotidiennes établissant l'identité thématique du projet. Un widget de compte à rebours sur le site affichait « Lancement du token dans 9 jours » et décrémentait en continu, y compris au-delà de la date annoncée de 48 heures supplémentaires après un « retard technique ».
- **Semaine 3, tardive.** Token déployé sur Solana. Pool de liquidité initialisé sur l'AMM principal. Le portefeuille équipe a conservé une fraction de l'offre pour « marketing et incitations communautaires ».
- **Semaine 4.** Publications promotionnelles coordonnées d'environ une douzaine de comptes X de taille moyenne dans une fenêtre de 36 heures. Le prix du token est monté d'environ 14× par rapport au prix initial AMM.
- **Semaine 5.** Seconde vague promotionnelle issue d'un cluster de comptes différent. Le prix a atteint un sommet apparent. L'équipe a annoncé une « expansion d'écosystème » — un module de staking — sans publier le contrat correspondant.
- **Semaine 6, milieu de semaine.** Dans une fenêtre d'environ quatre-vingt-dix minutes, le portefeuille équipe a exécuté trois transactions : (a) un retrait des LP tokens qu'il contrôlait, (b) un échange de ces LP tokens pour les actifs de base sous-jacents, (c) un transfert des actifs de base vers deux portefeuilles intermédiaires qui se sont ensuite fragmentés sur plusieurs adresses.
- **Semaine 6, soirée.** Le compte X est passé au silence. Le site web a renvoyé une erreur 503 sous douze heures. Le canal Telegram a été supprimé sous vingt-quatre heures.

### 3.3 Acteurs

Trois identités pseudonymes sur les réseaux sociaux ont joué des rôles visibles. Tous les pseudonymes ci-dessous sont inventés et ne devraient pas être projetés sur un compte réel ; les noms ont été choisis suffisamment inhabituels pour qu'une collision fortuite avec un compte réel soit improbable.

- **@photon_forge_dev** — présenté comme développeur principal du projet. A publié les adresses de contrats, les annonces de pool de liquidité et les mises à jour techniques. La cadence de publication et les choix lexicaux étaient globalement cohérents avec un opérateur unique, bien qu'aucune analyse stylométrique formelle n'ait été entreprise.
- **@stellar_anchor_oracle** — un compte promotionnel d'environ 31 000 abonnés au moment de l'engagement, se présentant comme commentateur indépendant. Les publications promotionnelles durant la fenêtre de lancement ne portaient pas de mention de parrainage.
- **@nebula_ribbon_seven** — un compte plus petit d'environ 4 200 abonnés, actif comme modérateur dans le canal Telegram du projet. L'historique de publication du compte avait commencé environ trois semaines avant le premier teaser du projet.

Un quatrième groupe d'environ huit comptes a amplifié les publications pendant les deux vagues promotionnelles. Leurs motifs de publication — heures d'activité chevauchantes, gabarits lexicaux partagés, engagement quasi simultané sur les mêmes publications — sont cohérents avec la signature d'astroturfing décrite en §B.1 du whitepaper *Dark Patterns* et à l'entrée #6 du glossaire.

### 3.4 Indices on-chain

Les adresses suivantes sont fictives et présentées dans le format base58 correct de Solana mais avec des valeurs aléatoires. Elles ne correspondent à aucun portefeuille réel.

- **Trésorerie équipe (présumé déployeur)** : `7Hk8nP3xR9wK4LmDvQ2tBjNcF5gYpTzMaWeXrSyVuJzA`
- **Déployeur LP (à usage unique)** : `5kQ7fyBhXpRtNvCMaWLbqRzPTk2HnUsVgyKpMcFzdRcX`
- **Premier portefeuille intermédiaire de balayage** : `7gMxqFbWPyKnL4ZtBxRsDvVcJpHeUgSnYwFaErTzkLqM`
- **Second portefeuille intermédiaire de balayage** : `8hRtXjLpMaKzNvDwCqBeFvGsHnYrLpTkMcWnQpSrZxYa`

Le schéma visible on-chain suivait la forme canonique du rugpull (#36) : liquidité fournie par le portefeuille équipe, sans contrat de verrouillage temporel ; LP tokens conservés dans la même adresse externe ayant déployé le token ; une fonction d'administration sur le contrat du token permettant d'exclure des adresses arbitraires du chemin de vente, qui n'a pas été exercée mais demeurait disponible ; un événement unique observé de retrait de LP suivi d'un échange immédiat et d'une dispersion en peeling chain (#55) à travers deux puis quatre portefeuilles.

Une heuristique de clustering (#53) appliquée rétrospectivement aux portefeuilles intermédiaires les a regroupés, avec un niveau de confiance élevé, en un opérateur unique. L'historique antérieur du cluster, dans la mesure où il était visible, ne correspondait à aucun cluster étiqueté publiquement.

### 3.5 Indices off-chain

L'empreinte sur les réseaux sociaux comprenait environ 240 publications sur la fenêtre de six semaines visible, réparties entre le compte de l'équipe et les trois identités pseudonymes décrites ci-dessus. Deux vagues promotionnelles ont concentré environ 60 % de l'engagement externe total.

Trois schémas ont été remarquables hors chaîne :

- **Regroupement lexical.** Les publications promotionnelles durant les deux vagues partageaient un ensemble récurrent de formulations inhabituelles : un slogan particulier de quatre mots, une combinaison d'émojis spécifique, et une préférence stylistique pour les points de suspension après les annonces de prix. Ce regroupement est l'une des signatures reconnues d'astroturfing décrites en §B.1 et au §5.4 de la *Checklist d'investigation*.
- **Synchronisation de l'engagement.** Les réponses et les republications avec citation à l'annonce de lancement du projet se sont regroupées dans une fenêtre de 90 secondes, ce qui est cohérent avec une activation coordonnée mais ne constitue pas en soi une preuve de coordination.
- **Dérive de la feuille de route.** La feuille de route du site web a été éditée au moins trois fois durant la fenêtre visible. Les éléments initiaux (« listing CEX », « audit par cabinet nommé ») ont été retirés au fil des versions successives et remplacés par des éléments moins précis (« partenariats d'écosystème », « expansion Phase 2 »). Le cabinet d'audit initialement nommé n'a jamais été contacté, d'après une réponse publique du cabinet.

### 3.6 Schémas détectés

Le cas se cartographie sur la taxonomie *Dark Patterns* comme suit :

- **§A.1 Fake Countdown.** Le widget de compte à rebours du lancement a continué au-delà de la date annoncée et a été réinitialisé sans accusé de réception.
- **§A.3 FOMO Triggers.** Plusieurs publications ont utilisé une formulation de rareté (« 500 premiers portefeuilles », « fenêtre limitée ») sans corrélat on-chain.
- **§B.1 Astroturfing.** Vagues promotionnelles coordonnées avec signatures lexicales et temporelles caractéristiques d'une amplification par opérateur unique.
- **§B.2 KOL-Orchestrated FOMO.** Comptes de taille moyenne publiant sans mention durant la fenêtre de lancement.
- **§D.1 Bait-and-Switch Roadmap.** Des éléments de feuille de route ont été discrètement supprimés et remplacés.

Entrées de glossaire pertinentes : #5 Sockpuppet, #6 Astroturfing, #36 Rugpull, #53 Clustering, #55 Peeling chain, #61 KOL, #66 Influencer.

### 3.7 Leçons pédagogiques

- **Le verrouillage de liquidité n'est pas une garantie, mais son absence en est presque toujours une.** Un pool de liquidité dont les LP tokens sont détenus dans une adresse externe contrôlée par un déployeur pseudonyme constitue une condition préalable à la forme canonique du rugpull. L'absence de contrat de LP verrouillé doit être consignée comme un risque structurel avant toute autre considération.
- **Les éditions de feuille de route laissent des traces.** L'archive web d'une feuille de route de projet, capturée de manière incrémentale, est l'un des artefacts off-chain les plus informatifs. La présence d'un élément « cabinet d'audit nommé » qui disparaît, suivi du silence du cabinet nommé, est le schéma §D.1 dans sa forme la plus lisible.
- **Les signatures d'astroturfing sont stylistiques avant d'être techniques.** La coordination est détectable dans les choix lexicaux et les motifs temporels avant qu'aucune API de plateforme ne soit requise. Un lecteur qui repère le même slogan de quatre mots dans douze comptes en une heure dispose déjà d'une hypothèse de travail.
- **La première tâche de l'enquêteur est la reconstruction, non l'imputation.** Le dossier qui résulte de ce type d'enquête doit décrire le schéma, non affirmer l'intention de l'équipe. L'intention est une question probatoire pour l'autorité compétente ; le schéma est une question méthodologique pour l'enquêteur.

---

## 4. Cas 2 — « Kalyssa Exchange : un exit scam centralisé »

### 4.1 Contexte

Kalyssa Exchange était une plateforme fictive d'échange de cryptomonnaies centralisée présentée comme implantée dans une zone franche du Golfe et opérant sous une licence émise par une petite juridiction caribéenne offshore. Son token natif, $KLSX, était négocié sur sa propre plateforme et sur un petit nombre de lieux secondaires. La plateforme a opéré pendant environ quatorze mois entre le milieu 2024 et le milieu 2025 avant que les retraits ne soient suspendus.

Kalyssa s'est commercialisée principalement auprès d'un public retail latino-américain hispanophone atteint par des communautés Telegram de trading hispanophones et par promotion payante sur une plateforme sociale majeure visant la même audience régionale. À son pic, la plateforme revendiquait environ 47 000 utilisateurs vérifiés et un volume d'échange spot sur 24 heures de l'ordre du haut million de dollars en équivalent. Ces chiffres, fournis par la plateforme elle-même, n'ont jamais été audités par un tiers.

Le modèle économique annoncé combinait du trading au comptant, des contrats à terme à effet de levier sur un petit ensemble de paires, un produit « yield » versant un rendement annuel délibérément modéré de 4,2 % aux déposants — positionné comme une « alternative compliance-grade » aux taux plus élevés prévalant chez ses concurrents — et un produit complémentaire distinctif : un programme de « futures sur vins de garde » tokenisés offrant une exposition fractionnée à des bouteilles millésimées prétendument détenues dans un entrepôt sous douane, accessible via un sous-token de garde. Ces deux produits ont alimenté l'essentiel de la croissance des dépôts à partir du mois quatre environ et constituent les deux éléments centraux du cas.

*La combinaison des juridictions, du type de produit, du public retail et de la chronologie utilisée dans ce cas est synthétique et délibérément composite ; elle est construite pour illustrer un schéma, et non pour évoquer une plateforme réelle précise.*

### 4.2 Chronologie

La chronologie visible s'est déroulée sur environ quatorze mois.

- **Mois 1-3.** Lancement discret de la plateforme. Onboarding KYC mis en œuvre via un service tiers de vérification d'identité. Le marketing initial mettait l'accent sur la conformité multi-juridictionnelle et des « standards d'audit de premier rang ».
- **Mois 4-6.** Campagne de croissance agressive. Le produit yield a été lancé à environ 4,2 % APY, présenté comme financé par « activité de tenue de marché et frais de plateforme » et positionné comme produit « compliance-grade » distingué par son taux « mesuré ». Le programme de futures sur vins de garde a été lancé en parallèle, offrant une exposition fractionnée tokenisée à des bouteilles prétendument inventoriées dans un entrepôt sous douane référencé uniquement dans le matériel marketing. Apparitions promotionnelles à deux conférences industrielles (nommées dans les communications de la plateforme, ni l'une ni l'autre n'ayant confirmé la présence de Kalyssa en tant que sponsor).
- **Mois 7-10.** Croissance régulière des utilisateurs. Deux incidents mineurs de retraits retardés attribués dans les communications du service client à « maintenance planifiée » et « délais de traitement bancaire tiers ». Les avis Trustpilot se sont nettement bipolarisés durant cette période.
- **Mois 11-12.** Token natif $KLSX listé sur deux lieux secondaires. Un « certificat de conformité » a été ajouté au site web, avec un logo qui ressemblait sans correspondre exactement au logo d'un régulateur réel.
- **Mois 13.** Les retards de retrait sont devenus systématiques. Les délais de réponse du support client se sont dégradés du même jour à plusieurs jours. Un billet de blog a attribué la situation à une « pression de retrait sans précédent » et a annoncé un plafond temporaire de retrait.
- **Mois 14, semaine 1.** La plateforme a annoncé une « maintenance planifiée » de 72 heures pour « mises à niveau d'infrastructure ». La fenêtre a été prolongée deux fois.
- **Mois 14, semaine 2.** Les communications ont cessé. Le site a renvoyé une page d'attente. Les comptes sociaux du PDG ont été supprimés sous 48 heures. Le prix du token natif s'est effondré sur l'ensemble des lieux où il restait négociable.

### 4.3 Acteurs

La plateforme présentait une équipe de direction semi-doxée. Les noms ci-dessous sont inventés ; toute ressemblance avec une personne réelle serait fortuite.

- **Sven Takashima** — annoncé comme PDG. Photographie publique présente sur la page « À propos » de la plateforme ; la photographie a été soumise à une recherche d'image inversée après l'effondrement et s'est avérée correspondre à une banque d'images de stock. Aucun dossier institutionnel vérifiable ne correspondait au nom.
- **Nina Orozco** — annoncée comme Responsable de la communication. Active sur les canaux X et LinkedIn de la plateforme. Le profil LinkedIn avait été créé environ cinq semaines avant le lancement discret de la plateforme.
- **Un « Compliance Officer »** — nommé seulement par son prénom sur la page de conformité de la plateforme. Aucun dossier public ne correspondait à la combinaison nom-fonction.

Un réseau d'environ quinze comptes promotionnels de taille moyenne a engagé avec le contenu de la plateforme durant la phase de croissance. Plusieurs de ces comptes ont été ultérieurement identifiés comme membres d'un réseau de promotion rémunérée actif sur le même public retail régional ; aucune des publications promotionnelles ne portait de mention de parrainage.

### 4.4 Indices on-chain

Les adresses EVM fictives ci-dessous sont présentées dans le format hex correct avec des valeurs arbitraires. Elles ne correspondent à aucun portefeuille réel.

- **« Hot wallet » de la plateforme (dépôts)** : `0xa3F87B91dE2c54bC9eaC718fF35E29D7bA1c92E4`
- **« Cold wallet » de la plateforme** : `0xc81fB29eAd7C4196FEa873d6520cB89e7DbF316a`
- **Portefeuille de balayage des retraits (observé en dernière semaine)** : `0xe7B4Aa28cF91d35E26b8A491EfCc70dB4296fE12`

Au cours des deux dernières semaines avant la « maintenance » annoncée, les fonds précédemment consolidés dans le « cold wallet » ont été déplacés au cours d'une série de transactions vers le portefeuille de balayage. Depuis le portefeuille de balayage, les fonds ont été répartis sur plusieurs intermédiaires, avec une part notable acheminée à travers un pont inter-chaînes public (#30) vers une seconde chaîne compatible EVM puis vers un mixeur de confidentialité (#31). Les destinations finales n'étaient pas entièrement reconstructibles à partir des données publiques.

Le schéma est la forme canonique de l'exit scam (#37) : un dépositaire centralisé dont la comptabilité interne est opaque pour les déposants ; un événement de consolidation observable de l'extérieur dans les jours précédant la suspension des retraits ; un schéma de dispersion utilisant pontage inter-chaînes et mélange qui contrarie l'attribution à destination.

### 4.5 Indices off-chain

L'empreinte off-chain était abondante. Plusieurs éléments étaient diagnostics.

- **Le certificat de conformité.** Le certificat ajouté aux mois 11-12 utilisait un logo qui ressemblait sans correspondre au logo d'un régulateur réel. Le régulateur a ultérieurement émis un communiqué public clarifiant qu'aucune relation n'existait. Il s'agit d'un schéma §D.3 dans sa forme la plus claire, aggravé par la dynamique §E.2 d'impersonnation de régulateur.
- **La photographie du PDG.** Une simple recherche d'image inversée aurait identifié la photographie comme image de stock avant tout dépôt. La photographie a néanmoins été utilisée sans contestation pendant environ quatorze mois.
- **Le mécanisme de financement annoncé du produit yield.** « Activité de tenue de marché et frais de plateforme » a été présenté comme source de financement pour les 4,2 % APY versés aux déposants. Le volume d'échange audité de la plateforme — c'est-à-dire aucun — ne soutenait pas cette affirmation, et le cadrage « compliance-grade » qui justifiait la modestie du taux dissimulait également l'absence de toute surface de revenu réconciliable. Lorsque le mécanisme de financement annoncé d'un produit yield ne peut être réconcilié avec les revenus publics de la plateforme, c'est le déposant qui finance le rendement, et le produit est structurellement de forme Ponzi (description, non qualification juridique), que le taux affiché soit conservateur ou agressif.
- **Le mécanisme d'adossement annoncé du programme de futures vin.** La revendication d'un adossement par des bouteilles millésimées physiques inventoriées dans un entrepôt sous douane n'a jamais été substantiée par des rapports d'inspection, des audits d'inventaire indépendants, ni la confirmation de l'opérateur de l'entrepôt. Les déposants ayant tenté un rachat en nature n'ont reçu que des crédits internes à la plateforme, jamais de livraison. Un produit de garde dont l'adossement dépend d'un inventaire physique chez un tiers invérifiable demande au déposant de faire confiance à l'existence d'un actif qu'il n'a jamais vu.
- **Hygiène de communication au moment de la suspension.** La transition de « maintenance planifiée » au silence a été opérationnellement rapide et cohérente avec le gabarit de l'exit scam, où l'objectif de l'opérateur consiste à convertir le plus de temps possible en dépôts supplémentaires avant que la reconnaissance publique de l'effondrement ne ferme le canal de dépôt.

### 4.6 Schémas détectés

Le cas se cartographie sur la taxonomie *Dark Patterns* comme suit :

- **§D.3 Fake Audit Badges.** Le certificat de conformité affiché sans contrepartie vérifiable.
- **§E.1 Impersonation Stacking.** La photographie du PDG, l'âge du profil LinkedIn et le « Compliance Officer » nommé ont construit ensemble une présence institutionnelle fictive.
- **§E.2 Doxx Theater.** Des identités publiques ont été construites pour la crédibilité, non pour la responsabilité.
- **§C.1 Sniper Button Positioning.** Le flux de retrait plaçait le bouton « Withdraw » sous les boutons « Stake » et « Reinvest », en police plus petite, sur l'écran principal post-connexion de la plateforme, durant toute son existence.

Entrées de glossaire pertinentes : #28 CEX, #37 Exit scam, #30 Bridge, #31 Mixer, #50 Impersonation.

### 4.7 Leçons pédagogiques

- **Un dépositaire centralisé est un point unique de défaillance, indépendamment du marketing.** Le déposant sur les plateformes du type $KLSX est structurellement un créancier non garanti. Le langage promotionnel sur des standards « de premier rang » ne change pas ce statut.
- **La photographie de stock est la fraude la moins coûteuse et la détection la moins coûteuse.** Une recherche d'image inversée effectuée dans les minutes suivant l'arrivée sur la page « À propos » d'une plateforme aurait signalé ce cas dès le mois un. Peu d'investisseurs retail effectuent cette étape ; le fait qu'ils devraient le faire constitue l'une des interventions modestes qu'un programme de protection des consommateurs peut promouvoir.
- **Un produit yield dont le mécanisme de financement n'est pas réconciliable avec les revenus publics de la plateforme est structurellement suspect.** L'arithmétique n'a pas besoin d'être précise. L'ordre de grandeur est le test. Lorsque l'ordre de grandeur ne peut pas être réconcilié, c'est le déposant qui finance le rendement.
- **Le logo ressemblant à celui du régulateur est un petit détail qui referme la lacune de confiance.** C'est également le choix de design le plus susceptible d'attirer une action de répression réglementaire après les faits. Les enquêteurs devraient capturer le logo au moment de la préservation des preuves (§3 de la *Checklist d'investigation*), car il fait partie des éléments les plus susceptibles d'être retirés dans les dernières heures de la plateforme.

---

## 5. Cas 3 — « Le pump coordonné FerroLynx : une opération sur petit cap »

### 5.1 Contexte

FerroLynx ($FRLX) était un token fictif de petite capitalisation sur une chaîne EVM, avec une offre circulante d'environ 12 millions d'unités et une capitalisation boursière totale, au début du cas, de l'ordre du bas cinq chiffres en équivalent dollar. Le token n'avait connu aucune activité d'équipe pendant environ sept mois avant les événements décrits ; le contrat avait été déployé par une adresse externe dont l'activité ultérieure était sporadique et cohérente avec un abandon.

Le token est revenu à l'attention non en raison d'une activité d'équipe, mais en raison de sa sélection comme véhicule pour une opération coordonnée de pump-and-dump organisée à travers un canal Telegram privé désigné dans ce cas comme « Apex Tide Insiders ». Le cas illustre le pump-and-dump de petite capitalisation (#39) comme typologie : un token peu négocié dont l'état dormant rend la manipulation de prix arithmétiquement aisée, des acheteurs coordonnés organisés hors plateforme, des participants retail attirés par l'action de prix visible sans conscience de la coordination, et une sortie des organisateurs synchronisée pour maximiser l'asymétrie.

### 5.2 Chronologie

La chronologie visible s'est déroulée sur environ quatre heures.

- **T-72h.** Le canal Telegram privé Apex Tide Insiders a annoncé une « opération » à venir sans nommer le token. Environ 4 800 membres étaient sur le canal à ce moment. L'annonce présentait l'opération comme un « moonshot communautaire » et exigeait des membres l'acceptation d'un code de conduite les engageant à « acheter et conserver pendant 72 heures ».
- **T-24h.** Un second message a identifié le token par son nom. Les membres ont été instruits de préparer leurs portefeuilles, de les financer avec au moins 0,05 ETH équivalent, et de se tenir prêts au « déclencheur T0 ».
- **T-0.** Message de déclenchement publié. Les achats coordonnés ont commencé dans les quatre-vingt-dix secondes à travers environ 800 portefeuilles. Le prix est monté d'environ 6× dans les dix premières minutes et de 12× dans les trente premières minutes.
- **T+30 min.** L'intérêt retail a commencé à apparaître dans les salons de discussion adjacents et sur le fil X. Des comptes de taille moyenne (aucun ne participant à la coordination) ont commencé à signaler l'action de prix.
- **T+60 min.** Le prix a atteint un sommet à environ 18× la base pré-opération.
- **T+60 à T+90 min.** L'activité coordonnée de vente a commencé depuis un sous-ensemble plus restreint d'environ 35 portefeuilles. Le prix a entamé sa descente.
- **T+90 à T+180 min.** L'achat retail s'est poursuivi durant la descente, la ralentissant. Le sous-ensemble coordinateur a achevé sa sortie.
- **T+180 min.** Le prix est redescendu à environ 1,4× la base pré-opération. À la fin de la même journée, il est revenu à la base.
- **T+24h.** Le canal Apex Tide Insiders a été effacé.

### 5.3 Acteurs

Trois rôles peuvent être distingués au sein de l'opération, tous joués par des identités inventées ci-dessous.

- **@nova_blue_handler** — l'administrateur principal du canal Telegram. A publié les messages opérationnels, le cadrage discursif et le déclencheur T-0. Le style de publication durant l'opération différait substantiellement des publications attribuées au même pseudonyme dans les jours précédents, suggérant soit un opérateur différent au clavier, soit un changement stylistique délibéré.
- **@apex_meridian_44** — un co-administrateur qui a publié des messages de renforcement durant la montée et des messages de contre-narration durant la descente (« tenez la ligne », « shake-out imminent »). Le motif est la rhétorique canonique du « sac de sortie » décrite dans la littérature sur les opérations de pump-and-dump.
- **Le « cluster de sortie »** — environ 35 portefeuilles qui ont acheté dans les quatre-vingt-dix premières secondes et ont commencé à vendre dans la première heure. Ces portefeuilles se regroupaient, par heuristique de saisie commune (#54) et par analyse de chaîne (#52), en environ sept opérateurs distincts.

Un groupe plus large d'environ 800 portefeuilles a suivi les instructions publiques et a participé en tant que « membres ». Une minorité de ces portefeuilles a sorti à profit ; la majorité a sorti à perte à mesure que la descente s'accélérait. Un groupe supplémentaire d'environ 2 200 portefeuilles retail a acheté durant la descente, sans aucune participation au canal coordinateur, et a sorti à perte substantielle.

### 5.4 Indices on-chain

Les adresses fictives ci-dessous sont présentées dans le format EVM correct avec des valeurs arbitraires.

- **Contrat du token** : `0xb52e0F4d2A91cE7DcFf38A6920a8c3F7DcEa54B9`
- **Pool de liquidité (AMM unique)** : `0x7f3cE19D6aF8512BA09bd47cE2197fA836eB05f7`
- **Portefeuille représentatif du cluster de sortie** : `0x47cFa18B6dE92dC7F4830aB5167cE99d8E1Bf2A6`

Le schéma visible on-chain suivait la forme canonique du pump (#39) : un pool de liquidité mince dont la profondeur était d'environ 30 000 USD au début de l'opération, capable d'absorber seulement une pression de vente modeste avant un slippage significatif (#24) ; une vague de transactions d'achat dans une fenêtre temporelle étroite ; un motif de transactions à frais plus élevés depuis le cluster de sortie, indiquant une disposition à payer pour la priorité de transaction sur le chemin de vente ; une dispersion en peeling chain (#55) des produits à travers plusieurs portefeuilles dans la même heure.

Le piège de slippage (§C.2 du whitepaper *Dark Patterns*) s'illustre mécaniquement ici. Un acheteur retail arrivant à T+45 min avec une tolérance de slippage par défaut de, disons, 2 % aurait transacté à un prix nettement au-dessus de sa limite intentionnelle, parce que l'affichage de slippage du front-end ne reflétait pas les conditions dynamiques du pool en montée. Le cluster de sortie extrayait, en réalité, la différence entre l'intention retail et l'exécution retail.

### 5.5 Indices off-chain

Trois éléments off-chain sont diagnostics.

- **Le cadrage en « code de conduite ».** L'exigence pour les membres « d'acheter et conserver pendant 72 heures » était un dispositif de coordination destiné à empêcher l'activité de vente des membres de concurrencer le cluster de sortie. Lu littéralement, il s'agissait d'une demande aux membres de financer la sortie des opérateurs ; lu dans le cadre des opérateurs, il s'agissait d'un engagement « communautaire ». Le recadrage est le schéma §B.3 de confirmshaming opérant sur l'identité des participants en tant que membres.
- **La rhétorique post-opération.** Les messages durant la descente invoquaient les cadrages « mains faibles », « paper hands » et « shake-out ». Cette rhétorique est bien documentée dans la littérature sur les opérations de pump-and-dump et est destinée à retarder l'activité de vente des membres au-delà du point où les sorties des membres pouvaient être profitables.
- **L'effacement du canal.** La destruction du canal Telegram sous vingt-quatre heures est cohérente avec l'intérêt des opérateurs à éliminer la preuve off-chain la plus explicite de coordination.

### 5.6 Schémas détectés

Le cas se cartographie sur la taxonomie *Dark Patterns* comme suit :

- **§A.3 FOMO Triggers.** À la fois le cadrage en « opération » et l'action de prix visible.
- **§B.2 KOL-Orchestrated FOMO.** Opérationnel, dans le petit groupe d'organisateurs plutôt que dans des influenceurs publiquement visibles.
- **§B.3 Confirmshaming.** La rhétorique « mains faibles » / « shake-out » durant la descente.
- **§C.2 Slippage Trap.** Mécanique, dans la dynamique de l'AMM sous le pool en montée.

Entrées de glossaire pertinentes : #24 Slippage, #26 LP, #29 DEX, #39 Pump and dump, #41 Front-running (opérationnellement adjacent), #54 Common-input heuristic, #62 Retail, #65 Sniper bot.

### 5.7 Leçons pédagogiques

- **La coordination est l'élément opérationnellement décisif, non l'action de prix.** L'investisseur retail qui observe l'action de prix voit un token qui monte ; l'enquêteur qui cartographie la coordination voit une extraction. L'emphase d'enquête doit porter sur la structure de coordination off-chain, non sur le graphique de prix on-chain.
- **L'information asymétrique est la substance du dommage.** Les opérateurs savaient que l'opération était une opération ; les participants croyaient faire partie d'une « communauté » ; les spectateurs retail voyaient un graphique. Le dommage est la distribution asymétrique de la conscience, non le graphique de prix pris isolément.
- **Le cadrage en « code de conduite » est une manipulation de l'identité.** Les participants sont présentés comme membres d'un groupe dont l'épreuve de loyauté consiste à conserver durant la descente. La sortie de l'opérateur dépend de la conformité des participants à ce cadrage.
- **Les cas de pump-and-dump ne sont pas « sans victime ».** L'argument selon lequel « les participants savaient à quoi ils s'engageaient » présuppose une compréhension symétrique que la typologie réfute. Les participants croyaient en la coordination ; ils ne croyaient pas être la liquidité de sortie de la coordination. La destruction du canal observée ici dans les vingt-quatre heures fait partie des pertes de preuves les plus coûteuses (§3 de la *Checklist d'investigation*) ; la capture en amont, lorsque la suspicion existe, est la seule option fiable.

---

## 6. Cas 4 — « La campagne drainer QuasarPath : phishing massif via faux airdrop »

### 6.1 Contexte

La campagne QuasarPath était une opération fictive de phishing de masse conduite au début 2025, ciblant les détenteurs de portefeuilles sur deux chaînes EVM via une fausse interface de « réclamation d'airdrop ». La campagne usurpait l'identité d'un protocole fictif mais légitime désigné dans ce cas comme « Protocole Q » (substitut pour la classe des protocoles récemment lancés dont l'audience des détenteurs de token constitue une cible reconnaissable).

L'opération relevait du déploiement de phishing-drainer commodité (#43) : les éléments visibles (page d'atterrissage, présence sur les réseaux sociaux, interface de « réclamation ») étaient une peinture posée sur un kit drainer sous-jacent générique disponible, durant la période, sur des canaux semi-publics. La typologie est devenue routinière ; la majorité des portefeuilles retail rencontrant un faux airdrop en 2024-2025 rencontraient l'une d'environ une douzaine de variantes de kit récurrentes, habillées pour l'écosystème cible.

Les pertes totales sur la campagne visible étaient estimées, par agrégation des flux entrants observables du contrat drainer, à environ 1,4 million USD à travers environ 280 portefeuilles victimes sur une fenêtre de six semaines.

### 6.2 Chronologie

La chronologie visible s'est déroulée sur environ six semaines, en deux vagues distinctes.

- **Pré-lancement (semaine 0).** Préparation de l'infrastructure. Un domaine ressemblant visuellement au domaine du Protocole Q (par substitution de lettres et un caractère non latin) a été enregistré. Une page d'atterrissage a été déployée. Le contrat drainer a été déployé sur la chaîne cible. Des comptes sociaux usurpant le Protocole Q ont été créés avec des versions recadrées de l'avatar du Protocole Q.
- **Vague 1 (semaines 1-2).** Ciblage via X et Telegram. Réponses-spam sous les publications officielles du Protocole Q dirigeant les utilisateurs vers le faux site de réclamation. Messages directs des comptes usurpateurs vers des portefeuilles sélectionnés ayant précédemment interagi avec le Protocole Q. Cadrage en « fenêtre de réclamation limitée » de 48 heures.
- **Issue Vague 1 (semaine 2).** Environ 180 portefeuilles victimisés, avec une perte médiane de l'ordre du bas quatre chiffres en équivalent dollar.
- **Adaptation (semaine 3).** L'équipe du Protocole Q a publié des avertissements publics. Le faux domaine a été signalé et partiellement supprimé sur les principales plateformes sociales. Les opérateurs ont basculé vers un second domaine (motif de substitution similaire) et un nouvel ensemble de comptes usurpateurs.
- **Vague 2 (semaines 4-5).** Reprise du ciblage via la nouvelle infrastructure. Ingénierie sociale affinée : messages présentés comme « réclamation de seconde chance » pour les « portefeuilles ayant manqué la première vague ». Environ 100 portefeuilles supplémentaires victimisés.
- **Suppression (semaine 6).** Action combinée des plateformes sociales et du registre du second domaine a réduit l'activité visible. Le contrat drainer a continué à recevoir des flux entrants plus modestes pendant deux semaines supplémentaires avant que l'activité ne cesse.

### 6.3 Acteurs

Les opérateurs étaient anonymes et la structure d'acteur a été inférée plutôt qu'observée. Le pseudonyme ci-dessous est inventé.

- **@quasarpath_claim** — le compte usurpateur principal durant la Vague 1. Avatar du Protocole Q recadré ; nom d'affichage à trois caractères près de celui du Protocole Q ; cadence de publication et chevauchement de fuseau horaire cohérents avec une fenêtre opérationnelle d'Europe de l'Est ou d'Asie centrale.
- **@nodevault_airdrop** — le compte usurpateur principal durant la Vague 2. Stylistiquement distinct de @quasarpath_claim mais opérationnellement similaire.
- **Un ensemble diffus d'environ 40 comptes de réponse-spam** durant la Vague 1, avec des dates de création chevauchantes regroupées dans une fenêtre de 96 heures environ deux semaines avant la Vague 1, cohérentes avec un lot de comptes pré-staged.

Les indications d'un opérateur unique ou d'une petite équipe d'opérateurs pour le côté on-chain étaient fortes : le contrat drainer sur chaque chaîne était un déploiement quasi identique avec les mêmes paramètres d'initialisation et le même schéma de retrait.

### 6.4 Indices on-chain

Les adresses fictives ci-dessous sont présentées dans le format EVM correct avec des valeurs arbitraires.

- **Contrat drainer (chaîne cible 1)** : `0xd9c2e4a3F8B176eC5b0d29fAa84cE7bD5621FA90`
- **Contrat drainer (chaîne cible 2)** : `0xb47Ef25a83cD1F947B6128A0F593E7eC2861aF34`
- **Portefeuille de balayage (terminal)** : `0x3eF9c186A7B58c2dE4A0fb91752C84eD0B1FE5a8`

Le schéma on-chain est la forme canonique du drainer (#43, #49) : le portefeuille victime, ayant cliqué à travers la fausse interface de réclamation, a signé une transaction dont l'objet apparent était de « réclamer » un airdrop mais dont la charge effective était une transaction d'approbation de tokens (#49) accordant au contrat drainer une autorité de dépense illimitée sur un ou plusieurs tokens détenus dans le portefeuille victime. Suivant l'approbation, le contrat drainer a tiré les tokens de plus haute valeur du portefeuille victime dans une transaction de suivi unique.

Le pontage inter-chaînes (#30) et le mélange ultérieur (#31) des produits ont contrarié l'attribution à destination. Les opérateurs ont fait preuve d'une conscience routinière du timing des ponts et de leur étranglement, suggérant un opérateur expérimenté plutôt qu'un déploiement de première instance.

### 6.5 Indices off-chain

Plusieurs éléments off-chain étaient diagnostics.

- **La substitution de domaine.** Les domaines de la Vague 1 et de la Vague 2 utilisaient la même famille de substitutions visuellement similaires : paires de lettres (par exemple « rn » pour « m ») et un caractère non latin dans une position où l'œil ne s'attarde guère. Il s'agit de la technique canonique du homoglyphe, caractéristique du phishing de masse plutôt que des attaques ciblées.
- **Le motif de réponse-spam sous les publications officielles du Protocole Q.** Les réponses sont apparues dans les minutes suivant les publications officielles du Protocole Q et étaient publiées par des comptes dont l'autre activité était minime. Le motif est le schéma §E.1 d'impersonnation opérant sur la couche de réponse aux publications sur les réseaux sociaux plutôt que sur la seule couche du compte.
- **Le cadrage en « réclamation de seconde chance » en Vague 2.** Ce cadrage est bien documenté dans la littérature sur l'itération du phishing : un narratif de Vague 2 qui recadre l'échec de la Vague 1 à capter un portefeuille donné en « seconde opportunité » cible spécifiquement les portefeuilles ayant manifesté une prudence antérieure.
- **La coopération visible entre signalement de plateforme sociale et action de registre en semaine 6.** Cet élément est inclus pour signaler que la suppression dans cette typologie est faisable mais lente ; la fenêtre opérationnellement signifiante est celle qui précède la suppression, qui dans ce cas-ci s'est étalée sur environ cinq semaines.

### 6.6 Schémas détectés

Le cas se cartographie sur la taxonomie *Dark Patterns* comme suit :

- **§A.2 Limited Supply Theater.** Le cadrage en « fenêtre de réclamation limitée » de 48 heures en Vague 1 et le cadrage en « seconde chance » en Vague 2.
- **§E.1 Impersonation Stacking.** L'avatar recadré, le nom d'affichage quasi identique, le domaine homoglyphe et les comptes de réponse staged ont construit ensemble un schéma d'impersonnation soutenu.
- **§C.1 Sniper Button Positioning.** Le bouton « Claim » sur la fausse page d'atterrissage était positionné et stylisé pour capter l'attention de l'utilisateur ; la mention en petits caractères de la nature sous-jacente de la transaction était absente.

Entrées de glossaire pertinentes : #43 Drainer, #44 Phishing, #49 Approval exploit, #50 Impersonation, #30 Bridge, #31 Mixer.

### 6.7 Leçons pédagogiques

- **La révocation d'approbation est une posture de récupération activée par défaut, non une réaction d'urgence.** Les portefeuilles ayant signé des approbations de tokens à des adresses qui ne sont plus de confiance devraient révoquer ces approbations de manière routinière. La signature est le dommage, non le transfert ultérieur ; le transfert est la matérialisation du dommage déjà autorisé.
- **Les domaines homoglyphes sont détectables par une inspection coûtant quelques secondes.** Survoler un lien, copier l'URL et la comparer visuellement au domaine légitime suffit à détecter la technique. Cette habitude de reconnaissance fait partie des interventions retail à plus haut levier disponibles.
- **La couche de réponse est une surface de phishing.** Traiter les réponses « officielles » sous une publication officielle comme si elles partageaient la sécurité de la publication d'origine est l'erreur cognitive sur laquelle l'usurpateur compte. Les enquêteurs rencontrant des signalements de phishing devraient examiner la couche de réponse aux publications légitimes récentes dans l'écosystème pertinent avant de conclure que la campagne est sur mesure.
- **Les kits drainer sont une commodité, et donc les indices opérationnels d'une campagne sont prédictifs des autres.** Un enquêteur qui reconnaît la signature de kit dans une campagne devrait s'attendre à la rencontrer ailleurs avec des variations cosmétiques. La signature est dans le motif on-chain (#43), non dans la page d'atterrissage ; la suppression par les canaux appropriés est faisable mais lente, et la fenêtre d'intervention est celle qui précède la suppression, qui se mesure en semaines.

---

## 7. Synthèse transversale

Les quatre cas ont été choisis pour illustrer des typologies distinctes. Leurs points de chevauchement et leurs points de divergence sont eux-mêmes pédagogiquement informatifs.

**Commune aux quatre cas est la gestion de l'attention.** Chaque typologie exploite une asymétrie entre ce que la victime est invitée à remarquer et ce dont l'opérateur dépend que la victime ne remarque pas. Dans PhotonGarden, la victime était dirigée vers le graphique de prix et le compte à rebours ; l'artefact pertinent était le LP non verrouillé. Dans Kalyssa, la victime était dirigée vers le rendement et le « certificat de conformité » ; l'artefact pertinent était le financement non réconciliable. Dans FerroLynx, la victime était dirigée vers le prix qui monte ; l'artefact pertinent était la structure de coordination off-chain. Dans QuasarPath, la victime était dirigée vers la « réclamation » ; l'artefact pertinent était la transaction d'approbation sous-jacente. La tâche de l'enquêteur est symétrique : rediriger l'attention vers l'artefact pertinent, en documenter la présence, et reconstruire le chemin par lequel la victime en a été tenue à l'écart.

**Commune aux quatre cas est l'utilisation de la construction d'identité.** L'opérateur a construit une surface d'identité ressemblant à une contrepartie légitime (équipe, dépositaire, communauté, protocole). La construction était bon marché par rapport au produit ; dans trois cas sur quatre, elle aurait été détectée par une vérification OSINT routinière en quelques minutes. L'économie de l'attaque dépend de la rareté de la vérification routinière.

**Là où les cas diffèrent, c'est dans la séquence méthodologique que l'enquêteur doit suivre.** Un rugpull s'aborde au mieux on-chain en premier (structure du LP, activité du portefeuille équipe) ; un exit scam par la surface d'identité off-chain en premier (la divergence entre statut institutionnel revendiqué et tout dossier indépendant) ; un pump-and-dump par la couche de coordination (capture du canal d'organisation hors plateforme) ; une campagne drainer par la couche d'infrastructure (le contrat drainer, le motif de domaine et le lot de comptes de réponse identifieront ensemble la campagne comme l'instance d'un kit reconnaissable). Les enquêteurs qui utilisent le même ordre méthodologique pour chaque cas se trouveront à faire le mauvais travail en premier.

**Là où les cas diffèrent, c'est dans la cadence temporelle de la préservation des preuves.** La preuve la plus décisive d'un rugpull persiste on-chain indéfiniment tandis que la preuve off-chain (site, canal Telegram, versions de feuille de route) se dégrade en quelques heures. Les captures de page de conformité, comptes du PDG et transcriptions du support client d'un exit scam sont retirés en quelques jours. Le canal coordinateur d'un pump-and-dump peut ne pas survivre à l'opération ; la capture en amont est la seule option fiable. L'infrastructure d'une campagne drainer persiste pendant des semaines mais les comptes sociaux peuvent être suspendus à tout moment. Les plans de préservation des preuves devraient être calibrés sur la typologie, non génériques.

**Limites de ces études de cas.** Un cas réel est plus complexe que sa reconstruction narrative. Les enquêteurs devraient s'attendre, dans toute mission concrète, à des schémas supplémentaires non décrits ici, à de l'ambiguïté dans la couche d'attribution que le narratif résout, à des rapports de témoins qui se contredisent et à des éléments qui paraissent centraux rétrospectivement mais étaient invisibles en temps réel. Les études de cas de ce document enseignent la reconnaissance de schémas, non la certitude des schémas.

---

## 8. Annexe — Tableau de lecture croisée

Le tableau ci-dessous cartographie chacun des quatre cas sur la taxonomie *Dark Patterns* et sur les sections de la *Checklist d'investigation*, pour usage de référence.

| Cas | Schéma(s) (Dark Patterns) | Sections de la Checklist (principales) | Entrées de glossaire (principales) |
|---|---|---|---|
| Cas 1 — PhotonGarden (rugpull) | §A.1, §A.3, §B.1, §B.2, §D.1 | §3, §4.1, §4.2, §4.4, §5.4, §6.4 | #5, #6, #36, #53, #55, #61, #66 |
| Cas 2 — Kalyssa Exchange (exit scam) | §C.1, §D.3, §E.1, §E.2 | §3, §5.1, §5.3, §6.3, §7.4, §7.5 | #28, #30, #31, #37, #50 |
| Cas 3 — FerroLynx (pump-and-dump) | §A.3, §B.2, §B.3, §C.2 | §3, §5.1, §6.1, §6.4, §7.6 | #24, #26, #29, #39, #54, #62 |
| Cas 4 — QuasarPath (drainer) | §A.2, §C.1, §E.1 | §3, §4.2, §5.4, §6.1, §7.4 | #30, #31, #43, #44, #49, #50 |

Le lecteur doit interpréter les correspondances comme les principales correspondances, non comme des listes exhaustives. Chaque cas contient des références incidentes à des schémas et sections non listés dans le tableau.

---

## 9. Références

Les références suivantes sont conçues pour être vérifiables auprès de sources primaires. Les praticiens sont encouragés à les consulter dans leurs versions publiées.

1. Chainalysis. (2024). *The 2024 Crypto Crime Report*. Rapport annuel sur l'activité illicite en cryptomonnaies. Les éditions ultérieures actualisent les comptes typologiques et la part des produits attribuables aux scams, aux entités sanctionnées et aux ransomwares.
2. Europol. (2023). *Internet Organised Crime Threat Assessment (IOCTA) 2023*. Les rapports IOCTA annuels incluent des sections sur la fraude facilitée par les cryptomonnaies et sur l'évolution de l'infrastructure des drainers de phishing.
3. Groupe d'action financière (GAFI / FATF). (2021). *Updated Guidance for a Risk-Based Approach to Virtual Assets and Virtual Asset Service Providers*. Cadre de référence pour la supervision des VASP pertinent dans les cas d'exchanges centralisés.
4. Foley, S., Karlsen, J. R., & Putniņš, T. J. (2019). *Sex, Drugs, and Bitcoin: How Much Illegal Activity Is Financed Through Cryptocurrencies?* The Review of Financial Studies, 32(5). Référence méthodologique sur l'attribution à grande échelle.
5. Mathur, A., Acar, G., Friedman, M. J., Lucherini, E., Mayer, J., Chetty, M., & Narayanan, A. (2019). *Dark Patterns at Scale: Findings from a Crawl of 11K Shopping Websites*. Proceedings of the ACM on Human-Computer Interaction, CSCW. Étude empirique fondatrice sur les dark patterns.
6. Xu, J., & Livshits, B. (2019). *The Anatomy of a Cryptocurrency Pump-and-Dump Scheme*. Proceedings of the 28th USENIX Security Symposium. Analyse empirique des opérations coordonnées de pump-and-dump sur petites capitalisations.
7. Vasek, M., & Moore, T. (2015). *There's No Free Lunch, Even Using Bitcoin: Tracking the Popularity and Profits of Virtual Currency Scams*. Financial Cryptography and Data Security (FC 2015). Étude systématique précoce des typologies de scam crypto.

Aucune référence dans ce document ne correspond à une enquête réelle nommée ; toutes les sources citées sont des publications scientifiques, réglementaires ou industrielles publiques.

---

## 10. Clause de non-responsabilité

Les cas présentés dans ce document sont entièrement fictifs. Tous les noms de projet, noms de plateforme, identifiants sociaux, adresses de portefeuille, empreintes de transaction, montants en dollars et dates ont été inventés à des fins pédagogiques. Toute ressemblance entre un cas de ce document et un projet, une plateforme, une personne, une adresse ou une transaction réels serait fortuite.

Le document est descriptif et pédagogique. Il ne fournit pas de conseil juridique, n'autorise aucune action qui serait elle-même illicite, et ne nomme aucune entité, aucun projet et aucune personne réels spécifiques. Il ne constitue pas un manuel de conduite d'une opération décrite ; les descriptions sont suffisantes pour soutenir la reconnaissance de schémas et sont insuffisantes pour soutenir leur reproduction.

Les praticiens utilisant ce document à des fins de formation sont encouragés à rappeler à leurs auditoires le statut fictif des cas, particulièrement dans les contextes pédagogiques où la forme narrative des cas peut encourager une lecture erronée en reportage.

Sous licence Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0). Autorisé à être redistribué et adapté à des fins non commerciales avec attribution.
