export default function MethodologyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#030712', color: '#f9fafb', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>
      <div style={{ background: '#0a0a0a', borderBottom: '1px solid #111827', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href="/en/demo" style={{ color: '#F85B05', fontSize: 11, fontWeight: 900, textDecoration: 'none', letterSpacing: '0.15em', fontFamily: 'monospace' }}>← INTERLIGENS</a>
        <span style={{ color: '#1f2937' }}>·</span>
        <span style={{ color: '#4b5563', fontSize: 11, letterSpacing: '0.1em', fontFamily: 'monospace' }}>METHODOLOGY</span>
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

        <div style={{ borderTop: '1px solid #111827', paddingTop: 24, fontSize: 11, color: '#374151', lineHeight: 1.7 }}>
          Questions about methodology or specific calculations: <span style={{ color: '#F85B05' }}>legal@interligens.com</span>
          <br />INTERLIGENS Delaware C-Corp · Not legal advice · Not financial advice
        </div>
      </div>
    </div>
  )
}
