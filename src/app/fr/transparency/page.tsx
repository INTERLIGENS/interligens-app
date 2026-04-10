'use client'
import React, { useState } from 'react'
import BetaNav from '@/components/beta/BetaNav'

export default function TransparencyFR() {
  const [handle, setHandle] = useState('')
  const [contact, setContact] = useState('')
  const [platform, setPlatform] = useState('X')
  const [walletsText, setWalletsText] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const submit = async () => {
    if (!handle.trim()) { setResult({ ok: false, message: 'Le handle ou nom de projet est requis.' }); return }
    const lines = walletsText.trim().split('\n').filter(Boolean)
    if (lines.length === 0) { setResult({ ok: false, message: 'Au moins une adresse de wallet est requise.' }); return }
    const wallets = lines.map(line => {
      const parts = line.trim().split(/[\s,]+/)
      const chain = ['SOL', 'ETH', 'BSC', 'TRON'].includes(parts[0]?.toUpperCase()) ? parts.shift()!.toUpperCase() : 'SOL'
      return { chain, address: parts.join(''), label: undefined }
    }).filter(w => w.address.length >= 20)
    if (wallets.length === 0) { setResult({ ok: false, message: 'Aucune adresse valide trouvee.' }); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/transparency/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: handle.trim(), contact: contact.trim() || undefined, platform, wallets, notes: notes.trim() || undefined }),
      })
      const data = await res.json()
      setResult({ ok: res.ok, message: data.message ?? data.error ?? 'Soumis.' })
    } catch { setResult({ ok: false, message: 'Erreur reseau. Veuillez reessayer.' }) }
    finally { setSubmitting(false) }
  }

  const SectionHeader = ({ children }: { children: string }) => (
    <div style={{ fontSize: 9, fontWeight: 900, color: '#4b5563', letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: 12 }}>{children}</div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#f9fafb', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>
      <BetaNav />

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 10, color: '#F85B05', fontWeight: 900, letterSpacing: '0.2em', marginBottom: 12 }}>DIVULGATION VOLONTAIRE</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', margin: 0, marginBottom: 16 }}>Transparence volontaire des wallets</h1>
          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.7 }}>
            Certains acteurs choisissent de divulguer publiquement leurs wallets pour le monitoring et la responsabilite.
          </div>
        </div>

        <div style={{ marginBottom: 28, borderLeft: '3px solid #1f2937', paddingLeft: 20 }}>
          <SectionHeader>CE QUE C'EST</SectionHeader>
          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.75 }}>
            INTERLIGENS permet aux fondateurs, KOLs et operateurs de projets de soumettre volontairement leurs adresses de wallets pour un monitoring public. Les wallets soumis sont clairement etiquetes comme auto-declares — non attribues par investigation.
          </div>
        </div>

        <div style={{ marginBottom: 28, borderLeft: '3px solid #f59e0b44', paddingLeft: 20 }}>
          <SectionHeader>CE QUE CE N'EST PAS</SectionHeader>
          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.75 }}>
            Soumettre vos wallets ne constitue pas une approbation, une certification ou un soutien d'INTERLIGENS. Cela n'implique pas qu'INTERLIGENS considere un acteur comme sur, fiable ou sans risque. La divulgation volontaire est un signal de transparence, pas un certificat de bonne sante.
          </div>
        </div>

        <div style={{ marginBottom: 32, borderLeft: '3px solid #1f2937', paddingLeft: 20 }}>
          <SectionHeader>APRES LA SOUMISSION</SectionHeader>
          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.75 }}>
            Toutes les soumissions sont revisees en interne avant tout affichage public. Si acceptees, les wallets soumis portent la mention : "Auto-declare — divulgation volontaire". La visibilite publique est a la discretion editoriale d'INTERLIGENS.
          </div>
        </div>

        {/* FORM */}
        <div style={{ background: '#0d1117', border: '1px solid #1e2330', borderRadius: 12, padding: '28px' }}>
          <SectionHeader>SOUMETTRE VOS WALLETS</SectionHeader>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace', display: 'block', marginBottom: 6 }}>Handle X ou nom de projet *</label>
              <input value={handle} onChange={e => setHandle(e.target.value)} placeholder="@votrehandle ou NomDuProjet"
                style={{ width: '100%', background: '#0a0a0a', border: '1px solid #1e2330', borderRadius: 6, padding: '10px 14px', color: '#f9fafb', fontSize: 13, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace', display: 'block', marginBottom: 6 }}>Email de contact (optionnel)</label>
              <input value={contact} onChange={e => setContact(e.target.value)} placeholder="vous@email.com" type="email"
                style={{ width: '100%', background: '#0a0a0a', border: '1px solid #1e2330', borderRadius: 6, padding: '10px 14px', color: '#f9fafb', fontSize: 13, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace', display: 'block', marginBottom: 6 }}>Plateforme</label>
              <select value={platform} onChange={e => setPlatform(e.target.value)}
                style={{ background: '#0a0a0a', border: '1px solid #1e2330', borderRadius: 6, padding: '10px 14px', color: '#f9fafb', fontSize: 13, fontFamily: 'monospace', outline: 'none' }}>
                <option value="X">X / Twitter</option>
                <option value="Telegram">Telegram</option>
                <option value="Other">Autre</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace', display: 'block', marginBottom: 6 }}>Adresses de wallets (une par ligne, prefixe avec la chain : SOL / ETH / BSC)</label>
              <textarea value={walletsText} onChange={e => setWalletsText(e.target.value)} rows={5}
                placeholder={'SOL 5ed7HUrYWS8h7EwM6wBpCvUHP...\nETH 0xa5B0eDF6B55128E0DdaE8e51...'}
                style={{ width: '100%', background: '#0a0a0a', border: '1px solid #1e2330', borderRadius: 6, padding: '10px 14px', color: '#f9fafb', fontSize: 12, fontFamily: 'monospace', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace', display: 'block', marginBottom: 6 }}>Notes (optionnel)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Contexte supplementaire..."
                style={{ width: '100%', background: '#0a0a0a', border: '1px solid #1e2330', borderRadius: 6, padding: '10px 14px', color: '#f9fafb', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <button onClick={submit} disabled={submitting}
              style={{ background: '#F85B05', color: '#fff', border: 'none', borderRadius: 6, padding: '12px 20px', fontSize: 12, fontWeight: 900, letterSpacing: '0.1em', fontFamily: 'monospace', cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'ENVOI EN COURS...' : 'SOUMETTRE POUR REVISION'}
            </button>
            {result && (
              <div style={{ padding: '12px 16px', background: result.ok ? '#10b98115' : '#ef444415', border: '1px solid ' + (result.ok ? '#10b98144' : '#ef444444'), borderRadius: 8, fontSize: 12, color: result.ok ? '#10b981' : '#ef4444' }}>
                {result.message}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 48, borderTop: '1px solid #1e2330', paddingTop: 20, color: '#374151', fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.1em', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span>INTERLIGENS Delaware C-Corp {'\u00b7'} Ne constitue pas un soutien</span>
          <div style={{ display: 'flex', gap: 16 }}>
            <a href="/fr/methodology" style={{ color: '#4b5563', textDecoration: 'none' }}>METHODOLOGIE {'\u2192'}</a>
            <a href="/fr/correction" style={{ color: '#4b5563', textDecoration: 'none' }}>CORRECTIONS {'\u2192'}</a>
          </div>
        </div>
      </div>
    </div>
  )
}
