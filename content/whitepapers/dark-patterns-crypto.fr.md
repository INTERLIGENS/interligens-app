---
title: "Les Dark Patterns dans le Crypto : Une Taxonomie des Tactiques de Manipulation"
authors: ["INTERLIGENS Research"]
version: "1.0"
date: "2026-05-21"
status: "draft"
license: "CC BY-NC 4.0"
audience: ["enquêteurs", "chercheurs", "investisseurs-retail", "régulateurs"]
abstract: "Les plateformes crypto, les sites de presale et les canaux sociaux déploient régulièrement des motifs d'interface et de discours conçus pour pousser les participants retail vers des actions on-chain irréversibles avant qu'ils ne puissent délibérer. Ce document recense quinze motifs de ce type, regroupés en cinq catégories — urgence fabriquée, pression sociale, manipulation technique de l'interface, désinformation financière, et manipulation d'identité. Pour chaque motif sont décrits le mécanisme psychologique exploité, les indicateurs observables, et les contre-mesures disponibles pour les enquêteurs et les utilisateurs. La taxonomie est destinée à servir de fondation pour des outils de détection, d'analyse réglementaire, et d'éducation des consommateurs. Elle s'appuie sur la littérature plus large sur les dark patterns (Brignull, Gray, Mathur) et l'adapte aux propriétés spécifiques des blockchains sans permission, où une seule signature peut transférer de la valeur de manière irréversible et où l'absence d'intermédiaire élimine le filet de sécurité conventionnel constitué par l'annulation, le chargeback, ou la résolution de litige."
---

## 1. Résumé

Un *dark pattern* est un choix de conception d'interface utilisateur ou de discours qui bénéficie à l'opérateur d'un service au détriment de l'utilisateur, typiquement en exploitant un biais cognitif, une asymétrie d'information, ou la rareté de l'attention. Le terme a été forgé par Harry Brignull en 2010 et a depuis été adopté par les régulateurs de l'Union européenne (Digital Services Act, article 25), des États-Unis (Federal Trade Commission, 2022), et de l'OCDE.

Le crypto constitue un environnement particulièrement fertile pour les dark patterns. Les transactions sont irréversibles, le règlement est définitif en quelques secondes, les intermédiaires sont absents par construction, et le participant retail moyen se voit demander d'évaluer des artefacts techniques — adresses de contrat, calldata, payloads de signature, composition des liquidity pools — difficiles à interpréter même pour des spécialistes. Une manipulation qui ne serait que désagréable sur un site grand public devient financièrement terminale lorsque la même friction s'applique à une signature de wallet.

Ce document recense quinze motifs observés sur les launchpads de presale, les sites de lancement de tokens, les front-ends d'exchanges décentralisés, et les canaux sociaux. Deux sujets adjacents sont délibérément exclus : (a) la manipulation purement on-chain telle que le wash trading et les rugpulls, qui sont traités comme des *conséquences* des dark patterns en amont plutôt que comme des dark patterns eux-mêmes ; et (b) la manipulation de calldata malicieuse et de payloads de signature, qui fait l'objet d'un document technique séparé. Le périmètre retenu ici est la surface persuasive qui amène un utilisateur jusqu'au point de signature.

La taxonomie est descriptive et non accusatoire. Aucun projet réel, personne, ou dossier n'est nommé. Le document est destiné aux enquêteurs OSINT, aux investisseurs retail dotés d'une littératie technique, aux chercheurs, et aux régulateurs cherchant un vocabulaire opérationnel.

## 2. Introduction

### 2.1 Qu'est-ce qu'un dark pattern ?

La définition originale de Harry Brignull (2010) caractérisait un dark pattern comme un choix d'interface utilisateur qui « piège les utilisateurs et leur fait faire des choses qu'ils n'avaient pas l'intention de faire ». Gray et al. (2018) ont raffiné le cadrage en désignant les conceptions qui bénéficient à un service en ligne en contraignant, en orientant, ou en trompant les utilisateurs pour leur faire prendre des décisions non intentionnelles et potentiellement nuisibles. Mathur et al. (2019, 2021) ont développé une taxonomie empirique des dark patterns à partir de plus de onze mille sites de commerce et ont proposé cinq attributs — asymétrie, restriction, dissimulation, tromperie, et masquage d'information — utiles à la classification.

Les régulateurs ont depuis produit des définitions opérationnelles. Le règlement UE 2022/2065 (Digital Services Act), article 25, interdit aux fournisseurs de plateformes en ligne de concevoir ou d'opérer leurs interfaces « de manière à tromper ou manipuler » les destinataires. Le rapport du staff de la Federal Trade Commission des États-Unis *Bringing Dark Patterns to Light* (septembre 2022) recense quatre catégories de pratiques que l'agence considère comme passibles de poursuites au titre de la section 5 du FTC Act. Le document de travail de l'OCDE *Dark commercial patterns* (2022) fournit une comparaison inter-juridictionnelle.

### 2.2 Pourquoi le crypto est un cas particulier

Trois propriétés structurelles séparent le crypto de l'environnement e-commerce dans lequel la littérature sur les dark patterns est née :

- **Irréversibilité.** Une fois qu'une signature est diffusée et qu'un bloc est finalisé, la transaction ne peut être annulée par l'opérateur, par un réseau de paiement, ou par un tribunal, sans récupérer la clé privée de l'adresse réceptrice. L'utilisateur ne dispose d'aucun chargeback, d'aucune fenêtre de protection anti-fraude, d'aucun recours auprès d'un processeur de paiement.
- **Opacité technique.** Les pop-ups de wallets affichent des adresses hexadécimales, des sélecteurs de fonctions, et des estimations de gas. Le coût cognitif de vérifier qu'une signature est sûre est élevé, et le coût d'une erreur est total. Les front-ends exploitent fréquemment cette asymétrie en interposant une interface visuelle familière au-dessus d'un appel de contrat non familier.
- **Composabilité et vitesse.** Le déploiement sans permission signifie qu'un nouveau token, un nouveau pool, ou un nouveau front-end peut être créé en minutes, évalué socialement en heures, et abandonné en jours. Cette cadence supprime la friction institutionnelle (revue juridique, conformité, validation publicitaire) qui contraint les comportements analogues dans la finance régulée.

