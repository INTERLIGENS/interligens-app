export default function MethodologyPageFR() {
  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#f9fafb', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>
      <div style={{ background: '#0a0a0a', borderBottom: '1px solid #111827', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href="/fr" style={{ color: '#F85B05', fontSize: 11, fontWeight: 900, textDecoration: 'none', letterSpacing: '0.15em', fontFamily: 'monospace' }}>← INTERLIGENS</a>
        <span style={{ color: '#1f2937' }}>·</span>
        <span style={{ color: '#F85B05', fontSize: 11, letterSpacing: '0.1em', fontFamily: 'monospace' }}>METHODOLOGIE</span>
        <span style={{ color: '#1f2937' }}>·</span>
        <a href="/fr/kol" style={{ color: '#4b5563', fontSize: 11, letterSpacing: '0.1em', fontFamily: 'monospace', textDecoration: 'none' }}>CLASSEMENT</a>
        <span style={{ color: '#1f2937' }}>·</span>
        <a href="/fr/explorer" style={{ color: '#4b5563', fontSize: 11, letterSpacing: '0.1em', fontFamily: 'monospace', textDecoration: 'none' }}>EXPLORATEUR</a>
        <span style={{ color: '#1f2937' }}>·</span>
        <a href="/fr/correction" style={{ color: '#4b5563', fontSize: 11, letterSpacing: '0.1em', fontFamily: 'monospace', textDecoration: 'none' }}>CORRECTIONS</a>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px' }}>

        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 10, color: '#F85B05', fontWeight: 900, letterSpacing: '0.2em', marginBottom: 12 }}>MÉTHODOLOGIE DE PREUVE</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 16, margin: 0 }}>Comment INTERLIGENS calcule ses estimations financières</h1>
          <div style={{ marginTop: 12, fontSize: 13, color: '#6b7280', lineHeight: 1.7 }}>
            INTERLIGENS publie des estimations financières dérivées de données blockchain accessibles publiquement. Ces chiffres sont des estimations analytiques — et non des faits établis ni des conclusions juridiques.
          </div>
        </div>

        {[
          {
            title: 'Pertes estimées des investisseurs',
            body: "Représente la valeur agrégée estimée perdue par les participants retail dans les cas documentés liés à des rugs associés à ce profil. Calculée comme la valeur USD approximative des tokens achetés par des portefeuilles non-initiés, diminuée de toute valeur récupérée, sur la base des prix de marché contemporains au moment de l'effondrement. Il s'agit d'une estimation. Les pertes individuelles peuvent varier significativement."
          },
          {
            title: 'Gains estimés',
            body: "Représente la valeur USD estimée perçue par les portefeuilles liés aux initiés ou aux promoteurs via l'allocation de tokens pré-lancement, l'activité de vente ou la rémunération de promotion attribuée. Dérivée de transactions de transfert et de swap observables on-chain, valorisées aux prix de marché ou LP contemporains."
          },
          {
            title: 'Référence de prix',
            body: "Les prix des tokens sont issus de DexScreener, GeckoTerminal ou du pricing LP on-chain au moment de la transaction concernée. En cas de conflit entre plusieurs sources, INTERLIGENS utilise le point de données le plus proche du timestamp de transaction. Les sources de prix sont documentées dans l'enregistrement de preuve sous-jacent."
          },
          {
            title: 'Base temporelle',
            body: "Les calculs financiers couvrent l'intégralité de l'historique on-chain disponible pour les adresses de portefeuille et les contrats de tokens référencés. La plage temporelle est indiquée dans l'enregistrement de preuve du profil. Les chiffres ne sont pas prospectifs et n'incluent pas les positions non réalisées sauf mention explicite."
          },
          {
            title: 'Inclusions et exclusions',
            body: "Seuls les portefeuilles avec un lien on-chain documenté (vérifié ou attribué à une source) sont inclus dans les calculs financiers. Les portefeuilles classés comme provisoires ou liés par heuristique sont exclus des chiffres principaux et notés séparément. Les adresses de routeurs DEX et les contrats de pool de liquidité sont exclus."
          },
          {
            title: 'Réalisé vs. non réalisé',
            body: "Sauf indication contraire, tous les chiffres de gains estimés reflètent des transactions réalisées — événements de vente observables ou transferts de tokens avec flux de valeur correspondants. Les positions non réalisées sont exclues du chiffre principal et notées lorsqu'elles sont significatives."
          },
          {
            title: 'Confiance et révision',
            body: "Toutes les estimations basées sur la méthodologie comportent une incertitude inhérente. INTERLIGENS révise les chiffres publiés lorsque de nouvelles preuves on-chain émergent ou lorsqu'une demande de correction fournit des données probantes. Les chiffres révisés sont enregistrés avec des notes de version. La méthodologie est révisée trimestriellement."
          },
        ].map(s => (
          <div key={s.title} style={{ marginBottom: 32, borderLeft: '3px solid #1f2937', paddingLeft: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#f9fafb', letterSpacing: '0.05em', marginBottom: 8 }}>{s.title}</div>
            <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.75 }}>{s.body}</div>
          </div>
        ))}

        {/* ── METHODOLOGIE D'INTELLIGENCE ── */}
        <div style={{ marginTop: 48, marginBottom: 40 }}>
          <div style={{ fontSize: 10, color: '#F85B05', fontWeight: 900, letterSpacing: '0.2em', marginBottom: 12 }}>METHODOLOGIE D'INTELLIGENCE</div>
          <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', margin: 0, marginBottom: 8 }}>Comment INTERLIGENS documente l'activite d'influence crypto</h2>
        </div>

        {[
          {
            title: 'Ce que nous documentons',
            body: "INTERLIGENS agregre l'activite on-chain publiquement accessible, le contenu social archive publiquement, et les liens documentes entre lancements crypto, profils d'influenceurs et flux financiers. Nous n'attribuons pas d'intention criminelle ni de responsabilite juridique. Tous les profils publies atteignent un seuil minimum de preuves avant d'etre visibles publiquement.",
          },
          {
            title: 'Produits observes',
            body: "Les chiffres etiquetes \"Min. observe\" representent des evenements de cashout on-chain identifies sur des wallets documentes. Ce sont des minimums — pas des gains totaux, pas un patrimoine net. La couverture est notee partielle lorsque l'attribution de wallets est incomplete. Nous utilisons des donnees de prix historiques reelles pour convertir les montants en tokens en equivalents USD au moment de la transaction.",
          },
          {
            title: 'Wallets documentes',
            body: "Les wallets sont associes a un profil lorsqu'ils sont soutenus par une documentation publique verifiable — preuves on-chain, declarations publiques ou materiel source revise. La force d'attribution est notee : Confirme, Eleve, Moyen. Les wallets en cours de revision ne sont pas affiches publiquement.",
          },
          {
            title: 'Acteurs lies & Signaux de coordination',
            body: "Lorsque deux profils publies ou plus partagent des lancements documentes, des clusters de cas ou des schemas comportementaux recurrents, INTERLIGENS met en evidence ces chevauchements comme acteurs lies ou signaux de coordination. Ceux-ci refletent une co-occurrence observee — pas des assertions de coordination juridique ou de conspiration.",
          },
          {
            title: 'Publie vs Interne',
            body: "Seuls les profils avec un statut publie sont visibles sur les surfaces publiques. Les profils en revision, restreints ou en brouillon ne sont pas exposes. Les elements de preuves et les captures suivent la meme regle.",
          },
          {
            title: 'Limites des donnees',
            body: "Certaines donnees sont partielles. Les clusters de wallets peuvent etre incomplets. Les chiffres de produits sont des planchers, pas des plafonds. La confiance d'attribution varie selon le profil. INTERLIGENS met a jour les profils a mesure que la documentation s'ameliore. Rien de ce qui est publie ici ne constitue un conseil juridique ou une conclusion judiciaire.",
          },
          {
            title: 'Transparence volontaire',
            body: "Certains acteurs choisissent de soumettre volontairement leurs adresses de wallets pour un monitoring public. Ces wallets portent la mention \"auto-declare\" et sont revises avant affichage public. La divulgation volontaire ne constitue pas un soutien, une certification ou une evaluation de risque par INTERLIGENS. Soumettez vos wallets sur /fr/transparency.",
          },
        ].map(s => (
          <div key={s.title} style={{ marginBottom: 32, borderLeft: '3px solid #1f2937', paddingLeft: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#f9fafb', letterSpacing: '0.05em', marginBottom: 8 }}>{s.title}</div>
            <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.75 }}>{s.body}</div>
          </div>
        ))}

        {/* Standard de preuve */}
        <div style={{ background: '#0a0a0a', border: '1px solid #1f293788', borderRadius: 10, padding: '18px 22px', marginBottom: 32 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: '#374151', letterSpacing: '0.2em', marginBottom: 12 }}>STANDARD DE PREUVE</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            {[
              ['VERIFIE ON-CHAIN', '#10b981'],
              ['SOURCE CITEE', '#3b82f6'],
              ['ESTIMATION ANALYTIQUE', '#f59e0b'],
              ['NON UNE DECISION JUDICIAIRE', '#6b7280'],
            ].map(([label, color]) => (
              <span key={label} style={{ background: color + '15', border: '1px solid ' + color + '44', color, fontSize: 8, fontWeight: 900, padding: '3px 10px', borderRadius: 4, letterSpacing: '0.1em' }}>{label}</span>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid #111827', paddingTop: 24, fontSize: 11, color: '#374151', lineHeight: 1.7, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 8 }}>
          <span>Questions sur la methodologie : <span style={{ color: '#F85B05' }}>admin@interligens.com</span>
          <br />INTERLIGENS Delaware C-Corp · Ne constitue pas un conseil juridique · Ne constitue pas un conseil financier</span>
          <div style={{ display: 'flex', gap: 16 }}>
            <a href="/fr/correction" style={{ color: '#4b5563', textDecoration: 'none', fontWeight: 700 }}>Demander une correction →</a>
            <a href="/fr/kol" style={{ color: '#4b5563', textDecoration: 'none', fontWeight: 700 }}>Classement KOL →</a>
            <a href="/fr/explorer" style={{ color: '#4b5563', textDecoration: 'none', fontWeight: 700 }}>Explorateur →</a>
          </div>
        </div>
      </div>
    </div>
  )
}
