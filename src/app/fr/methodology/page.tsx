export default function MethodologyPageFR() {
  return (
    <div style={{ minHeight: '100vh', background: '#030712', color: '#f9fafb', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>
      <div style={{ background: '#0a0a0a', borderBottom: '1px solid #111827', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href="/fr" style={{ color: '#F85B05', fontSize: 11, fontWeight: 900, textDecoration: 'none', letterSpacing: '0.15em', fontFamily: 'monospace' }}>← INTERLIGENS</a>
        <span style={{ color: '#1f2937' }}>·</span>
        <span style={{ color: '#4b5563', fontSize: 11, letterSpacing: '0.1em', fontFamily: 'monospace' }}>MÉTHODOLOGIE</span>
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

        <div style={{ borderTop: '1px solid #111827', paddingTop: 24, fontSize: 11, color: '#374151', lineHeight: 1.7 }}>
          Questions sur la méthodologie ou des calculs spécifiques : <span style={{ color: '#F85B05' }}>legal@interligens.com</span>
          <br />INTERLIGENS Delaware C-Corp · Ne constitue pas un conseil juridique · Ne constitue pas un conseil financier
        </div>
      </div>
    </div>
  )
}