### 2.3 Périmètre et hors-périmètre

Ce document couvre les motifs manipulatoires qui surviennent *avant* la signature d'un wallet : le site, le canal social, le launchpad, la salle de chat. Il ne couvre pas la calldata malicieuse, les exploits de blind-signing, la manipulation de payloads EIP-712, ou les drainers basés sur permit ; ceux-ci relèvent d'un document compagnon sur l'intention de signature. Il ne couvre pas non plus les fautes purement on-chain (wash trading, attaques sandwich, extraction MEV, rugpulls), qui constituent le *résultat* qu'un dark pattern rend possible. La frontière choisie ici est la surface persuasive — la couche qui détermine si l'utilisateur procède jusqu'à la signature.

## 3. Une taxonomie des dark patterns crypto

Les motifs sont regroupés en cinq catégories : urgence fabriquée, pression sociale, manipulation technique de l'interface, désinformation financière, et manipulation d'identité. Chaque entrée comprend le mécanisme exploité, les indicateurs observables, et les contre-mesures. Lorsqu'un motif est documenté dans la littérature académique, la source est citée ; lorsqu'il est largement rapporté mais ne fait pas l'objet d'un traitement académique formel, il est décrit de manière conservatrice.

### Catégorie A — Urgence fabriquée

#### A.1 Faux compte à rebours

**Catégorie.** Urgence fabriquée.
**Mécanisme exploité.** Aversion à la perte (Kahneman & Tversky, 1979) ; peur de manquer une opportunité ; biais de clôture sous pression temporelle.
**Présentation.** Un compteur visible sur une page de presale, de mint, d'allocation, ou de « fermeture de whitelist ». Le compteur peut se réinitialiser au rechargement de la page, redémarrer après expiration, ou être réinitialisé à une nouvelle valeur à chaque visite. Dans certaines implémentations, le compte à rebours est codé en dur côté client et ne correspond à aucune échéance serveur ou on-chain.
**Pourquoi c'est dangereux.** La pression temporelle réduit mesurablement la délibération et augmente la probabilité de compléter une transaction sans diligence raisonnable (FTC, 2022, ch. 3). Lorsque l'urgence sous-jacente est artificielle, l'utilisateur prend une décision à enjeu élevé sur la base d'une prémisse fabriquée.
**Indicateurs de détection.**
- La valeur du compteur diffère entre navigateurs ou après rechargement forcé.
- Le compte à rebours atteint zéro et est remplacé par un nouveau compte à rebours de durée identique.
- Aucune échéance équivalente on-chain (ex. un champ `saleEndsAt`) n'est exposée dans le contrat.
- Le code source de la page contient un `Date.now() + N` codé en dur plutôt qu'une échéance lue depuis le contrat.
**Contre-mesures.** Les enquêteurs devraient comparer l'échéance affichée à toute échéance encodée dans le contrat. Les utilisateurs devraient traiter toute vente qui *ne peut pas* être suspendue par un rafraîchissement comme un signal à investiguer, et non comme un signal à agir plus vite.

#### A.2 Théâtre de la rareté

**Catégorie.** Urgence fabriquée.
**Mécanisme exploité.** Heuristique de rareté (Cialdini, 1984) : les éléments perçus comme rares sont valorisés plus haut et les décisions à leur sujet sont prises plus rapidement.
**Présentation.** Des compteurs tels que « Seulement 47 places restantes », « Whitelist remplie à 92 % », ou une barre de progression approchant la complétion. Le nombre peut être purement cosmétique — généré côté client, décrémenté sur un timer indépendamment des ventes réelles — ou peut être réinitialisé entre les sessions.
**Pourquoi c'est dangereux.** L'heuristique de rareté se combine avec l'urgence : un utilisateur qui se serait autrement arrêté pour vérifier une adresse de contrat peut signer immédiatement pour « sécuriser sa place ».
**Indicateurs de détection.**
- Les « places restantes » se décrémentent sans activité on-chain corrélée.
- Le compteur se réinitialise ou saute entre les chargements de page.
- Aucune allow-list on-chain, plafond de supply, ou quota par adresse n'est vérifiable dans le contrat.
**Contre-mesures.** Croiser toute revendication de rareté affichée avec le supply réel du contrat, le nombre de mints, ou l'état de l'allow-list. Lorsque le front-end refuse d'exposer l'adresse du contrat avant signature, l'interaction entière doit être considérée comme adversariale.

#### A.3 Déclencheurs FOMO

**Catégorie.** Urgence fabriquée.
**Mécanisme exploité.** Regret anticipé ; preuve sociale de gains futurs imaginés.
**Présentation.** Bannières et formulations telles que « Ne ratez pas le prochain 100x », « Dernière chance avant listing », « Avantage du first mover », « C'est le nouveau [actif établi] ». La formulation présente *ne pas participer* comme le choix risqué et *participer* comme le défaut.
**Pourquoi c'est dangereux.** La reformulation du choix par défaut est parmi les manipulations les plus efficaces dans la littérature sur les dark patterns (Mathur et al., 2021). Lorsque l'alternative écartée est fictive (« le prochain 100x »), il est demandé à l'utilisateur de mettre en balance une perte réelle avec un gain inventé.
**Indicateurs de détection.**
- Revendications comparatives référençant des multiples de prix sans source.
- Absence de toute description concrète du produit sous-jacent.
- Recours à des témoignages de tiers sur des rendements passés non vérifiables.
**Contre-mesures.** Considérer toute vente dont le marketing décrit des résultats plutôt que des mécanismes comme dirigée par le marketing plutôt que par le produit. Les enquêteurs devraient pondérer un tel langage comme un signal de risque mais non comme une preuve concluante ; les formulations FOMO ne sont pas en elles-mêmes illégales dans la plupart des juridictions.

### Catégorie B — Pression sociale

#### B.1 Astroturfing et sockpuppets

