export default function MethodologyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#030712', color: '#f9fafb', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>
      <div style={{ background: '#0a0a0a', borderBottom: '1px solid #111827', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href="/en/demo" style={{ color: '#F85B05', fontSize: 11, fontWeight: 900, textDecoration: 'none', letterSpacing: '0.15em', fontFamily: 'monospace' }}>← INTERLIGENS</a>
        <span style={{ color: '#1f2937' }}>·</span>
        <span style={{ color: '#F85B05', fontSize: 11, letterSpacing: '0.1em', fontFamily: 'monospace' }}>METHODOLOGY</span>
        <span style={{ color: '#1f2937' }}>·</span>
        <a href="/en/kol" style={{ color: '#4b5563', fontSize: 11, letterSpacing: '0.1em', fontFamily: 'monospace', textDecoration: 'none' }}>LEADERBOARD</a>
        <span style={{ color: '#1f2937' }}>·</span>
        <a href="/en/explorer" style={{ color: '#4b5563', fontSize: 11, letterSpacing: '0.1em', fontFamily: 'monospace', textDecoration: 'none' }}>EXPLORER</a>
        <span style={{ color: '#1f2937' }}>·</span>
        <a href="/en/correction" style={{ color: '#4b5563', fontSize: 11, letterSpacing: '0.1em', fontFamily: 'monospace', textDecoration: 'none' }}>CORRECTIONS</a>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px' }}>

        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 10, color: '#F85B05', fontWeight: 900, letterSpacing: '0.2em', marginBottom: 12 }}>EVIDENCE METHODOLOGY</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 16, margin: 0 }}>How INTERLIGENS Calculates Financial Estimates</h1>
          <div style={{ marginTop: 12, fontSize: 13, color: '#6b7280', lineHeight: 1.7 }}>
            INTERLIGENS publishes estimated financial figures derived from publicly available blockchain data. These figures are analytical estimates — not established facts, not legal conclusions.
          </div>
        </div>

        {[
          {
            title: 'Est. Investor Losses',
            body: 'Represents the estimated aggregate value lost by retail market participants in documented rug-linked cases associated with this profile. Calculated as the approximate USD value of tokens purchased by non-insider wallets minus any recovered value, based on contemporaneous market pricing at the time of collapse. This is an estimate. Individual loss figures may vary significantly.'
          },
          {
            title: 'Est. Proceeds',
            body: 'Represents the estimated USD value received by insider-linked or promoter-linked wallets through pre-launch token allocation, sell activity, or attributed promotion compensation. Derived from observable on-chain transfer and swap transactions valued at contemporaneous market or LP price data.'
          },
          {
            title: 'Pricing Reference',
            body: 'Token prices are sourced from DexScreener, GeckoTerminal, or on-chain LP pricing at the time of the relevant transaction. Where multiple sources conflict, INTERLIGENS uses the closest available data point to the transaction timestamp. Pricing sources are documented in the underlying evidence record.'
          },
          {
            title: 'Time Basis',
            body: 'Financial calculations cover all available on-chain history for the wallet addresses and token contracts referenced. The time range is noted in the profile evidence record. Figures are not forward-looking and do not include unrealized positions unless explicitly stated.'
          },
          {
            title: 'Inclusions and Exclusions',
            body: 'Only wallets with documented on-chain linkage (verified or source-attributed) are included in financial calculations. Wallets classified as provisional or heuristically linked are excluded from primary figures and noted separately. DEX router addresses and liquidity pool contracts are excluded.'
          },
          {
            title: 'Realized vs. Unrealized',
            body: 'Unless stated otherwise, all estimated proceeds figures reflect realized transactions — observable sell events or token transfers with corresponding value flows. Unrealized positions are excluded from the primary figure and noted where material.'
          },
          {
            title: 'Confidence and Revision',
            body: 'All methodology-based estimates carry inherent uncertainty. INTERLIGENS reviews published figures when new on-chain evidence emerges or when a correction request provides supporting data. Revised figures are logged with version notes. The methodology is reviewed quarterly.'
          },
        ].map(s => (
          <div key={s.title} style={{ marginBottom: 32, borderLeft: '3px solid #1f2937', paddingLeft: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#f9fafb', letterSpacing: '0.05em', marginBottom: 8 }}>{s.title}</div>
            <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.75 }}>{s.body}</div>
          </div>
        ))}

        {/* ── INTELLIGENCE METHODOLOGY ── */}
        <div style={{ marginTop: 48, marginBottom: 40 }}>
          <div style={{ fontSize: 10, color: '#F85B05', fontWeight: 900, letterSpacing: '0.2em', marginBottom: 12 }}>INTELLIGENCE METHODOLOGY</div>
          <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', margin: 0, marginBottom: 8 }}>How INTERLIGENS Documents Crypto Influence Activity</h2>
        </div>

        {[
          {
            title: 'What We Document',
            body: 'INTERLIGENS aggregates publicly available on-chain activity, publicly archived social content, and documented links between crypto launches, influencer profiles, and financial flows. We do not assert criminal intent or legal liability. All published profiles meet a minimum evidence threshold before becoming publicly visible.',
          },
          {
            title: 'Observed Proceeds',
            body: 'Figures labeled "Min. observed" represent on-chain cashout events identified across documented wallets. These are minimums — not total earnings, not net worth. Coverage is noted as partial when wallet attribution is incomplete. We use real historical pricing data to convert token amounts to USD equivalents at the time of transaction.',
          },
          {
            title: 'Documented Wallets',
            body: 'Wallets are associated with a profile when supported by verifiable public documentation — on-chain evidence, public statements, or reviewed source material. Attribution strength is noted: Confirmed, High, Medium. Wallets marked as under review are not publicly displayed.',
          },
          {
            title: 'Related Actors & Coordination Signals',
            body: 'When two or more published profiles share documented launches, case clusters, or recurring behavioral patterns, INTERLIGENS surfaces these overlaps as related actors or coordination signals. These reflect observed co-occurrence — not assertions of legal coordination or conspiracy.',
          },
          {
            title: 'Published vs Internal',
            body: 'Only profiles with published status are visible on public surfaces. Profiles under review, restricted, or in draft state are not exposed. Evidence items and snapshots follow the same gate.',
          },
          {
            title: 'Data Limits',
            body: 'Some data is partial. Wallet clusters may be incomplete. Proceeds figures are floors, not ceilings. Attribution confidence varies by profile. INTERLIGENS updates profiles as documentation improves. Nothing published here constitutes legal advice or a judicial finding.',
          },
          {
            title: 'Voluntary Transparency',
            body: 'Some actors choose to voluntarily submit their wallet addresses for public monitoring. These wallets are labeled "self-submitted" and are reviewed before public display. Voluntary disclosure does not constitute endorsement, certification, or an assessment of risk by INTERLIGENS. Submit wallets at /en/transparency.',
          },
        ].map(s => (
          <div key={s.title} style={{ marginBottom: 32, borderLeft: '3px solid #1f2937', paddingLeft: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#f9fafb', letterSpacing: '0.05em', marginBottom: 8 }}>{s.title}</div>
            <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.75 }}>{s.body}</div>
          </div>
        ))}

        {/* Evidence Standard */}
        <div style={{ background: '#0a0a0a', border: '1px solid #1f293788', borderRadius: 10, padding: '18px 22px', marginBottom: 32 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: '#374151', letterSpacing: '0.2em', marginBottom: 12 }}>EVIDENCE STANDARD</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            {[
              ['VERIFIED ON-CHAIN', '#10b981'],
              ['SOURCE-ATTRIBUTED', '#3b82f6'],
              ['ANALYTICAL ESTIMATE', '#f59e0b'],
              ['NOT A JUDICIAL FINDING', '#6b7280'],
            ].map(([label, color]) => (
              <span key={label} style={{ background: color + '15', border: '1px solid ' + color + '44', color, fontSize: 8, fontWeight: 900, padding: '3px 10px', borderRadius: 4, letterSpacing: '0.1em' }}>{label}</span>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid #111827', paddingTop: 24, fontSize: 11, color: '#374151', lineHeight: 1.7, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 8 }}>
          <span>Questions about methodology: <span style={{ color: '#F85B05' }}>legal@interligens.com</span>
          <br />INTERLIGENS Delaware C-Corp · Not legal advice · Not financial advice</span>
          <div style={{ display: 'flex', gap: 16 }}>
            <a href="/en/correction" style={{ color: '#4b5563', textDecoration: 'none', fontWeight: 700 }}>Request a correction →</a>
            <a href="/en/kol" style={{ color: '#4b5563', textDecoration: 'none', fontWeight: 700 }}>KOL Leaderboard →</a>
            <a href="/en/explorer" style={{ color: '#4b5563', textDecoration: 'none', fontWeight: 700 }}>Explorer →</a>
          </div>
        </div>
      </div>
    </div>
  )
}
