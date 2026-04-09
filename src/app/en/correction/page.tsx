"use client"
import BetaNav from "@/components/beta/BetaNav";
import React, { useState } from 'react'

export default function CorrectionPage() {
  const [type, setType] = useState<'factual' | 'attribution' | 'wallet' | null>(null)

  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#f9fafb', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>
      <BetaNav />

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 24px' }}>

        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 10, color: '#F85B05', fontWeight: 900, letterSpacing: '0.2em', marginBottom: 12 }}>FORMAL CORRECTION PROCESS</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', margin: 0, marginBottom: 16 }}>Request a Correction or Dispute an Attribution</h1>
          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.7 }}>
            INTERLIGENS maintains a formal correction process. If you believe information published on this platform is factually inaccurate, incorrectly sourced, or misattributed, you may submit a correction request with supporting evidence.
          </div>
        </div>

        {/* Request type selector */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: '#4b5563', letterSpacing: '0.2em', marginBottom: 14 }}>SELECT REQUEST TYPE</div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
            {[
              { key: 'factual', label: 'Factual Error', desc: 'On-chain data, transaction hash, token address, or date is incorrect.' },
              { key: 'attribution', label: 'Source Misattribution', desc: 'A claim is attributed to a source that does not say what is represented, or the source has been retracted.' },
              { key: 'wallet', label: 'Wallet Misattribution', desc: 'A wallet address is attributed to you or a third party incorrectly.' },
            ].map(opt => (
              <div key={opt.key} onClick={() => setType(opt.key as any)}
                style={{ background: type === opt.key ? '#0f172a' : '#0a0a0a', border: '1px solid ' + (type === opt.key ? '#F85B05' : '#1f2937'), borderRadius: 8, padding: '14px 18px', cursor: 'pointer', borderLeft: '3px solid ' + (type === opt.key ? '#F85B05' : '#1f2937') }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: type === opt.key ? '#f9fafb' : '#6b7280', marginBottom: 4 }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: '#4b5563' }}>{opt.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Evidence guidance */}
        {type && (
          <div style={{ background: '#0a0a0a', border: '1px solid #1f2937', borderRadius: 10, padding: '20px 22px', marginBottom: 28 }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: '#4b5563', letterSpacing: '0.2em', marginBottom: 12 }}>WHAT TO INCLUDE IN YOUR SUBMISSION</div>
            {type === 'factual' && (
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#6b7280', lineHeight: 2 }}>
                <li>The specific claim you are disputing (exact text or field)</li>
                <li>The correct transaction hash, address, or data point</li>
                <li>Block explorer link confirming the correct data</li>
                <li>Date and URL of the profile page</li>
              </ul>
            )}
            {type === 'attribution' && (
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#6b7280', lineHeight: 2 }}>
                <li>The specific claim and its current source citation</li>
                <li>Evidence that the source does not support the claim (archive link, screenshot)</li>
                <li>If applicable, evidence of retraction or correction by the original source</li>
              </ul>
            )}
            {type === 'wallet' && (
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#6b7280', lineHeight: 2 }}>
                <li>The wallet address you are disputing</li>
                <li>Evidence that the attribution is incorrect (on-chain proof of non-ownership)</li>
                <li>Note: public blockchain addresses are by nature pseudonymous; attribution disputes are reviewed against the original source evidence</li>
              </ul>
            )}
          </div>
        )}

        {/* Contact */}
        <div style={{ background: '#0f172a', border: '1px solid #1f2937', borderRadius: 10, padding: '20px 22px', marginBottom: 28 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: '#4b5563', letterSpacing: '0.2em', marginBottom: 12 }}>SUBMIT YOUR REQUEST</div>
          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.75, marginBottom: 14 }}>
            Send your submission with supporting evidence to:
          </div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#F85B05', fontFamily: 'monospace' }}>admin@interligens.com</div>
          <div style={{ fontSize: 11, color: '#374151', marginTop: 10 }}>
            Subject line: <span style={{ fontFamily: 'monospace', color: '#4b5563' }}>CORRECTION REQUEST — [Profile Handle] — [Request Type]</span>
          </div>
        </div>

        {/* Process */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: '#4b5563', letterSpacing: '0.2em', marginBottom: 14 }}>REVIEW PROCESS</div>
          {[
            { time: '~24h', action: 'Target for verifiable factual errors upon confirmation.' },
            { time: '~48h', action: 'Target for source misattribution and wallet disputes.' },
            { time: '~72h', action: 'Target for complex or contested cases. Written response provided.' },
          ].map(p => (
            <div key={p.time} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 12 }}>
              <span style={{ background: '#0a0a0a', border: '1px solid #1f2937', borderRadius: 4, padding: '3px 10px', fontSize: 10, fontWeight: 900, color: '#F85B05', fontFamily: 'monospace', flexShrink: 0 }}>{p.time}</span>
              <span style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{p.action}</span>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid #111827', paddingTop: 20, fontSize: 11, color: '#374151', lineHeight: 1.7 }}>
          All disputes are logged and version-tracked. Corrected profiles display a public correction notice.
          <br />INTERLIGENS Delaware C-Corp · Not legal advice
        </div>
      </div>
    </div>
  )
}
