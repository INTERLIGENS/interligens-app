"use client"
import React, { useState } from 'react'

export default function CorrectionPageFR() {
  const [type, setType] = useState<'factual' | 'attribution' | 'wallet' | null>(null)

  return (
    <div style={{ minHeight: '100vh', background: '#030712', color: '#f9fafb', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>
      <div style={{ background: '#0a0a0a', borderBottom: '1px solid #111827', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <a href="/fr" style={{ color: '#F85B05', fontSize: 11, fontWeight: 900, textDecoration: 'none', letterSpacing: '0.15em', fontFamily: 'monospace' }}>← INTERLIGENS</a>
        <span style={{ color: '#1f2937' }}>·</span>
        <span style={{ color: '#4b5563', fontSize: 11, letterSpacing: '0.1em', fontFamily: 'monospace' }}>DEMANDE DE CORRECTION</span>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 24px' }}>

        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 10, color: '#F85B05', fontWeight: 900, letterSpacing: '0.2em', marginBottom: 12 }}>PROCÉDURE FORMELLE DE CORRECTION</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', margin: 0, marginBottom: 16 }}>Demander une correction ou contester une attribution</h1>
          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.7 }}>
            INTERLIGENS maintient une procédure formelle de correction. Si vous estimez qu'une information publiée sur cette plateforme est factuellement inexacte, incorrectement sourcée ou mal attribuée, vous pouvez soumettre une demande de correction avec les preuves à l'appui.
          </div>
        </div>

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: '#4b5563', letterSpacing: '0.2em', marginBottom: 14 }}>SÉLECTIONNER LE TYPE DE DEMANDE</div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
            {[
              { key: 'factual', label: 'Erreur factuelle', desc: 'Une donnée on-chain, un hash de transaction, une adresse de token ou une date est incorrecte.' },
              { key: 'attribution', label: 'Attribution de source erronée', desc: "Une affirmation est attribuée à une source qui ne dit pas ce qui est représenté, ou la source a été rétractée." },
              { key: 'wallet', label: 'Attribution de portefeuille erronée', desc: 'Une adresse de portefeuille vous est attribuée ou attribuée à un tiers de manière incorrecte.' },
            ].map(opt => (
              <div key={opt.key} onClick={() => setType(opt.key as any)}
                style={{ background: type === opt.key ? '#0f172a' : '#0a0a0a', border: '1px solid ' + (type === opt.key ? '#F85B05' : '#1f2937'), borderRadius: 8, padding: '14px 18px', cursor: 'pointer', borderLeft: '3px solid ' + (type === opt.key ? '#F85B05' : '#1f2937') }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: type === opt.key ? '#f9fafb' : '#6b7280', marginBottom: 4 }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: '#4b5563' }}>{opt.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {type && (
          <div style={{ background: '#0a0a0a', border: '1px solid #1f2937', borderRadius: 10, padding: '20px 22px', marginBottom: 28 }}>
            <div style={{ fontSize: 9, fontWeight: 900, color: '#4b5563', letterSpacing: '0.2em', marginBottom: 12 }}>CE QU'IL FAUT INCLURE DANS VOTRE SOUMISSION</div>
            {type === 'factual' && (
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#6b7280', lineHeight: 2 }}>
                <li>L'affirmation spécifique que vous contestez (texte exact ou champ concerné)</li>
                <li>Le hash de transaction, l'adresse ou la donnée correcte</li>
                <li>Lien vers un explorateur de blocs confirmant la donnée correcte</li>
                <li>Date et URL de la page de profil concernée</li>
              </ul>
            )}
            {type === 'attribution' && (
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#6b7280', lineHeight: 2 }}>
                <li>L'affirmation spécifique et sa citation de source actuelle</li>
                <li>Preuve que la source ne soutient pas l'affirmation (lien archive, capture d'écran)</li>
                <li>Le cas échéant, preuve de rétractation ou de correction par la source originale</li>
              </ul>
            )}
            {type === 'wallet' && (
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#6b7280', lineHeight: 2 }}>
                <li>L'adresse de portefeuille que vous contestez</li>
                <li>Preuve que l'attribution est incorrecte (preuve on-chain de non-propriété)</li>
                <li>Note : les adresses blockchain publiques sont par nature pseudonymes ; les contestations d'attribution sont examinées au regard des preuves sources originales</li>
              </ul>
            )}
          </div>
        )}

        <div style={{ background: '#0f172a', border: '1px solid #1f2937', borderRadius: 10, padding: '20px 22px', marginBottom: 28 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: '#4b5563', letterSpacing: '0.2em', marginBottom: 12 }}>SOUMETTRE VOTRE DEMANDE</div>
          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.75, marginBottom: 14 }}>
            Envoyez votre soumission avec les preuves à l'appui à :
          </div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#F85B05', fontFamily: 'monospace' }}>legal@interligens.com</div>
          <div style={{ fontSize: 11, color: '#374151', marginTop: 10 }}>
            Objet : <span style={{ fontFamily: 'monospace', color: '#4b5563' }}>DEMANDE DE CORRECTION — [Handle du profil] — [Type de demande]</span>
          </div>
        </div>

        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 9, fontWeight: 900, color: '#4b5563', letterSpacing: '0.2em', marginBottom: 14 }}>PROCÉDURE D'EXAMEN</div>
          {[
            { time: '24h', action: 'Les erreurs factuelles vérifiables sont corrigées immédiatement après confirmation.' },
            { time: '48h', action: "Les contestations d'attribution de source et de portefeuille sont examinées et font l'objet d'une réponse." },
            { time: '72h', action: 'Les cas complexes ou contestés sont évalués avec une réponse écrite.' },
          ].map(p => (
            <div key={p.time} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginBottom: 12 }}>
              <span style={{ background: '#0a0a0a', border: '1px solid #1f2937', borderRadius: 4, padding: '3px 10px', fontSize: 10, fontWeight: 900, color: '#F85B05', fontFamily: 'monospace', flexShrink: 0 }}>{p.time}</span>
              <span style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{p.action}</span>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid #111827', paddingTop: 20, fontSize: 11, color: '#374151', lineHeight: 1.7 }}>
          Toutes les contestations sont enregistrées et versionnées. Les profils corrigés affichent un avis de correction public.
          <br />INTERLIGENS Delaware C-Corp · Ne constitue pas un conseil juridique
        </div>
      </div>
    </div>
  )
}
