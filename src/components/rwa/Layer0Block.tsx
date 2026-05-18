'use client'

import { Layer0Badge } from './Layer0Badge'
import { RwaMatchVerdict } from '@prisma/client'

// ─── TYPE ─────────────────────────────────────────────────────

export interface RwaLayer0Result {
  matchVerdict:          RwaMatchVerdict
  badgeLabel:            string
  confidence:            number
  issuer?:               { slug: string; displayName: string; jurisdictionCode?: string | null }
  asset?:                { symbol: string; name: string; assetClass: string }
  officialAddress?:      string
  supersededByAddress?:  string
  aliasType?:            string
  scannedAddress:        string
  chainKey:              string
  tigerMessage:          string
  badgeColor:            string
  badgeBg:               string
  scoreImpact:           number
  isInstantDanger:       false
  cachedUntil:           string
  registryVersion:       number
  isImplementationOnly?: boolean
  redirectToAddress?:    string
}

interface Layer0BlockProps {
  result:      RwaLayer0Result
  onContinue?: () => void
}

// ─── HELPERS ──────────────────────────────────────────────────

function truncateAddress(addr: string): string {
  if (addr.length <= 16) return addr
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`
}

function chainLabel(chainKey: string): string {
  const map: Record<string, string> = {
    'eip155:1':       'Ethereum',
    'eip155:137':     'Polygon',
    'eip155:42161':   'Arbitrum',
    'eip155:8453':    'Base',
    'eip155:56':      'BSC',
    'eip155:10':      'Optimism',
    'solana:mainnet': 'Solana',
    'solana:devnet':  'Solana Devnet',
  }
  return map[chainKey] ?? chainKey
}

function ctaLabel(verdict: RwaMatchVerdict | string): string {
  switch (verdict) {
    case 'EXACT_VERIFIED':
    case 'EXACT_ALIAS_VERIFIED':  return 'Voir l\'analyse complète →'
    case 'LEGACY_VERIFIED':       return 'Voir le contrat actuel →'
    case 'PROBABLE_FAMILY_MISMATCH': return 'Voir le détail →'
    case 'UNKNOWN':               return 'Continuer l\'analyse →'
    default:                      return 'Continuer →'
  }
}

function shouldShowContinue(verdict: string): boolean {
  return verdict !== 'PROBABLE_FAMILY_MISMATCH'
}

// ─── COMPONENT ────────────────────────────────────────────────

export function Layer0Block({ result, onContinue }: Layer0BlockProps) {
  const isWarning = result.matchVerdict === 'PROBABLE_FAMILY_MISMATCH'
  const isVerified = result.matchVerdict === 'EXACT_VERIFIED' || result.matchVerdict === 'EXACT_ALIAS_VERIFIED'

  return (
    <div style={{
      background:   '#0A0A0A',
      border:       `1px solid ${result.badgeColor}33`,
      borderLeft:   `3px solid ${result.badgeColor}`,
      borderRadius: '8px',
      padding:      '20px 24px',
      fontFamily:   '"JetBrains Mono", "Fira Code", monospace',
      color:        '#FFFFFF',
      maxWidth:     '640px',
      width:        '100%',
    }}>

      {/* Header — Badge + Émetteur */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Layer0Badge
            verdict={result.isImplementationOnly ? 'IMPLEMENTATION' as RwaMatchVerdict : result.matchVerdict}
            label={result.badgeLabel}
            size="md"
          />
          {result.issuer && (
            <span style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
              {result.issuer.displayName}
            </span>
          )}
        </div>

        {/* Score impact pill */}
        <div style={{
          padding:      '4px 10px',
          borderRadius: '20px',
          fontSize:     '12px',
          fontWeight:   700,
          background:   result.scoreImpact > 0 ? '#0D2D1A' : result.scoreImpact < 0 ? '#2D0D0D' : '#1A1A1A',
          color:        result.scoreImpact > 0 ? '#00C851' : result.scoreImpact < 0 ? '#FF3B30' : '#888888',
          border:       `1px solid ${result.scoreImpact > 0 ? '#00C85133' : result.scoreImpact < 0 ? '#FF3B3033' : '#33333333'}`,
          whiteSpace:   'nowrap',
          flexShrink:   0,
        }}>
          {result.scoreImpact > 0 ? `+${result.scoreImpact}` : result.scoreImpact} pts
        </div>
      </div>

      {/* Infos grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px', marginBottom: '16px' }}>
        {result.asset && (
          <Row label="Actif" value={`${result.asset.name} (${result.asset.symbol})`} />
        )}
        <Row label="Chaîne" value={chainLabel(result.chainKey)} />
        <Row
          label="Adresse scannée"
          value={truncateAddress(result.scannedAddress)}
          mono
          copyValue={result.scannedAddress}
        />
        {result.officialAddress && result.officialAddress !== result.scannedAddress && (
          <Row
            label="Adresse officielle"
            value={truncateAddress(result.officialAddress)}
            mono
            color={isVerified ? '#00C851' : undefined}
            copyValue={result.officialAddress}
          />
        )}
        {result.supersededByAddress && (
          <Row
            label="Contrat actuel"
            value={truncateAddress(result.supersededByAddress)}
            mono
            color="#FF6B00"
            copyValue={result.supersededByAddress}
          />
        )}
        {result.aliasType && (
          <Row label="Type" value={result.aliasType.replace(/_/g, ' ')} />
        )}
        {result.issuer?.jurisdictionCode && (
          <Row label="Juridiction" value={result.issuer.jurisdictionCode.toUpperCase()} />
        )}
      </div>

      {/* Séparateur */}
      <div style={{ height: '1px', background: '#222222', marginBottom: '14px' }} />

      {/* Tiger message */}
      <p style={{
        fontSize:     '13px',
        lineHeight:   '1.6',
        color:        isWarning ? '#FF3B30' : '#CCCCCC',
        fontStyle:    'italic',
        margin:       '0 0 16px 0',
        paddingLeft:  '12px',
        borderLeft:   `2px solid ${result.badgeColor}66`,
      }}>
        &ldquo;{result.tigerMessage}&rdquo;
      </p>

      {/* Implementation redirect */}
      {result.isImplementationOnly && result.redirectToAddress && (
        <div style={{
          padding:      '10px 14px',
          background:   '#1A1A1A',
          border:       '1px solid #333333',
          borderRadius: '6px',
          fontSize:     '12px',
          color:        '#888888',
          marginBottom: '14px',
        }}>
          Proxy officiel : <span style={{ color: '#FF6B00', fontWeight: 700 }}>{truncateAddress(result.redirectToAddress)}</span>
        </div>
      )}

      {/* CTA */}
      {onContinue && (
        <button
          onClick={onContinue}
          style={{
            display:       'inline-flex',
            alignItems:    'center',
            gap:           '6px',
            padding:       '8px 16px',
            fontSize:      '12px',
            fontFamily:    'inherit',
            fontWeight:    700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color:         shouldShowContinue(result.matchVerdict) ? '#000000' : result.badgeColor,
            background:    shouldShowContinue(result.matchVerdict) ? result.badgeColor : 'transparent',
            border:        `1px solid ${result.badgeColor}`,
            borderRadius:  '4px',
            cursor:        'pointer',
            transition:    'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          {ctaLabel(result.matchVerdict)}
        </button>
      )}

      {/* Footer — version registry */}
      <div style={{ marginTop: '14px', fontSize: '10px', color: '#444444', textAlign: 'right' }}>
        Registry v{result.registryVersion} · Couche 0
      </div>
    </div>
  )
}

// ─── ROW HELPER ───────────────────────────────────────────────

function Row({
  label,
  value,
  mono = false,
  color,
  copyValue,
}: {
  label:      string
  value:      string
  mono?:      boolean
  color?:     string
  copyValue?: string
}) {
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'baseline' }}>
      <span style={{ fontSize: '11px', color: '#555555', minWidth: '130px', flexShrink: 0 }}>
        {label}
      </span>
      <span
        style={{
          fontSize:   mono ? '12px' : '13px',
          fontFamily: mono ? '"JetBrains Mono", monospace' : 'inherit',
          color:      color ?? '#FFFFFF',
          cursor:     copyValue ? 'pointer' : 'default',
        }}
        title={copyValue ? `Copier : ${copyValue}` : undefined}
        onClick={copyValue ? () => navigator.clipboard.writeText(copyValue) : undefined}
      >
        {value}
        {copyValue && (
          <span style={{ marginLeft: '6px', color: '#444444', fontSize: '10px' }}>⎘</span>
        )}
      </span>
    </div>
  )
}