**Catégorie.** Pression sociale.
**Mécanisme exploité.** Preuve sociale informationnelle (Cialdini, 1984) : l'heuristique selon laquelle si de nombreuses personnes indépendantes croient une chose, elle est probablement vraie.
**Présentation.** Des comptes coordonnés publient des commentaires enthousiastes mais génériques sur un token, un projet, ou un lancement. Les comptes peuvent partager des dates de création, des cadences de publication, des recouvrements de followers, ou des gabarits visuels. Les réponses à des publications neutres ou sceptiques sont disproportionnellement positives.
**Pourquoi c'est dangereux.** La tromperie est structurelle : l'utilisateur infère un consensus populaire à partir de ce qui est en réalité un acteur unique ou un petit groupe coordonné. Ce motif est explicitement nommé dans le rapport de la FTC (2022) et figure parmi les violations énumérées à l'article 25 du DSA.
**Indicateurs de détection.**
- Grappe de comptes avec biographies similaires, dates de création similaires, ratios followers/following faibles.
- Réponses répétant des formulations avec une variation lexicale minime.
- Fuseau horaire de publication incohérent avec la localisation revendiquée du projet.
- Métriques d'engagement (likes, reposts) disproportionnées par rapport aux vues.
**Contre-mesures.** Échantillonner les comptes et inspecter leur historique ; rechercher une concentration inorganique d'activité dans le même écosystème de projet. Lorsque les métriques d'engagement sont accessibles via API, calculer les matrices de recouvrement de followers.

#### B.2 FOMO orchestré par KOL

**Catégorie.** Pression sociale.
**Mécanisme exploité.** Heuristique d'autorité (Cialdini, 1984) : les attributions d'expertise transfèrent leur crédibilité à l'objet recommandé.
**Présentation.** Des comptes influents publient un enthousiasme apparemment organique au sujet d'un projet sans divulguer qu'ils détiennent des allocations, qu'ils ont été payés, ou qu'ils ont reçu un accès anticipé. La recommandation a l'apparence d'une découverte plutôt que d'une publicité. Lorsque plusieurs influenceurs publient simultanément ou dans une fenêtre courte, l'orchestration devient visible pour les observateurs attentifs mais n'est pas divulguée.
**Pourquoi c'est dangereux.** La recommandation rémunérée non divulguée est illégale dans la plupart des juridictions pour les valeurs mobilières traditionnelles et fait l'objet d'une application continue dans le crypto (actions de la SEC américaine en 2024 et 2025). Pour les utilisateurs, la tromperie structurelle — croire observer un consensus organique alors qu'on observe un marketing orchestré — est identique à l'astroturfing mais plus difficile à détecter parce que chaque compte individuel est réel et à forte notoriété.
**Indicateurs de détection.**
- Plusieurs influenceurs publient sur le même projet dans une fenêtre étroite.
- Les publications ne portent pas les mentions `#ad`, `#sponsored`, ou les balises de divulgation propres à la juridiction.
- Les adresses de wallet des influenceurs (lorsque connues) figurent parmi les premiers destinataires du token.
- Le langage de la recommandation varie stylistiquement entre comptes mais est sémantiquement quasi identique.
**Contre-mesures.** Traiter par défaut l'activité corrélée d'influenceurs comme une campagne marketing et exiger une divulgation pour faire évoluer cette classification. Les enquêteurs peuvent corréler les horaires de publication avec les événements connus de distribution de tokens.

#### B.3 Confirmshaming

**Catégorie.** Pression sociale.
**Mécanisme exploité.** Conformité au groupe ; aversion à être catégorisé comme de bas statut.
**Présentation.** Une formulation de refus qui présente l'acte de décliner comme un échec moral ou de statut. Les exemples dans le crypto incluent « Diamond hands only », « Paper hands exit here », ou des boîtes de dialogue de refus étiquetées avec l'argot désignant la lâcheté. L'utilisateur se voit proposer deux boutons dont les libellés sont asymétriques : l'un neutre ou valorisant, l'autre stigmatisant.
**Pourquoi c'est dangereux.** Le motif est documenté dans la littérature de protection des consommateurs hors crypto (Mathur et al., 2019) et est explicitement nommé dans le rapport de la FTC. Dans les contextes crypto il apparaît dans les flux de réclamation de tokens, les dialogues de confirmation de vente, et les canaux communautaires.
**Indicateurs de détection.**
- Libellés asymétriques des contrôles d'opt-in et d'opt-out.
- Recours à l'argot communautaire pour stigmatiser un comportement prudent.
- Prompts de confirmation dont la formulation change selon que l'utilisateur achète ou vend.
**Contre-mesures.** Traiter le libellé asymétrique comme un signal fort de manipulation, indépendamment du contexte. Les enquêteurs devraient capturer en image les deux états de tout toggle ou flux de confirmation.

### Catégorie C — Manipulation technique de l'interface

#### C.1 Positionnement du bouton sniper

**Catégorie.** Manipulation technique de l'interface.
**Mécanisme exploité.** Habituation motrice ; tendance, selon la loi de Fitts, à cliquer sur la cible visuellement la plus saillante.
**Présentation.** Des boutons tels que *Approve unlimited spending*, *Confirm swap*, et *Sign permit* sont placés à proximité spatiale ou chromatique de contrôles moins conséquents. Le focus par défaut est sur l'option la plus coûteuse. La hiérarchie visuelle (taille, couleur, ombre) attire l'œil vers l'action au plus haut risque.
**Pourquoi c'est dangereux.** Les transactions d'approbation illimitée délèguent à un contrat une autorité de dépense durable sur un token ERC-20. Un clic erroné peut laisser une allowance permanente qu'une compromission ultérieure du contrat peut drainer.
**Indicateurs de détection.**
- Le bouton par défaut effectue l'action au coût le plus élevé.
- *Approve* et *Confirm* sont placés dans un faible rayon sans confirmation intermédiaire.
- Les contrôles Annuler ou Retour sont rendus à faible contraste ou cachés dans un menu.
**Contre-mesures.** Les utilisateurs ne devraient jamais signer d'approbations depuis une page sur laquelle ils ne sont pas arrivés délibérément. Les enquêteurs devraient inventorier les permissions accordées par un flux utilisateur typique — approbation totale de token, allowance illimitée, ou permit scopé — et signaler les flux dont la valeur par défaut est illimitée.

