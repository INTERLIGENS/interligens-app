'use client'
import BetaNav from "@/components/beta/BetaNav";
import Link from "next/link";
import React, { useState } from 'react'

export default function VictimReportPageFr() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    token: '', date: '', wallet: '', loss: '', txHash: '',
    exchange: '', actor: '', platform: 'X (Twitter)', description: '', kolHandle: '',
    email: '',
  })
  const [template, setTemplate] = useState<'binance'|'ic3'|'finma'|null>(null)
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
    'Objet : Signalement d’activité frauduleuse — Arnaque crypto / Rug pull',
    'À : compliance@binance.com',
    '',
    'À l’équipe Conformité & LAB de Binance,',
    '',
    'Je vous écris pour signaler un dispositif frauduleux qui m’a causé des pertes financières.',
    '',
    '— RÉSUMÉ DE L’INCIDENT —',
    'Token / Projet : ' + (form.token || '[NOM DU TOKEN]'),
    'Date de l’incident : ' + (form.date || '[DATE]'),
    'Mon adresse de wallet : ' + (form.wallet || '[VOTRE WALLET]'),
    'Perte approximative : ' + (form.loss || '[MONTANT]') + ' USD',
    form.txHash ? 'Hash de transaction : ' + form.txHash : '',
    '',
    '— DESCRIPTION —',
    form.description || '[DÉCRIVEZ CE QUI S’EST PASSÉ]',
    '',
    'Je pense que les fonds issus de ce dispositif ont transité par Binance. Je demande que tout compte ayant reçu ces fonds soit signalé et gelé dans l’attente d’une enquête.',
    '',
    'Cordialement,',
    '[VOTRE NOM] / ' + (form.email || '[VOTRE EMAIL]'),
    '',
    'Référence : Rapport d’intelligence INTERLIGENS — ' + (form.token || '[TOKEN]'),
    'Plateforme : https://app.interligens.com',
  ].filter(l => l !== null).join('\n')

  const ic3Tpl = [
    'PLAINTE IC3 — FBI INTERNET CRIME COMPLAINT CENTER',
    'Soumission : https://www.ic3.gov/complaint/default.aspx',
    '',
    'TYPE DE PLAINTE : Fraude aux crypto-actifs / Arnaque à l’investissement',
    '',
    '— OBJET —',
    'Token / Projet : ' + (form.token || '[NOM DU TOKEN]'),
    'Date : ' + (form.date || '[DATE]'),
    '',
    '— PERTE FINANCIÈRE —',
    'Montant perdu : ' + (form.loss || '[MONTANT]') + ' USD',
    'Votre wallet : ' + (form.wallet || '[VOTRE WALLET]'),
    form.txHash ? 'Hash de transaction : ' + form.txHash : '',
    'Email de contact : ' + (form.email || '[VOTRE EMAIL]'),
    '',
    '— DESCRIPTION —',
    form.description || '[DÉCRIVEZ CE QUI S’EST PASSÉ]',
    '',
    'Le projet a été promu par des influenceurs sur les réseaux sociaux ayant reçu une rémunération non divulguée. Après le lancement, la liquidité a été retirée et le token est devenu sans valeur.',
    '',
    '— PREUVES —',
    'Rapport INTERLIGENS : https://app.interligens.com/fr/kol/' + (form.kolHandle || '[HANDLE-KOL]'),
    '',
    '— ACTEUR CONNU —',
    'Pseudonyme : ' + (form.actor || '[ACTEUR]'),
    'Plateforme : ' + form.platform,
    '',
    'Je déclare que ces informations sont exactes et véridiques à ma connaissance.',
    '',
    'NB : le formulaire IC3 est en anglais. Une traduction anglaise peut être requise lors de la soumission.',
  ].filter(l => l !== null).join('\n')

  const finmaTpl = [
    'FINMA — Autorité fédérale de surveillance des marchés financiers (Suisse)',
    'Signalement formel d’une activité financière frauduleuse ou non autorisée',
    'Soumission : https://www.finma.ch/fr/finma-public/etablissements-non-autorises/',
    'Adresse : FINMA, Laupenstrasse 27, CH-3003 Berne, Suisse',
    '',
    'Date : ' + (form.date || '[DATE]'),
    '',
    'À la Division Enforcement de la FINMA,',
    '',
    'Je souhaite signaler formellement une offre de crypto-actifs qui, selon moi,',
    'relève d’une activité financière frauduleuse ou non autorisée et qui m’a',
    'causé une perte financière.',
    '',
    '— PARTIE DÉCLARANTE —',
    'Email de contact : ' + (form.email || '[VOTRE EMAIL]'),
    '',
    '— OBJET DU SIGNALEMENT —',
    'Token / Projet : ' + (form.token || '[NOM DU TOKEN]'),
    'Date de l’incident : ' + (form.date || '[DATE]'),
    'Perte approximative : ' + (form.loss || '[MONTANT]') + ' USD',
    'Plateforme d’échange impliquée : ' + (form.exchange || '[ÉCHANGE]'),
    '',
    '— RÉFÉRENCES ON-CHAIN —',
    'Mon adresse de wallet : ' + (form.wallet || '[VOTRE WALLET]'),
    form.txHash ? 'Hash de transaction : ' + form.txHash : '',
    '',
    '— DESCRIPTION —',
    form.description || '[DÉCRIVEZ CE QUI S’EST PASSÉ]',
    '',
    'Je demande respectueusement à la FINMA d’examiner si cette offre a été menée',
    'sans l’autorisation requise et si des entités ou intermédiaires établis en',
    'Suisse ont participé à la gestion des fonds des investisseurs.',
    '',
    'Veuillez agréer mes salutations distinguées,',
    '[VOTRE NOM]',
    '',
    'Référence : Rapport d’intelligence INTERLIGENS — ' + (form.token || '[TOKEN]'),
  ].filter(l => l !== null).join('\n')

  const templates = { binance: binanceTpl, ic3: ic3Tpl, finma: finmaTpl }
  const activeTemplate = template ? templates[template] : ''

  const copy = () => {
    navigator.clipboard.writeText(activeTemplate).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#000000', color: '#f9fafb', fontFamily: 'Inter, sans-serif', paddingBottom: 80 }}>
      <BetaNav />

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '48px 24px' }}>

        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'inline-block', fontSize: 9, color: '#F85B05', fontWeight: 900, letterSpacing: '0.2em', marginBottom: 14, border: '1px solid #F85B05', borderRadius: 4, padding: '4px 9px' }}>
            INTERLIGENS · SOUTIEN AUX VICTIMES
          </div>
          <div style={{ fontSize: 10, color: '#F85B05', fontWeight: 900, letterSpacing: '0.2em', marginBottom: 10 }}>VOUS AVEZ ÉTÉ ARNAQUÉ — VOICI QUOI FAIRE</div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', margin: 0, marginBottom: 12 }}>Signaler une arnaque crypto</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.7 }}>
            Remplissez les détails ci-dessous. Nous générons des modèles de signalement prêts à envoyer pour la conformité Binance, le FBI IC3 et le régulateur suisse FINMA. Cela prend 5 minutes et crée une trace écrite formelle. Rien de ce que vous saisissez ne quitte votre navigateur — aucun stockage, aucun appel serveur.
          </p>
        </div>

        {/* Progression */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
          {[1,2,3].map(s => (
            <div key={s} onClick={() => s < step && setStep(s)} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= step ? '#F85B05' : '#1f2937', cursor: s < step ? 'pointer' : 'default' }} />
          ))}
        </div>

        {/* ÉTAPE 1 */}
        {step === 1 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#f9fafb', letterSpacing: '0.1em', marginBottom: 24 }}>ÉTAPE 1 — CE QUI S’EST PASSÉ</div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 18 }}>
              <div><span style={labelStyle}>Nom du token / projet</span><input style={inp} value={form.token} onChange={e => set('token', e.target.value)} placeholder='ex. BOTIFY, $VINE, $TRUMP' /></div>
              <div><span style={labelStyle}>Date de l&apos;incident</span><input style={inp} type='date' value={form.date} onChange={e => set('date', e.target.value)} /></div>
              <div><span style={labelStyle}>Perte approximative (USD)</span><input style={inp} value={form.loss} onChange={e => set('loss', e.target.value)} placeholder='ex. 2500' /></div>
              <div>
                <span style={labelStyle}>Plateforme d&apos;échange utilisée</span>
                <select style={{ ...inp, cursor: 'pointer' }} value={form.exchange} onChange={e => set('exchange', e.target.value)}>
                  <option value=''>Sélectionner une plateforme</option>
                  {['Binance','Coinbase','Kraken','OKX','Bybit','KuCoin','Gate.io','Huobi','Autre'].map(x => <option key={x}>{x}</option>)}
                </select>
              </div>
              <div>
                <span style={labelStyle}>Description — ce qui s&apos;est passé, étape par étape</span>
                <textarea style={{ ...inp, minHeight: 100, resize: 'vertical' as const, lineHeight: 1.6 }}
                  value={form.description} onChange={e => set('description', e.target.value)}
                  placeholder='J&apos;ai vu une promotion de @[handle] sur X. J&apos;ai acheté [montant] de [token]. Le token est ensuite tombé à zéro...' />
              </div>
            </div>
            <button onClick={() => setStep(2)} style={{ marginTop: 24, background: '#F85B05', border: 'none', borderRadius: 8, color: '#000', fontWeight: 900, fontSize: 12, padding: '12px 28px', cursor: 'pointer', letterSpacing: '0.1em' }}>
              SUIVANT →
            </button>
          </div>
        )}

        {/* ÉTAPE 2 */}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#f9fafb', letterSpacing: '0.1em', marginBottom: 24 }}>ÉTAPE 2 — DÉTAILS ON-CHAIN</div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 18 }}>
              <div><span style={labelStyle}>Votre adresse de wallet</span><input style={inp} value={form.wallet} onChange={e => set('wallet', e.target.value)} placeholder='0x... ou adresse Solana' /></div>
              <div><span style={labelStyle}>Hash de transaction (optionnel)</span><input style={inp} value={form.txHash} onChange={e => set('txHash', e.target.value)} placeholder='0x...' /></div>
              <div><span style={labelStyle}>Pseudonyme de l&apos;acteur connu</span><input style={inp} value={form.actor} onChange={e => set('actor', e.target.value)} placeholder='@handle' /></div>
              <div>
                <span style={labelStyle}>Handle du profil KOL INTERLIGENS (si connu)</span>
                <input style={inp} value={form.kolHandle} onChange={e => set('kolHandle', e.target.value)} placeholder='ex. bkokoski' />
                <div style={{ fontSize: 10, color: '#374151', marginTop: 6 }}>À retrouver sur app.interligens.com/fr/kol/[handle]</div>
              </div>
              <div>
                <span style={labelStyle}>Votre email (optionnel — pour le suivi)</span>
                <input style={inp} type='email' value={form.email} onChange={e => set('email', e.target.value)} placeholder='vous@exemple.com' />
                <div style={{ fontSize: 10, color: '#374151', marginTop: 6 }}>Utilisé uniquement dans les modèles que vous générez. Jamais stocké, jamais transmis.</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setStep(1)} style={{ background: 'transparent', border: '1px solid #374151', borderRadius: 8, color: '#6b7280', fontWeight: 700, fontSize: 12, padding: '12px 20px', cursor: 'pointer' }}>← RETOUR</button>
              <button onClick={() => setStep(3)} style={{ background: '#F85B05', border: 'none', borderRadius: 8, color: '#000', fontWeight: 900, fontSize: 12, padding: '12px 28px', cursor: 'pointer', letterSpacing: '0.1em' }}>GÉNÉRER LES SIGNALEMENTS →</button>
            </div>
          </div>
        )}

        {/* ÉTAPE 3 */}
        {step === 3 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#f9fafb', letterSpacing: '0.1em', marginBottom: 8 }}>ÉTAPE 3 — VOS MODÈLES DE SIGNALEMENT</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 24, lineHeight: 1.6 }}>Sélectionnez un modèle, copiez-le et soumettez-le à la plateforme concernée.</div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' as const }}>
              {[
                { key: 'binance', label: 'Conformité Binance', url: 'https://www.binance.com/fr/support/requests/new', color: '#f59e0b' },
                { key: 'ic3', label: 'FBI IC3', url: 'https://www.ic3.gov', color: '#3b82f6' },
                { key: 'finma', label: 'FINMA (Suisse)', url: 'https://www.finma.ch', color: '#F85B05' },
              ].map(t => (
                <div key={t.key} onClick={() => setTemplate(t.key as any)}
                  style={{ flex: '1 1 30%', minWidth: 160, background: template === t.key ? t.color + '22' : '#0a0a0a', border: '1px solid ' + (template === t.key ? t.color : '#1f2937'), borderRadius: 8, padding: '14px 16px', cursor: 'pointer' }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: template === t.key ? t.color : '#6b7280', marginBottom: 4 }}>{t.label}</div>
                  <div style={{ fontSize: 10, color: '#374151' }}>{t.url}</div>
                </div>
              ))}
            </div>

            {template && (
              <div style={{ marginBottom: 16 }}>
                <pre style={{ background: '#0a0a0a', border: '1px solid #1f2937', borderRadius: 8, padding: '18px 20px', fontSize: 11, color: '#94a3b8', lineHeight: 1.7, whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const, maxHeight: 400, overflowY: 'auto' as const, fontFamily: 'monospace' }}>
                  {activeTemplate}
                </pre>
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button onClick={copy} style={{ flex: 1, background: copied ? '#10b981' : '#F85B05', border: 'none', borderRadius: 8, color: copied ? '#fff' : '#000', fontWeight: 900, fontSize: 12, padding: '12px', cursor: 'pointer', letterSpacing: '0.1em' }}>
                    {copied ? '✓ COPIÉ DANS LE PRESSE-PAPIERS' : 'COPIER LE SIGNALEMENT →'}
                  </button>
                  <a href={template === 'binance' ? 'https://www.binance.com/fr/support/requests/new' : template === 'ic3' ? 'https://www.ic3.gov/complaint/default.aspx' : 'https://www.finma.ch/fr/finma-public/etablissements-non-autorises/'}
                    target='_blank' rel='noreferrer'
                    style={{ background: '#0a0a0a', border: '1px solid #374151', borderRadius: 8, color: '#9ca3af', fontWeight: 700, fontSize: 12, padding: '12px 16px', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                    OUVRIR LE FORMULAIRE →
                  </a>
                </div>
              </div>
            )}

            <div style={{ background: '#0a0a0a', border: '1px solid #1f2937', borderRadius: 10, padding: '18px 20px', marginTop: 24 }}>
              <div style={{ fontSize: 9, fontWeight: 900, color: '#374151', letterSpacing: '0.2em', marginBottom: 12 }}>ET ENSUITE</div>
              {[
                { n: '1.', text: 'Soumettez d’abord le signalement Binance — les plateformes peuvent geler les fonds plus vite que les autorités.' },
                { n: '2.', text: 'Déposez une plainte IC3 — cela crée un dossier fédéral officiel aux États-Unis, requis pour une action civile.' },
                { n: '3.', text: 'Si une entité établie en Suisse est impliquée, signalez à la FINMA — elle peut agir contre les opérateurs non autorisés.' },
                { n: '4.', text: 'Conservez les numéros de confirmation. Transférez-les à admin@interligens.com si vous souhaitez rejoindre une action collective.' },
              ].map(s => (
                <div key={s.n} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 10, fontWeight: 900, color: '#F85B05', fontFamily: 'monospace', flexShrink: 0 }}>{s.n}</span>
                  <span style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>{s.text}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setStep(2)} style={{ background: 'transparent', border: '1px solid #374151', borderRadius: 8, color: '#6b7280', fontWeight: 700, fontSize: 12, padding: '12px 20px', cursor: 'pointer' }}>← RETOUR</button>
              <a href='mailto:admin@interligens.com?subject=Signalement victime — Intérêt action collective'
                style={{ background: '#0a0a0a', border: '1px solid #374151', borderRadius: 8, color: '#9ca3af', fontWeight: 700, fontSize: 12, padding: '12px 20px', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                REJOINDRE L&apos;ACTION COLLECTIVE →
              </a>
            </div>
          </div>
        )}

        {/* Avertissement */}
        <div style={{ marginTop: 36, paddingTop: 20, borderTop: '1px solid #1f2937', fontSize: 11, color: '#4b5563', lineHeight: 1.7 }}>
          Ceci ne constitue pas un conseil juridique. Les modèles ci-dessus sont de simples aides à la rédaction — consultez un professionnel qualifié avant tout dépôt.{' '}
          <Link href='/en/legal/disclaimer' style={{ color: '#F85B05', textDecoration: 'none' }}>Lire l&apos;avertissement complet →</Link>
          <div style={{ marginTop: 8, fontSize: 10, color: '#1f2937' }}>
            INTERLIGENS Intelligence © 2026 · INTERLIGENS Delaware C-Corp · Aucune donnée n&apos;est stockée — tout reste dans votre navigateur.
          </div>
        </div>
      </div>
    </div>
  )
}
