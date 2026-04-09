'use client'
import BetaNav from "@/components/beta/BetaNav";
import React, { useState } from 'react'

export default function VictimReportPage() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    token: '', date: '', wallet: '', loss: '', txHash: '',
    exchange: '', actor: '', platform: 'X (Twitter)', description: '', kolHandle: '',
  })
  const [template, setTemplate] = useState<'binance'|'ic3'|null>(null)
  const [copied, setCopied] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const inp: React.CSSProperties = {
    background: '#0f172a', border: '1px solid #1f2937', borderRadius: 6,
    color: '#f9fafb', padding: '11px 14px', fontSize: 13, width: '100%',
    fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' as const,
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 9, fontWeight: 900, color: '#4b5563', letterSpacing: '0.2em',
    display: 'block', marginBottom: 6, textTransform: 'uppercase' as const,
  }

  const binanceTpl = [
    'Subject: Report of Fraudulent Activity — Crypto Scam / Rug Pull',
    '',
    'To the Binance Compliance & AML Team,',
    '',
    'I am writing to report a fraudulent scheme in which I suffered financial losses.',
    '',
    '— INCIDENT SUMMARY —',
    'Token / Project: ' + (form.token || '[TOKEN NAME]'),
    'Date of incident: ' + (form.date || '[DATE]'),
    'My wallet address: ' + (form.wallet || '[YOUR WALLET]'),
    'Approximate loss: ' + (form.loss || '[AMOUNT]') + ' USD',
    form.txHash ? 'Transaction hash: ' + form.txHash : '',
    '',
    '— DESCRIPTION —',
    form.description || '[DESCRIBE WHAT HAPPENED]',
    '',
    'I believe funds from this scheme were routed through Binance. I request that any accounts receiving these funds be flagged and frozen pending investigation.',
    '',
    'Sincerely,',
    '[YOUR NAME] / [YOUR EMAIL]',
    '',
    'Reference: INTERLIGENS Intelligence Report — ' + (form.token || '[TOKEN]'),
    'Platform: https://app.interligens.com',
  ].filter(l => l !== null).join('\n')

  const ic3Tpl = [
    'IC3 COMPLAINT — FBI INTERNET CRIME COMPLAINT CENTER',
    'Submission: https://www.ic3.gov/complaint/default.aspx',
    '',
    'COMPLAINT TYPE: Cryptocurrency Fraud / Investment Scam',
    '',
    '— SUBJECT —',
    'Token / Project: ' + (form.token || '[TOKEN NAME]'),
    'Date: ' + (form.date || '[DATE]'),
    '',
    '— FINANCIAL LOSS —',
    'Amount lost: ' + (form.loss || '[AMOUNT]') + ' USD',
    'Your wallet: ' + (form.wallet || '[YOUR WALLET]'),
    form.txHash ? 'Transaction hash: ' + form.txHash : '',
    '',
    '— DESCRIPTION —',
    form.description || '[DESCRIBE WHAT HAPPENED]',
    '',
    'The project was promoted by social media influencers who received undisclosed compensation. After launch, liquidity was removed and the token became worthless.',
    '',
    '— EVIDENCE —',
    'INTERLIGENS Report: https://app.interligens.com/en/kol/' + (form.kolHandle || '[KOL-HANDLE]'),
    '',
    '— KNOWN ACTOR —',
    'Handle: ' + (form.actor || '[ACTOR]'),
    'Platform: ' + form.platform,
    '',
    'I declare this information is true and accurate to the best of my knowledge.',
  ].filter(l => l !== null).join('\n')

  const activeTemplate = template === 'binance' ? binanceTpl : ic3Tpl

  const copy = () => {
    navigator.clipboard.writeText(activeTemplate).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#f9fafb', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>
      <BetaNav />

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px' }}>

        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 10, color: '#F85B05', fontWeight: 900, letterSpacing: '0.2em', marginBottom: 10 }}>YOU WERE SCAMMED — HERE IS WHAT TO DO</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', margin: 0, marginBottom: 12 }}>File Your Report</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.7 }}>
            Fill in the details below. We will generate ready-to-send report templates for Binance compliance and the FBI IC3. It takes 5 minutes and creates a formal paper trail.
          </p>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          {[1,2,3].map(s => (
            <div key={s} onClick={() => s < step && setStep(s)} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= step ? '#F85B05' : '#1f2937', cursor: s < step ? 'pointer' : 'default' }} />
          ))}
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#f9fafb', letterSpacing: '0.1em', marginBottom: 24 }}>STEP 1 — WHAT HAPPENED</div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 18 }}>
              <div><span style={labelStyle}>Token / Project Name</span><input style={inp} value={form.token} onChange={e => set('token', e.target.value)} placeholder='e.g. BOTIFY, $VINE, $TRUMP' /></div>
              <div><span style={labelStyle}>Date of Incident</span><input style={inp} type='date' value={form.date} onChange={e => set('date', e.target.value)} /></div>
              <div><span style={labelStyle}>Approximate Loss (USD)</span><input style={inp} value={form.loss} onChange={e => set('loss', e.target.value)} placeholder='e.g. 2500' /></div>
              <div>
                <span style={labelStyle}>Exchange Used</span>
                <select style={{ ...inp, cursor: 'pointer' }} value={form.exchange} onChange={e => set('exchange', e.target.value)}>
                  <option value=''>Select exchange</option>
                  {['Binance','Coinbase','Kraken','OKX','Bybit','KuCoin','Gate.io','Huobi','Other'].map(x => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <span style={labelStyle}>Description — what happened, step by step</span>
                <textarea style={{ ...inp, minHeight: 100, resize: 'vertical' as const, lineHeight: 1.6 }}
                  value={form.description} onChange={e => set('description', e.target.value)}
                  placeholder='I saw a promotion from @[handle] on X. I bought [amount] of [token]. The token then dropped to zero...' />
              </div>
            </div>
            <button onClick={() => setStep(2)} style={{ marginTop: 24, background: '#F85B05', border: 'none', borderRadius: 8, color: '#000', fontWeight: 900, fontSize: 12, padding: '12px 28px', cursor: 'pointer', letterSpacing: '0.1em' }}>
              NEXT →
            </button>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#f9fafb', letterSpacing: '0.1em', marginBottom: 24 }}>STEP 2 — ON-CHAIN DETAILS</div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 18 }}>
              <div><span style={labelStyle}>Your Wallet Address</span><input style={inp} value={form.wallet} onChange={e => set('wallet', e.target.value)} placeholder='0x... or Solana address' /></div>
              <div><span style={labelStyle}>Transaction Hash (optional)</span><input style={inp} value={form.txHash} onChange={e => set('txHash', e.target.value)} placeholder='0x...' /></div>
              <div><span style={labelStyle}>Known Actor Handle</span><input style={inp} value={form.actor} onChange={e => set('actor', e.target.value)} placeholder='@handle' /></div>
              <div>
                <span style={labelStyle}>INTERLIGENS KOL Profile Handle (if known)</span>
                <input style={inp} value={form.kolHandle} onChange={e => set('kolHandle', e.target.value)} placeholder='e.g. bkokoski' />
                <div style={{ fontSize: 10, color: '#374151', marginTop: 6 }}>Find at app.interligens.com/en/kol/[handle]</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setStep(1)} style={{ background: 'transparent', border: '1px solid #374151', borderRadius: 8, color: '#6b7280', fontWeight: 700, fontSize: 12, padding: '12px 20px', cursor: 'pointer' }}>← BACK</button>
              <button onClick={() => setStep(3)} style={{ background: '#F85B05', border: 'none', borderRadius: 8, color: '#000', fontWeight: 900, fontSize: 12, padding: '12px 28px', cursor: 'pointer', letterSpacing: '0.1em' }}>GENERATE REPORTS →</button>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#f9fafb', letterSpacing: '0.1em', marginBottom: 8 }}>STEP 3 — YOUR REPORT TEMPLATES</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 24, lineHeight: 1.6 }}>Select a template, copy it, and submit to the platform.</div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              {[
                { key: 'binance', label: 'Binance Compliance', url: 'https://www.binance.com/en/support/requests/new', color: '#f59e0b' },
                { key: 'ic3', label: 'FBI IC3', url: 'https://www.ic3.gov', color: '#3b82f6' },
              ].map(t => (
                <div key={t.key} onClick={() => setTemplate(t.key as any)}
                  style={{ flex: 1, background: template === t.key ? t.color + '22' : '#0a0a0a', border: '1px solid ' + (template === t.key ? t.color : '#1f2937'), borderRadius: 8, padding: '14px 16px', cursor: 'pointer' }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: template === t.key ? t.color : '#6b7280', marginBottom: 4 }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: '#374151' }}>{t.url}</div>
                </div>
              ))}
            </div>

            {template && (
              <div style={{ marginBottom: 16 }}>
                <pre style={{ background: '#0a0a0a', border: '1px solid #1f2937', borderRadius: 8, padding: '18px 20px', fontSize: 11, color: '#94a3b8', lineHeight: 1.7, whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const, maxHeight: 400, overflowY: 'auto' as const, fontFamily: 'monospace' }}>
                  {template === 'binance' ? binanceTpl : ic3Tpl}
                </pre>
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button onClick={copy} style={{ flex: 1, background: copied ? '#10b981' : '#F85B05', border: 'none', borderRadius: 8, color: copied ? '#fff' : '#000', fontWeight: 900, fontSize: 12, padding: '12px', cursor: 'pointer', letterSpacing: '0.1em' }}>
                    {copied ? '✓ COPIED TO CLIPBOARD' : 'COPY REPORT →'}
                  </button>
                  <a href={template === 'binance' ? 'https://www.binance.com/en/support/requests/new' : 'https://www.ic3.gov/complaint/default.aspx'}
                    target='_blank' rel='noreferrer'
                    style={{ background: '#0a0a0a', border: '1px solid #374151', borderRadius: 8, color: '#9ca3af', fontWeight: 700, fontSize: 12, padding: '12px 16px', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                    OPEN FORM →
                  </a>
                </div>
              </div>
            )}

            <div style={{ background: '#0a0a0a', border: '1px solid #1f2937', borderRadius: 10, padding: '18px 20px', marginTop: 24 }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: '#374151', letterSpacing: '0.2em', marginBottom: 12 }}>WHAT HAPPENS NEXT</div>
              {[
                { n: '1.', text: 'Submit the Binance report first — exchanges can freeze funds faster than law enforcement.' },
                { n: '2.', text: 'File with IC3 — creates an official US federal record, required for civil litigation.' },
                { n: '3.', text: 'Save confirmation numbers. Forward to legal@interligens.com if you want to join a class action.' },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 10, fontWeight: 900, color: '#F85B05', fontFamily: 'monospace', flexShrink: 0 }}>{s.n}</span>
                  <span style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>{s.text}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setStep(2)} style={{ background: 'transparent', border: '1px solid #374151', borderRadius: 8, color: '#6b7280', fontWeight: 700, fontSize: 12, padding: '12px 20px', cursor: 'pointer' }}>← BACK</button>
              <a href='mailto:legal@interligens.com?subject=Victim Report — Class Action Interest'
                style={{ background: '#0a0a0a', border: '1px solid #374151', borderRadius: 8, color: '#9ca3af', fontWeight: 700, fontSize: 12, padding: '12px 20px', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                JOIN CLASS ACTION →
              </a>
            </div>

            <div style={{ marginTop: 24, fontSize: 10, color: '#1f2937', lineHeight: 1.7 }}>
              Not legal advice. INTERLIGENS Intelligence © 2026 · INTERLIGENS Delaware C-Corp
            </div>
          </div>
        )}
      </div>
    </div>
  )
}