#### C.2 Piège de slippage

**Catégorie.** Manipulation technique de l'interface.
**Mécanisme exploité.** Masquage d'information ; biais de valeur par défaut.
**Présentation.** Une interface de swap pré-remplit la tolérance de slippage à une valeur élevée (couramment 15 % ou plus) sous prétexte d'« éviter les transactions échouées ». L'utilisateur, souvent peu familier avec ce que signifie le slippage, accepte la valeur par défaut. Les attaquants sandwich extraient la différence entre le prix attendu et le prix d'exécution accepté jusqu'à la limite de slippage.
**Pourquoi c'est dangereux.** La tolérance de slippage est une permission accordée au contrat de routage d'exécuter le swap à un prix moins favorable que celui annoncé. Un slippage par défaut élevé est un vecteur documenté d'extraction de valeur (Werner et al., 2022, sur le MEV).
**Indicateurs de détection.**
- Slippage par défaut au-dessus des valeurs conventionnelles (typiquement 0,5–3 % pour les paires liquides).
- Réglage du slippage caché derrière un toggle d'options avancées.
- Texte d'avertissement absent ou pré-acquitté.
- Impossibilité de fixer une valeur de slippage plus basse que celle affichée par défaut.
**Contre-mesures.** Vérifier le slippage par défaut avant chaque swap. Considérer comme adversarial tout front-end qui résiste à un abaissement du slippage. Pour les paires à faible liquidité, accepter que l'impact prix est réel et que la tolérance de slippage n'équivaut pas à un prix garanti.

#### C.3 Tokens à taxe cachée

**Catégorie.** Manipulation technique de l'interface.
**Mécanisme exploité.** Masquage d'information ; présomption qu'une interface de swap divulgue intégralement le coût du swap.
**Présentation.** Un contrat de token prélève des frais de transfert (couramment entre 5 et 30 %) à l'achat, à la vente, ou aux deux. Les frais sont versés à un wallet du développeur ou au liquidity pool. Les front-ends et les agrégateurs peuvent ne pas divulguer les frais, et le devis apparent ne les inclut pas.
**Pourquoi c'est dangereux.** L'utilisateur reçoit substantiellement moins que le montant annoncé, souvent sans en avoir immédiatement conscience. Le motif est le plus dommageable lorsque la taxe à la vente est plus élevée que la taxe à l'achat — l'entrée est bon marché, la sortie est coûteuse, et l'asymétrie est opaque.
**Indicateurs de détection.**
- Écart entre le montant annoncé en sortie et le montant reçu.
- Le code source du contrat contient une fonction `taxFee`, `marketingFee`, `liquidityFee`, `_takeFee` non nulle, ou équivalent.
- Adresses exclues (`isExcludedFromFee`) qui incluent le déployeur ou des wallets liés.
- Les trajets d'achat et de vente produisent des ratios de sortie effectifs différents.
**Contre-mesures.** Inspecter le code source du contrat pour la logique de frais sur transfert avant d'interagir. Utiliser un agrégateur de swap qui rapporte le montant effectivement reçu, et non seulement le montant annoncé.

#### C.4 Honeypot UI

**Catégorie.** Manipulation technique de l'interface.
**Mécanisme exploité.** Transfert de confiance de l'achat réussi vers la capacité présumée de sortir.
**Présentation.** Un token autorise les achats mais bloque les ventes. Le blocage peut être implémenté comme un revert au niveau du contrat sur `transfer` depuis des adresses non allow-listées, comme une taxe de vente à 100 %, comme un pool mis en pause, ou comme un cooldown caché. Le front-end peut ne pas signaler l'asymétrie ; les utilisateurs constatent un achat réussi et supposent qu'une liquidité de sortie symétrique existe.
**Pourquoi c'est dangereux.** Ce motif est parmi les plus conséquents parce qu'il transforme l'expérience d'achat elle-même en arme de tromperie : la réussite apparente d'un petit achat initial établit une fausse confiance qui soutient un second achat plus important.
**Indicateurs de détection.**
- Le code source du contrat contient des reverts conditionnels sur le trajet de vente.
- Logique d'allow-list qui restreint `transfer` à des adresses spécifiques.
- Fonctions externellement appelables qui peuvent suspendre ou bloquer le trading après lancement.
- Simulation pré-lancement (ex. via `eth_call` contre un fork) montrant que les achats réussissent et que les ventes revertent.
**Contre-mesures.** Utiliser un service de simulation de contrat avant tout achat non trivial. Pour les nouveaux tokens sans trace d'audit, simuler un achat *et* une vente dans le cadre du même essai. Certains motifs ne sont détectables qu'à l'analyse au niveau du bytecode et peuvent requérir l'outillage d'un enquêteur.

### Catégorie D — Désinformation financière

#### D.1 Roadmap appât-et-substitution

**Catégorie.** Désinformation financière.
**Mécanisme exploité.** Biais des coûts irrécupérables ; engagement et cohérence (Cialdini, 1984).
**Présentation.** Un projet publie une roadmap ambitieuse au lancement — partenariats, produits, audits, listings d'exchanges — et amende ou retire discrètement des items après avoir levé des fonds. Les versions de la roadmap sur des snapshots archivés diffèrent matériellement des versions présentées sur le site actif. Des engagements quantitatifs spécifiques se diluent en formulations d'aspiration.
**Pourquoi c'est dangereux.** Les utilisateurs qui achètent au lancement le font sur la base de la roadmap initiale ; une fois engagés, le biais des coûts irrécupérables les rend résistants à la reconnaissance d'un changement de proposition.
**Indicateurs de détection.**
- Des items de roadmap disparaissent ou sont reformulés entre les snapshots archivés.
- Des engagements spécifiques (partenaires nommés, dates, livrables) deviennent génériques.
- La fréquence de communication chute après l'événement de génération du token.
- La « Phase 1 » reste perpétuellement en cours tandis que les phases ultérieures sont retirées.
**Contre-mesures.** Capturer la roadmap au moment de l'investissement et la comparer périodiquement à la version actuelle. Les archives publiques (Wayback Machine et équivalents) constituent une preuve suffisante dans la plupart des cas.

