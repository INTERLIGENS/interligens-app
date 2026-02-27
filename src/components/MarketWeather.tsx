'use client';
import React, { useEffect, useState } from 'react';

type Level = 'green' | 'orange' | 'red';

export default function MarketWeather({
  lang = 'en',
  show,
  data = {
    manipulation: { level: 'red' as Level, value: 92 },
    alerts: { level: 'orange' as Level, value: 45 },
    trust: { level: 'green' as Level, value: 10 },
  },
}: {
  lang?: 'en' | 'fr';
  show: boolean;
  data?: {
    manipulation: { level: Level; value: number };
    alerts: { level: Level; value: number };
    trust: { level: Level; value: number };
  };
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!show) return null;

  const isFR = lang === 'fr';
  const title = isFR ? 'Météo du marché' : 'Market Weather';
  const subtitle = isFR
    ? 'Signaux critiques (contexte, pas des accusations)'
    : 'Critical risk signals (context, not accusations)';
  const foot = isFR
    ? 'Indicateur démo basé sur des signaux. Pas un conseil financier.'
    : 'Demo indicator — signal-based. Not financial advice.';

  const labels = {
    manipulation: isFR ? 'Pression de manipulation' : 'Manipulation Pressure',
    alerts: isFR ? 'Alertes communauté' : 'Community Alerts',
    trust: isFR ? 'Rupture de confiance' : 'Trust Breakdown',
  };

  const status = {
    green: isFR ? 'STABLE' : 'STABLE',
    orange: isFR ? 'EN HAUSSE' : 'RISING',
    red: isFR ? 'CRITIQUE' : 'CRITICAL',
  };

  const copy = {
    manipulation: {
      green: isFR ? 'Traction organique.' : 'Mostly organic traction.',
      orange: isFR ? 'Hype anormale. Signaux de bots.' : 'Abnormal hype. Bot signals detected.',
      red: isFR ? 'Campagne de shill suspecte. Manipulation probable.' : 'Suspected shill campaign. Manipulation likely.',
    },
    alerts: {
      green: isFR ? 'Peu d’alertes pour l’instant.' : 'Few alerts so far.',
      orange: isFR ? 'Signalements en hausse. Prudence.' : 'Reports rising. Proceed with caution.',
      red: isFR ? 'Signalements explosent. Stop et vérifie.' : 'Reports are spiking. Stop and verify.',
    },
    trust: {
      green: isFR ? 'Signaux de transparence OK.' : 'Transparency signals look OK.',
      orange: isFR ? 'Communication instable. Ça sent mauvais.' : 'Comms unstable. Smells bad.',
      red: isFR ? 'Équipe fantôme. Communication coupée. Risque de rug.' : 'Ghost team / comms down. Rug risk.',
    },
  };

  const dot = (lvl: Level) => (lvl === 'red' ? '🔴' : lvl === 'orange' ? '🟠' : '🟢');

  const items = [
    { key: 'manipulation', level: data.manipulation.level, value: data.manipulation.value, label: labels.manipulation, text: (copy as any).manipulation[data.manipulation.level] },
    { key: 'alerts', level: data.alerts.level, value: data.alerts.value, label: labels.alerts, text: (copy as any).alerts[data.alerts.level] },
    { key: 'trust', level: data.trust.level, value: data.trust.value, label: labels.trust, text: (copy as any).trust[data.trust.level] },
  ] as const;

  return (
    <section className="mw">
      <div className="mwHead">
        <div>
          <div className="mwTitle">{title}</div>
          <div className="mwSub">{subtitle}</div>
        </div>
      </div>

      <div className="mwGrid">
        {items.map((it) => (
          <article key={it.key} className={`mwCard ${it.level}`}>
            <div className="mwTop">
              <div className="mwLabel">{it.label}</div>
              <div className="mwPill">{dot(it.level)} {status[it.level]}</div>
            </div>
            <div className="mwBar">
              <span style={{ width: mounted ? `${it.value}%` : '0%' }} />
            </div>
            <div className="mwCopy">{it.text}</div>
          </article>
        ))}
      </div>

      <div className="mwFoot">{foot}</div>

      <style jsx>{`
        .mw{margin-top:14px;padding:16px;border-radius:18px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.05)}
        .mwHead{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;margin-bottom:12px;flex-wrap:wrap}
        .mwTitle{font-size:14px;font-weight:850;letter-spacing:.2px}
        .mwSub{font-size:12px;opacity:.75;margin-top:2px}
        .mwGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
        @media (max-width:860px){.mwGrid{grid-template-columns:1fr}.mwHead{align-items:flex-start}}
        .mwCard{padding:12px;border-radius:16px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.18);display:flex;flex-direction:column}
        .mwTop{display:flex;flex-direction:column;gap:4px;margin-bottom:8px}
        .mwLabel{font-size:12px;font-weight:750;min-height:40px;line-height:1.3;display:flex;align-items:flex-start}
        .mwPill{font-size:11px;padding:4px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);white-space:nowrap;align-self:flex-start}
        .mwBar{height:6px;border-radius:999px;background:rgba(255,255,255,.10);overflow:hidden}
        .mwBar span{display:block;height:100%;transition:width 900ms ease}
        .mwCard.green .mwBar span{background:rgba(0,255,120,.55)}
        .mwCard.orange .mwBar span{background:rgba(255,170,0,.75)}
        .mwCard.red .mwBar span{background:rgba(255,70,70,.75)}
        .mwCopy{margin-top:10px;font-size:12.5px;opacity:.88;line-height:1.3}
        .mwFoot{margin-top:10px;font-size:11.5px;opacity:.62;line-height:1.35}
      `}</style>
    </section>
  );
}
