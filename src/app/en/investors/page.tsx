import BetaNav from "@/components/beta/BetaNav";

const O = "#FF6B00";

export default function InvestorsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#f9fafb', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <BetaNav />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 56px' }}>

        {/* ── HERO ── */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: O, fontWeight: 800, letterSpacing: '0.25em', flexShrink: 0 }}>INVESTORS</div>
          <div style={{ height: 1, flex: 1, background: '#1a1a1a' }} />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.025em', lineHeight: 1.3, margin: '0 0 10px' }}>
          Crypto risk intelligence<span style={{ color: O }}>.</span>
        </h1>
        <p style={{ fontSize: 14, color: '#a1a1aa', lineHeight: 1.7, margin: '0 0 28px', maxWidth: 540 }}>
          On-chain evidence scoring for tokens and wallets. 75+ documented KOL profiles,
          $330K+ in traced proceeds, 5 chains, 24h correction SLA. Retail-first surface,
          investigator-grade depth.
        </p>

        {/* ── METRICS — inline row ── */}
        <div style={{ display: 'flex', gap: 40, marginBottom: 36 }}>
          {[
            { v: '75+', l: 'Profiles' },
            { v: '$330K+', l: 'Traced' },
            { v: '5', l: 'Chains' },
            { v: '68+', l: 'Labels' },
          ].map(m => (
            <div key={m.l}>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', fontFamily: 'monospace', lineHeight: 1 }}>{m.v}</div>
              <div style={{ fontSize: 8, color: '#3f3f46', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, marginTop: 5 }}>{m.l}</div>
            </div>
          ))}
        </div>

        {/* ── DATA ROOM ── */}
        <div style={{
          background: '#060606',
          border: '1px solid #1a1a1a',
          borderTop: `2px solid ${O}`,
          borderRadius: 8,
          padding: '20px 24px',
          marginBottom: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Data Room</div>
            <div style={{ fontSize: 12, color: '#52525b', lineHeight: 1.5 }}>Architecture, methodology, evidence system, security, legal, financials.</div>
          </div>
          <a
            href="https://data.interligens.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '10px 28px',
              background: O,
              color: '#000',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.06em',
              borderRadius: 4,
              textDecoration: 'none',
              whiteSpace: 'nowrap' as const,
              flexShrink: 0,
            }}
          >
            OPEN &rarr;
          </a>
        </div>

        {/* ── PLATFORM CREDIBILITY — 4 readable panels ── */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 9, color: '#3f3f46', fontWeight: 700, letterSpacing: '0.2em' }}>PLATFORM CREDIBILITY</div>
          <div style={{ height: 1, flex: 1, background: '#111' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 40 }}>
          {/* Scoring Methodology */}
          <div style={{ background: '#060606', border: '1px solid #1a1a1a', borderRadius: 8, padding: '20px 22px' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e4e4e7', marginBottom: 8 }}>Scoring Methodology</div>
            <div style={{ fontSize: 12, color: '#71717a', lineHeight: 1.65, marginBottom: 10 }}>
              Every score is computed from on-chain data using a documented, repeatable process.
            </div>
            <ul style={{ margin: 0, paddingLeft: 14, fontSize: 11, color: '#52525b', lineHeight: 1.8 }}>
              <li>4-tier evidence classification</li>
              <li>Confidence levels per signal</li>
              <li>Quarterly methodology review</li>
            </ul>
            <a href="/en/methodology" style={{ display: 'inline-block', marginTop: 12, fontSize: 10, fontWeight: 700, color: O, textDecoration: 'none' }}>Read full methodology &rarr;</a>
          </div>

          {/* Correction Process */}
          <div style={{ background: '#060606', border: '1px solid #1a1a1a', borderRadius: 8, padding: '20px 22px' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e4e4e7', marginBottom: 8 }}>Correction Process</div>
            <div style={{ fontSize: 12, color: '#71717a', lineHeight: 1.65, marginBottom: 10 }}>
              Any published profile can be formally disputed. Every correction is version-tracked.
            </div>
            <ul style={{ margin: 0, paddingLeft: 14, fontSize: 11, color: '#52525b', lineHeight: 1.8 }}>
              <li>24h for verifiable factual errors</li>
              <li>48h for source misattributions</li>
              <li>Public notice on revised profiles</li>
            </ul>
            <a href="/en/correction" style={{ display: 'inline-block', marginTop: 12, fontSize: 10, fontWeight: 700, color: O, textDecoration: 'none' }}>View correction process &rarr;</a>
          </div>

          {/* Transparency Program */}
          <div style={{ background: '#060606', border: '1px solid #1a1a1a', borderRadius: 8, padding: '20px 22px' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e4e4e7', marginBottom: 8 }}>Transparency Program</div>
            <div style={{ fontSize: 12, color: '#71717a', lineHeight: 1.65, marginBottom: 10 }}>
              Monitored actors can voluntarily disclose their wallets for public tracking.
            </div>
            <ul style={{ margin: 0, paddingLeft: 14, fontSize: 11, color: '#52525b', lineHeight: 1.8 }}>
              <li>Self-submitted wallets labeled clearly</li>
              <li>Reviewed before publication</li>
              <li>Not an endorsement or certification</li>
            </ul>
            <a href="/en/transparency" style={{ display: 'inline-block', marginTop: 12, fontSize: 10, fontWeight: 700, color: O, textDecoration: 'none' }}>View transparency program &rarr;</a>
          </div>

          {/* Victim Support */}
          <div style={{ background: '#060606', border: '1px solid #1a1a1a', borderRadius: 8, padding: '20px 22px' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e4e4e7', marginBottom: 8 }}>Victim Support</div>
            <div style={{ fontSize: 12, color: '#71717a', lineHeight: 1.65, marginBottom: 10 }}>
              Users can check if their wallet was involved in a documented scam and generate reports.
            </div>
            <ul style={{ margin: 0, paddingLeft: 14, fontSize: 11, color: '#52525b', lineHeight: 1.8 }}>
              <li>Address lookup against scam database</li>
              <li>Pre-filled Binance compliance template</li>
              <li>FBI IC3 and FINMA templates</li>
            </ul>
            <a href="/en/victim" style={{ display: 'inline-block', marginTop: 12, fontSize: 10, fontWeight: 700, color: O, textDecoration: 'none' }}>View victim support &rarr;</a>
          </div>
        </div>

        {/* ── CONTACT ── */}
        <div style={{ borderTop: '1px solid #111', paddingTop: 20, fontSize: 13, color: '#52525b' }}>
          <span style={{ color: O, fontWeight: 700 }}>admin@interligens.com</span>
          <span style={{ margin: '0 10px', color: '#1a1a1a' }}>|</span>
          Delaware C-Corp
          <span style={{ margin: '0 10px', color: '#1a1a1a' }}>|</span>
          NDA confidential
        </div>

      </div>
    </div>
  );
}