#### D.2 Théâtre de vesting

**Catégorie.** Désinformation financière.
**Mécanisme exploité.** Ancrage sur la grille de vesting publiée ; présomption qu'un smart contract applique les termes divulgués.
**Présentation.** Le projet publie une grille de vesting qui suggère que les allocations de l'équipe et des initiés sont verrouillées pour une période spécifiée. Le contrat réel peut comporter des fonctions de libération anticipée, des trajets de retrait multi-signatures, ou une allocation séparée non couverte par la grille divulguée. Dans certains cas, le contrat de vesting n'est pas déployé du tout et les tokens demeurent dans un compte externe standard.
**Pourquoi c'est dangereux.** Les utilisateurs sous-estiment la pression vendeuse à court terme parce qu'ils se fient à la grille divulguée. La réalité on-chain du vesting ne peut être évaluée qu'en lisant les adresses de contrat effectives, et non la grille publiée sur le site.
**Indicateurs de détection.**
- Aucun contrat de vesting on-chain n'est vérifiable.
- Le contrat de vesting est upgradable, ownable, ou comporte un retrait callable par admin.
- Les totaux d'allocation affichés sur le site ne réconcilient pas avec les soldes on-chain des tokens.
- Des tokens listés comme « verrouillés » se trouvent dans un compte externe plutôt que dans un contrat.
**Contre-mesures.** Considérer toute revendication de vesting qui n'est pas réductible à une adresse de contrat spécifique vérifiable avec une grille immuable comme du marketing et non comme un engagement.

#### D.3 Faux badges d'audit

**Catégorie.** Désinformation financière.
**Mécanisme exploité.** Heuristique d'autorité ; association visuelle avec des institutions de confiance.
**Présentation.** Un projet affiche des badges ou logos suggérant un audit de sécurité tiers par une firme reconnue. Le badge peut renvoyer à aucun rapport, à un rapport sans rapport, à un document auto-publié, ou à une contrefaçon imitant l'apparence d'un original. Dans certains cas, l'audit a été effectué sur un contrat différent de celui déployé.
**Pourquoi c'est dangereux.** L'attestation d'audit est l'un des rares signaux institutionnels accessibles aux participants retail. La subvertir supprime une primitive de confiance portante.
**Indicateurs de détection.**
- Le badge ne renvoie pas à un rapport publié et daté sur le domaine officiel de la firme d'audit.
- Le rapport couvre une adresse de contrat différente de celle déployée.
- Le domaine de la firme d'audit est un typosquat ou un homoglyphe d'une firme légitime.
- La firme d'audit publie un registre public d'audits et le projet n'y figure pas.
**Contre-mesures.** Valider les revendications d'audit à la source. Maintenir une liste connue de domaines de firmes d'audit. Comparer le bytecode audité au bytecode déployé lorsque c'est faisable.

### Catégorie E — Manipulation d'identité

#### E.1 Usurpation d'identité empilée

**Catégorie.** Manipulation d'identité.
**Mécanisme exploité.** Heuristique d'identité visuelle ; transfert de confiance d'un compte connu vers son sosie.
**Présentation.** Plusieurs comptes usurpent l'identité du fondateur, de l'équipe de support, ou des modérateurs communautaires d'un projet sur Twitter/X, Telegram, Discord, et Farcaster. Les comptes utilisent le même avatar, des handles quasi identiques (caractères de largeur nulle, homoglyphes, variations de suffixes), et répondent rapidement aux utilisateurs discutant du projet. Ils dirigent les victimes vers des sites de phishing ou vers des « tickets de support » qui demandent des seed phrases.
**Pourquoi c'est dangereux.** Les canaux de support crypto sont non régulés et consistent principalement en modérateurs communautaires ; le coût de l'usurpation est proche de zéro et les récompenses sont élevées. Les victimes qui n'entreraient pas leur seed phrase sur un site Web l'entreront en DM avec quelqu'un qui semble être le fondateur.
**Indicateurs de détection.**
- Le handle du compte contient des caractères visuellement similaires mais distincts.
- Le compte a été créé dans les heures suivant le pic d'activité du compte légitime.
- Les réponses apparaissent non sollicitées et dirigent l'utilisateur hors plateforme.
- Plusieurs comptes utilisent le même avatar mais des dates d'inscription différentes.
**Contre-mesures.** Les équipes projet devraient maintenir une liste unique et autoritaire de canaux officiels et y renvoyer les utilisateurs. Les enquêteurs devraient surveiller les comptes nouvellement créés qui répliquent une identité visuelle, particulièrement autour d'événements catalyseurs (listings, exploits, annonces).

#### E.2 Théâtre du doxx

**Catégorie.** Manipulation d'identité.
**Mécanisme exploité.** Heuristique de responsabilité : une identité connue est présumée être une identité contrainte.
**Présentation.** Un projet publie le nom légal, la photographie, ou le profil sur les réseaux sociaux de son prétendu fondateur pour suggérer une forme de responsabilité. L'identité peut être fabriquée, dérobée à un individu sans lien, générée par un modèle de synthèse d'image, ou appartenir à une personne sans rôle opérationnel réel. Les apparitions en conférence et podcast peuvent être mises en scène ou mal attribuées.
**Pourquoi c'est dangereux.** Un fondateur doxxé déplace l'évaluation du risque de l'utilisateur de « anonyme et non responsable » vers « nommé et joignable ». Lorsque le doxx est faux, l'utilisateur a été déplacé vers une posture moins prudente sur la foi d'un signal fabriqué.
**Indicateurs de détection.**
- La recherche d'image inversée ne retourne aucune provenance antérieure au lancement du projet.
- Le profil LinkedIn ou équivalent a été créé dans les mois précédant le projet.
- L'apparition en conférence n'est pas corroborée par l'organisateur de l'événement ou un enregistrement indépendant.
- Les données d'enregistrement de domaine sont incohérentes avec la juridiction nommée.
**Contre-mesures.** Traiter un doxx comme une hypothèse à tester, et non comme une preuve de responsabilité. Vérifier les identités contre des traces institutionnelles préexistantes (publications académiques, emplois antérieurs, dépôts d'industries régulées).

## 4. Études de cas (anonymisées)

Les composites suivants décrivent des combinaisons de motifs observées sur le terrain. Aucun projet réel, token, personne, ou transaction n'est référencé ; les cas sont illustratifs.

**Cas I — Launchpad de presale combinant A.1, A.2, et B.1.**
Une page de presale affichait un compte à rebours de trente minutes et un compteur de « places restantes » se décrémentant côté client. Des comptes coordonnés sur une plateforme sociale publique publiaient de l'enthousiasme avec des gabarits lexicaux partagés. L'adresse du contrat n'était révélée qu'après connexion du wallet. Effet combiné : les utilisateurs complétaient le dépôt en un temps médian substantiellement plus court que le temps nécessaire pour lire le contrat. Les fonds levés s'élevaient à un montant équivalent en bas de la fourchette à sept chiffres en dollars américains avant que le front-end cesse de répondre. Aucun produit ultérieur n'a été livré.

**Cas II — Déploiement de token combinant C.3, C.4, et D.3.**
Un token a été lancé avec un badge d'audit publié renvoyant à un rapport portant sur une version antérieure du contrat. Le contrat déployé incluait des frais de transfert côté vente d'environ un quart de la valeur de la transaction, absents de la version auditée. Après le premier jour de trading, une fonction admin externellement appelable a désactivé entièrement les ventes pour les adresses non allow-listées. Effet combiné : un motif honeypot dissimulé derrière un audit partiellement honnête. Pertes estimées à un montant équivalent à six chiffres bas en dollars américains sur plusieurs centaines de wallets.

**Cas III — Lancement mené par influenceurs combinant B.2, D.1, et E.2.**
Plusieurs comptes à forte audience ont publié, dans une fenêtre de quelques heures, des contenus enthousiastes mais à caractère promotionnel non divulgué au sujet d'un projet. Le site Web du projet publiait une roadmap mentionnant des partenaires institutionnels nommément cités. Dans les trois mois, les partenaires ont disparu de la roadmap et l'identité publiée du fondateur n'a pu être corroborée par aucune trace institutionnelle indépendante. La valeur de marché du token a fortement chuté. Aucune action en justice n'a suivi dans la juridiction pertinente.

**Cas IV — Campagne de phishing combinant E.1 et C.1.**
À la suite d'un exploit public d'un protocole légitime, des comptes d'usurpation d'identité ont émergé en quelques minutes en proposant une « aide à la récupération ». Les comptes dirigeaient les utilisateurs vers un site qui imitait l'interface du protocole légitime mais qui faisait transiter les interactions avec le wallet via un contrat demandant des approbations illimitées de tokens. Le motif combinait une attaque d'identité au niveau social avec un placement de bouton sniper au niveau technique. Pertes rapportées sur plusieurs douzaines de wallets dans une fourchette équivalente à cinq chiffres médians en dollars américains.

Ces composites sont construits pour illustrer des effets de combinaison ; chaque motif individuel est largement rapporté dans les post-mortems sectoriels et la littérature de protection des consommateurs.

## 5. Méthodologie de détection

La taxonomie soutient deux workflows de détection apparentés : (a) un triage par un enquêteur unique, effectué manuellement dans les minutes suivant la rencontre d'un projet candidat, et (b) un screening automatisé, adapté à l'évaluation en lot des lancements de tokens.

### 5.1 Workflow de triage

L'enquêteur doit résoudre, dans cet ordre :

1. **Couche identité.** Le projet nomme-t-il un fondateur ? Cette identité est-elle étayée par des traces institutionnelles préexistantes ? Les canaux officiels sont-ils listés de manière autoritaire ?
2. **Couche audit et divulgation.** Les badges d'audit affichés sont-ils traçables jusqu'à un rapport daté sur le domaine de la firme d'audit ? Le contrat audité correspond-il au contrat déployé ?
3. **Couche contrat.** Lire le code source du contrat déployé. Rechercher spécifiquement : frais de transfert, pauses de trading callables par l'owner, logique d'allow-list sur `transfer`, admins de proxy d'upgrade, contrats de vesting versus comptes externes.
4. **Couche front-end.** Inspecter l'interface de swap ou de vente pour les valeurs de slippage par défaut, le placement des boutons, les libellés de confirmation asymétriques, et la présence de comptes à rebours dont l'échéance ne correspond à aucun champ on-chain.
5. **Couche sociale.** Échantillonner les publications positives récentes et inspecter les signatures de regroupement décrites en B.1 et B.2.

L'enquêteur devrait consigner ses constats face à la taxonomie et assigner une note de risque par catégorie. Le risque combiné n'est pas une simple somme ; certaines combinaisons (D.3 + C.4 ; E.1 + C.1) sont nettement plus dangereuses que les motifs individuels.

### 5.2 Screening automatisé

Le screening automatisé peut traiter un sous-ensemble de ces motifs :
- L'analyse du code source du contrat (C.2, C.3, C.4, D.2, D.3) est mécaniquement tractable.
- La validation des badges d'audit (D.3) se réduit à une comparaison de domaine et de hash contre un registre connu.
- L'analyse du front-end (A.1, C.1) requiert l'automatisation de navigateur mais est faisable à petite échelle.
- L'analyse de la couche sociale (B.1, B.2, E.1) requiert des APIs de plateforme et est soumise à des limitations de taux ; elle s'adapte mal à grande échelle sans infrastructure dédiée.

Les motifs reposant sur l'interprétation subjective du langage et de la hiérarchie visuelle (A.3, B.3) résistent à l'automatisation et restent mieux traités par une revue humaine.

La surface *Investigator Launchpad* d'INTERLIGENS est un outil de triage de ce type ; le présent document est destiné à fournir l'échafaudage conceptuel que de tels outils devraient opérationnaliser.

## 6. Implications réglementaires

### 6.1 Union européenne

Le règlement UE 2022/2065 (Digital Services Act), article 25, interdit aux fournisseurs de plateformes en ligne de « concevoir, organiser ou opérer leurs interfaces en ligne de manière à tromper ou manipuler les destinataires de leurs services », en référence à la dégradation de la « capacité à prendre des décisions libres et éclairées » du destinataire. Le considérant 67 énumère des exemples directement applicables à plusieurs motifs de ce document, dont les timers manipulatoires (A.1), le cadrage par pression sociale (B.3), et les options par défaut asymétriques (C.1).

Le règlement UE 2023/1114 (MiCA) fait entrer les émetteurs de crypto-actifs et les prestataires de services sur crypto-actifs dans un périmètre régulé, exigeant des communications marketing loyales, claires et non trompeuses (article 7, jetons se référant à un ou des actifs ; article 29, prestataires de services sur crypto-actifs). Les motifs D.1, D.2, et D.3 relèvent directement de la norme des communications marketing.

Les autorités nationales de protection des données ont produit des orientations complémentaires. La recommandation 2022 de la CNIL française sur les dark patterns traite de la conception d'interfaces tous secteurs confondus et est pertinente par analogie pour les front-ends crypto visant des utilisateurs de l'UE.

### 6.2 États-Unis

Le rapport du staff de la Federal Trade Commission de septembre 2022 *Bringing Dark Patterns to Light* identifie quatre catégories de pratiques — conçues pour induire de fausses croyances, dissimuler une information matérielle, glisser des items dans les paniers, et subvertir les choix de confidentialité — comme passibles de poursuites au titre de la section 5 du FTC Act. Plusieurs actions d'exécution en 2023–2024 ont appliqué ce cadre à des services d'abonnement non crypto ; l'application aux front-ends crypto demeure naissante mais disponible en principe.

La Securities and Exchange Commission des États-Unis a poursuivi des affaires contre des promoteurs rémunérés non divulgués de crypto-actifs au titre du droit existant des valeurs mobilières, en particulier la section 17(b) du Securities Act de 1933 (anti-touting). Le motif B.2 est l'objet direct d'une telle application.

### 6.3 Limites

La structure juridictionnelle du crypto contraint l'application. Les front-ends peuvent être hébergés dans des juridictions sans régulateur compétent, les smart contracts s'exécutent sur des réseaux sans permission non contrôlés par aucun opérateur, et les opérateurs de manipulation au niveau social sont régulièrement pseudonymes. Même lorsqu'un motif est manifestement illégal, le coût de l'identification, de la notification, et de la poursuite d'un défendeur est élevé par rapport à la valeur en jeu dans la plupart des cas individuels.

Il en résulte qu'en pratique, la défense opérante contre les motifs documentés ici est l'éducation des enquêteurs et des utilisateurs combinée à un outillage de détection, et non l'application réglementaire.

## 7. Recommandations

### 7.1 Pour les utilisateurs

Avant de signer toute transaction crypto issue d'une découverte via les réseaux sociaux :
1. Vérifier l'adresse du contrat à partir d'une source indépendante du front-end qui l'a présentée.
2. Inspecter tout compte à rebours pour son comportement au rechargement.
3. Définir explicitement la tolérance de slippage ; ne pas accepter des valeurs par défaut au-dessus de 3 % sur des paires liquides.
4. Refuser les demandes d'approbation illimitée ; utiliser des permits scopés lorsque le wallet le permet.
5. Simuler les achats et les ventes sur un nœud forké ou via un service de simulation avant tout achat non trivial.
6. Valider les badges d'audit en suivant le lien jusqu'au domaine de la firme d'audit et en confirmant que le contrat déployé correspond.
7. Traiter tout contact de support non sollicité comme adversarial par défaut.
8. Maintenir un wallet séparé pour les interactions non familières ; ne jamais signer de contrats expérimentaux depuis un wallet détenant des positions de long terme.
9. Capturer les roadmaps et les divulgations d'équipe au moment de l'investissement.
10. Reconnaître que le confirmshaming est une manipulation et non une norme communautaire.

### 7.2 Pour les régulateurs

1. Considérer le cadre des dark patterns développé pour les interfaces consommateur (Brignull, Mathur, FTC) comme directement applicable aux front-ends crypto, avec des adaptations pour tenir compte de l'irréversibilité.
2. Exiger la divulgation des relations rémunérées avec les influenceurs, analogue aux règles anti-touting des valeurs mobilières ; appliquer lorsque l'influenceur est à portée juridictionnelle.
3. Établir un registre des firmes d'audit dont les attestations sont reconnues, analogue à la reconnaissance des commissaires aux comptes statutaires dans la finance traditionnelle.
4. Exiger des front-ends dans la juridiction d'exposer l'adresse du contrat et les frais effectifs avant connexion du wallet.
5. Maintenir une coordination inter-juridictionnelle sur les motifs affectant les participants retail transfrontaliers ; l'application nationale isolée s'adapte mal.

### 7.3 Pour les protocoles et les front-ends

1. Régler la tolérance de slippage par défaut sur la valeur la plus basse compatible avec l'exécution ; ne pas pré-remplir de valeurs agressives par confort de routage.
2. Rendre disponibles l'adresse du contrat, la propriété, l'autorité d'upgrade, et la grille de frais avant connexion.
3. Utiliser des approbations scopées (permits EIP-2612 ou équivalent) plutôt que des approbations illimitées par défaut.
4. Publier les listes de canaux de référence dans un emplacement unique, signé, lisible par machine et accessible depuis le front-end.

## 8. Glossaire

**Allow-list.** Ensemble d'adresses, imposé par contrat, autorisées à effectuer une action spécifiée (achat, transfert, claim). Les adresses hors allow-list voient leur transaction reverter.

**Approve-unlimited.** Transaction qui accorde à un contrat la permission de dépenser une quantité illimitée d'un token ERC-20 depuis le wallet de l'utilisateur. La permission persiste jusqu'à révocation explicite.

**Astroturfing.** Activité coordonnée par des comptes présentés comme indépendants, conçue pour fabriquer l'apparence d'un consensus organique.

**Calldata.** L'appel de fonction encodé et ses arguments envoyés dans une transaction. Les wallets l'affichent comme payload hexadécimal au moment de la signature.

**Confirmshaming.** Catégorie de dark pattern dans laquelle l'option de décliner est libellée dans un langage stigmatisant.

**Doxx.** Divulgation (authentique ou fabriquée) d'une identité du monde réel derrière une présence en ligne pseudonyme.

**EIP-712.** Standard Ethereum pour la signature de données structurées typées, utilisé par les approbations de style permit.

**FOMO.** Fear of missing out ; étiquette familière pour les décisions guidées par la peur du regret anticipé.

**Front-end.** Site Web ou application orienté utilisateur qui interfaçe avec un smart contract ; juridiquement et techniquement séparable du contrat lui-même.

**Honeypot.** Token ou contrat qui accepte les entrées mais bloque ou taxe punitivement les sorties.

**KOL.** Key opinion leader ; compte à portée substantielle dont les recommandations influencent les abonnés.

**Liquidity pool.** Smart contract détenant une paire (ou un ensemble) d'actifs qui valorise et exécute les swaps contre ses réserves.

**MEV.** Maximal extractable value ; valeur capturée en réordonnant, en incluant, ou en excluant des transactions au sein d'un bloc.

**Permit.** Signature accordant une approbation scopée (typiquement EIP-2612), souvent limitée dans le temps et en montant.

**Roadmap.** Calendrier publié des livrables d'un projet.

**Slippage tolerance.** Tolérance fixée par l'utilisateur correspondant à l'écart maximal acceptable entre prix annoncé et prix exécuté pour un swap.

**Sockpuppet.** Compte opéré par un acteur distinct de l'identité présentée, utilisé pour fabriquer un soutien.

**Tax token.** Token qui prélève des frais de transfert sur les achats, les ventes, ou les deux.

**Vesting.** Grille restreignant quand et combien d'une allocation peuvent être transférés ou vendus.

**Wash trading.** Trades entre adresses contrôlées par le même acteur, utilisés pour fabriquer un volume apparent.

**Whitelist.** Synonyme d'allow-list, souvent utilisé de manière informelle dans les contextes marketing.

## 9. Références

Les références suivantes sont destinées à être vérifiables par sources primaires. Lorsqu'un document est publié par une institution publique, le nom de l'institution est le localisateur.

1. Brignull, H. (2010). *Dark Patterns* (initialement darkpatterns.org, désormais deceptive.design). Définition fondatrice du terme.
2. Cialdini, R. B. (1984). *Influence: The Psychology of Persuasion*. HarperCollins. Source pour les heuristiques de rareté, d'autorité, et de preuve sociale appliquées tout au long du document.
3. Parlement européen et Conseil. (2022). *Règlement (UE) 2022/2065 sur un marché unique des services numériques (Digital Services Act)*. Article 25 et considérant 67 sur les dark patterns.
4. Parlement européen et Conseil. (2023). *Règlement (UE) 2023/1114 sur les marchés de crypto-actifs (MiCA)*. Articles 7 et 29 sur les communications marketing.
5. Federal Trade Commission. (2022, septembre). *Bringing Dark Patterns to Light*. FTC Staff Report.
6. Gray, C. M., Kou, Y., Battles, B., Hoggatt, J., & Toombs, A. L. (2018). *The Dark (Patterns) Side of UX Design*. Proceedings of the 2018 CHI Conference on Human Factors in Computing Systems.
7. Kahneman, D. (2011). *Thinking, Fast and Slow*. Farrar, Straus and Giroux. Source pour le cadrage de la double-pensée pertinent pour les décisions sous pression temporelle.
8. Kahneman, D., & Tversky, A. (1979). *Prospect Theory: An Analysis of Decision under Risk*. Econometrica, 47(2). Article fondateur sur l'aversion à la perte.
9. Mathur, A., Acar, G., Friedman, M. J., Lucherini, E., Mayer, J., Chetty, M., & Narayanan, A. (2019). *Dark Patterns at Scale: Findings from a Crawl of 11K Shopping Websites*. Proceedings of the ACM on Human-Computer Interaction, CSCW.
10. Mathur, A., Kshirsagar, M., & Mayer, J. (2021). *What Makes a Dark Pattern... Dark? Design Attributes, Normative Considerations, and Measurement Methods*. Proceedings of the 2021 CHI Conference.
11. Norwegian Consumer Council (Forbrukerrådet). (2018). *Deceived by Design*. Rapport sur les dark patterns dans les interfaces consommateur.
12. OECD. (2022). *Dark commercial patterns*. OECD Digital Economy Papers, No. 336.
13. Thaler, R. H., & Sunstein, C. R. (2008). *Nudge: Improving Decisions About Health, Wealth, and Happiness*. Yale University Press. Cadre de référence pour le biais de défaut et l'architecture de choix.

Les praticiens peuvent en outre consulter les rapports de l'ENISA sur les menaces liées aux cryptomonnaies et les orientations des autorités nationales compétentes (par exemple, les recommandations de la CNIL française sur la conception trompeuse d'interface, 2022).

## 10. Disclaimer

Ce document est une analyse descriptive de motifs d'interface et de discours observables. Il ne nomme aucune entité, projet, token, personne, ou affaire spécifique. Toute ressemblance entre les cas composites de la section 4 et des événements réels est descriptive et non accusatoire ; les composites sont construits à partir de phénomènes publics largement rapportés et ne formulent aucune accusation contre une partie identifiable.

La taxonomie est offerte comme un vocabulaire pour les enquêteurs, les chercheurs, les régulateurs, et les participants retail éduqués. Elle ne constitue pas un avis juridique. Les questions spécifiques d'application doivent être référées à un conseil compétent dans la juridiction concernée.

INTERLIGENS Research, 2026. Sous licence Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0). Autorisé à être redistribué et adapté à des fins non commerciales avec attribution.
