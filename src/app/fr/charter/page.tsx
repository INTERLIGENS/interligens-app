import BetaNav from "@/components/beta/BetaNav";

export const metadata = {
  title: "Charte Retail — INTERLIGENS",
  description: "Comment lire un scan. Comment repérer un scam. Langage simple, pour ceux qui ne tradent pas pour vivre.",
};

export default function CharterFR() {
  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans antialiased">
      <BetaNav />

      <main className="max-w-3xl mx-auto px-6 py-12 sm:py-16">

        {/* ═══ HERO ═══ */}
        <header className="mb-16">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#F85B05] mb-3 font-mono">
            CHARTE RETAIL
          </div>
          <h1 className="text-4xl sm:text-5xl font-black italic tracking-tighter uppercase leading-[0.95]">
            Comment lire un scan.<br />
            Comment repérer un scam<span className="text-[#F85B05]">.</span>
          </h1>
          <p className="mt-5 text-base text-zinc-400 max-w-xl leading-relaxed">
            Langage simple. Aucun jargon. Pensé pour celles et ceux qui ne tradent pas pour vivre.
            C&apos;est la seule page à lire avant de cliquer sur <em>acheter</em>.
          </p>
        </header>

        {/* ═══ 1. COMMENT LIRE UN SCORE ═══ */}
        <Section eyebrow="01 — TigerScore" title="Comment lire un score">
          <p className="text-sm text-zinc-400 leading-relaxed mb-8">
            Chaque scan renvoie un TigerScore de <strong className="text-zinc-200">0 à 100</strong>.
            Plus le score est haut, plus le risque est élevé. Le score est un point de départ —
            lis toujours les preuves avant de décider.
          </p>

          <div className="space-y-3">
            <TierBlock
              range="0 — 39"
              tier="OK"
              color="#10b981"
              line="Aucune alerte critique détectée."
              detail="Ça paraît propre — mais ce n'est pas une garantie. Vérifie le lien, commence petit, surveille. Tout peut changer vite."
            />
            <TierBlock
              range="40 — 69"
              tier="ATTENTION"
              color="#f59e0b"
              line="Signaux suspects détectés."
              detail="Ne te précipite pas. Vérifie les preuves d'abord. Si tu testes, utilise un micro-montant."
            />
            <TierBlock
              range="70 — 100"
              tier="ÉVITER"
              color="#ef4444"
              line="Schémas à haut risque détectés."
              detail="N'achète pas. Ne connecte pas ton wallet. Si tu as déjà interagi, arrête-toi et consulte le dossier."
            />
          </div>

          <Callout>
            Un score est un point de départ, pas un verdict. Lis toujours les preuves en dessous avant de décider.
          </Callout>
        </Section>

        {/* ═══ 2. RED FLAGS QUI COMPTENT ═══ */}
        <Section eyebrow="02 — Signaux" title="Les red flags qui comptent">
          <p className="text-sm text-zinc-400 leading-relaxed mb-8">
            La plupart des scans font ressortir les mêmes signaux. Voici ceux qui décident
            réellement si tu peux récupérer ton argent.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FlagCard
              title="Sortie bloquée"
              body="Tu peux acheter, mais tu ne peux pas vendre. Le contrat ou la liquidité te bloquent."
            />
            <FlagCard
              title="Concentration insiders"
              body="Quelques wallets détiennent l'essentiel du supply. Ils peuvent crasher le prix en vendant."
            />
            <FlagCard
              title="Contrat non vérifié"
              body="Le smart contract n'est pas ouvert ou auditable. Mécaniques cachées possibles."
            />
            <FlagCard
              title="Acteur récidiviste"
              body="Les mêmes wallets ou développeurs derrière des scams connus."
            />
            <FlagCard
              title="Promotion coordonnée"
              body="Plusieurs influenceurs publient la même chose en même temps. Hype payée."
            />
            <FlagCard
              title="Référencé par un détective"
              body="Les enquêteurs INTERLIGENS l'ont au dossier. Lis le case file."
            />
            <FlagCard
              title="Pas de vraie liquidité"
              body="Presque aucun argent dans le pool de trading. Tu ne pourras pas sortir."
            />
            <FlagCard
              title="Mint ou freeze authority"
              body="Le créateur peut encore créer de nouveaux tokens ou geler les tiens à volonté."
            />
          </div>
        </Section>

        {/* ═══ 3. COMMENT FONCTIONNENT LES SCAMS ═══ */}
        <Section eyebrow="03 — Schémas" title="Comment fonctionnent les scams">
          <p className="text-sm text-zinc-400 leading-relaxed mb-8">
            La plupart des scams crypto suivent un petit nombre de recettes. Une fois que tu vois le schéma,
            tu arrêtes de tomber dedans.
          </p>

          <div className="space-y-6">
            <Pattern
              n="01"
              title="Pump and dump"
              body="Les insiders accumulent en silence. Puis une vague de calls coordonnés fait monter le prix. Le retail FOMO. Les insiders vendent. Le prix s'effondre. Tout le cycle peut se jouer en quelques heures."
            />
            <Pattern
              n="02"
              title="Rugpull"
              body="Un token se lance avec du hype. Le retail achète. L'équipe ou les insiders retirent la liquidité — l'argent dans le pool — et disparaissent. Le token vaut zéro."
            />
            <Pattern
              n="03"
              title="Faux trust, fausse sécurité"
              body="Faux audits. Fausses équipes doxxées. Faux badges 'verified'. Souvent copiés depuis des projets légitimes pour avoir l'air vrai. Si ça paraît trop officiel trop vite, vérifie deux fois."
            />
            <Pattern
              n="04"
              title="Promotion coordonnée"
              body="Influenceurs payés pour caller le même coin dans la même fenêtre. Ça paraît organique. Ça ne l'est pas. INTERLIGENS suit ces vagues sur la Watchlist."
            />
            <Pattern
              n="05"
              title="Sortie bloquée / acheteurs piégés"
              body="Tu peux acheter, mais le contrat ou la liquidité empêche de vendre. Ou le slippage est tellement mauvais que tu perdrais presque tout en sortant."
            />
            <Pattern
              n="06"
              title="Acteurs récidivistes / projets liés"
              body="Les mêmes personnes relancent sous d'autres noms. Mêmes wallets, mêmes patterns. Chaque cycle piège une nouvelle vague d'acheteurs. L'Explorer documente ces clusters."
            />
          </div>
        </Section>

        {/* ═══ 4. AVANT D'ACHETER ═══ */}
        <Section eyebrow="04 — Discipline" title="Quoi faire avant d'acheter">
          <p className="text-sm text-zinc-400 leading-relaxed mb-8">
            Une discipline courte qui évite la majorité des pertes retail. Cinq étapes. Mémorise-les.
          </p>

          <ol className="space-y-4">
            <Step n="1" title="Scan l'adresse toi-même.">
              Ne te fie pas à un screenshot. Ne te fie pas à un ami. Passe l&apos;adresse dans INTERLIGENS toi-même.
            </Step>
            <Step n="2" title="Lis le score ET les preuves.">
              Un chiffre seul ne suffit pas. Regarde <em>pourquoi</em> le score est ce qu&apos;il est.
            </Step>
            <Step n="3" title="Vérifie le lien.">
              Confirme toujours l&apos;URL. La majorité des wallet drains commencent par un faux lien qui ressemble à un vrai.
            </Step>
            <Step n="4" title="Commence petit.">
              Même sur un scan propre, teste avec un micro-montant. Traite la première transaction comme une sonde, pas une position.
            </Step>
            <Step n="5" title="Fixe-toi une limite mentale.">
              Décide ce que tu peux te permettre de perdre <em>avant</em> de cliquer. Tiens-toi à ça.
            </Step>
          </ol>
        </Section>

        {/* ═══ 5. SI TU AS DÉJÀ ACHETÉ ═══ */}
        <Section eyebrow="05 — Damage control" title="Si tu as déjà acheté">
          <p className="text-sm text-zinc-400 leading-relaxed mb-8">
            Beaucoup arrivent ici trop tard. C&apos;est OK. Des étapes calmes valent mieux que la panique.
            Ce ne sont pas des conseils financiers — c&apos;est du damage control.
          </p>

          <ol className="space-y-4">
            <Step n="1" title="Stop. Respire. Ne double pas la mise.">
              Ne fais pas de moyenne à la baisse sur un token déjà cassé. C&apos;est comme ça que les petites pertes deviennent totales.
            </Step>
            <Step n="2" title="Re-scan.">
              Vérifie si le score a changé depuis ton achat. Relis les preuves avec un œil neuf.
            </Step>
            <Step n="3" title="Ne signe rien de nouveau.">
              Pas d&apos;approval, pas de connexion, pas de migration. C&apos;est comme ça qu&apos;arrive le second drain.
            </Step>
            <Step n="4" title="Sauvegarde le dossier.">
              Garde le rapport. Tu pourrais en avoir besoin plus tard — pour un exchange, un enquêteur, ou une class action.
            </Step>
            <Step n="5" title="Migre vers un wallet propre si nécessaire.">
              Si tu as déjà donné des approvals à un contrat suspect, révoque-les et déplace tes fonds restants vers un nouveau wallet.
            </Step>
          </ol>
        </Section>

        {/* ═══ 6. LEXIQUE RETAIL ═══ */}
        <Section eyebrow="06 — Lexique" title="Les mots que tu vois, en clair">
          <p className="text-sm text-zinc-400 leading-relaxed mb-8">
            Le vocabulaire crypto est dense. Voici ce que les mots veulent vraiment dire.
          </p>

          <dl className="divide-y divide-zinc-800/60">
            <Term word="Wallet">Ton compte crypto. L&apos;adresse est publique. Les clés sont privées.</Term>
            <Term word="Token">Une monnaie ou un actif sur une blockchain. Chacun a son contrat et ses règles.</Term>
            <Term word="Smart contract">Le code qui fait tourner un token. Il décide ce qui est possible — et ce qui est bloqué.</Term>
            <Term word="Liquidité">L&apos;argent dans le pool de trading. Sans elle, tu ne peux littéralement pas vendre.</Term>
            <Term word="Approval">Quand tu autorises un contrat à dépenser tes tokens. Les approvals <em>illimités</em> sont des chèques en blanc. Évite-les.</Term>
            <Term word="Holders">Les wallets qui possèdent un token. Si trop peu en détiennent trop, c&apos;est un risque de concentration.</Term>
            <Term word="Mint authority">Le droit de créer de nouveaux tokens à partir de rien. Ça dilue tout le monde.</Term>
            <Term word="Freeze authority">Le droit de geler tes tokens pour t&apos;empêcher de les bouger.</Term>
            <Term word="Rugpull">Quand l&apos;équipe retire la liquidité et disparaît. Le token tombe à zéro.</Term>
            <Term word="Drain">Quand un contrat malveillant vide ton wallet via un approval ou une signature que tu as donnée.</Term>
            <Term word="KOL">Key Opinion Leader. Un influenceur crypto.</Term>
            <Term word="Case file">Une enquête documentée liée à un wallet, un token, ou un acteur.</Term>
            <Term word="TigerScore">Le score de risque INTERLIGENS. De 0 à 100. Plus c&apos;est haut, plus c&apos;est risqué.</Term>
          </dl>
        </Section>

        {/* ═══ CTAs ═══ */}
        <section className="mt-20 pt-10 border-t border-zinc-800/60">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-600 mb-5 font-mono">
            Mets-le en pratique
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <CTA href="/fr/demo" label="Scanner une adresse" />
            <CTA href="/fr/methodology" label="Lire la méthodologie" />
            <CTA href="/fr/watchlist" label="Voir qui on surveille" />
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer className="mt-16 pt-6 border-t border-zinc-900 text-center">
          <p className="text-[9px] font-mono tracking-wider text-zinc-700 uppercase">
            Éducatif. Pas un conseil financier. INTERLIGENS Intelligence © 2026
          </p>
        </footer>

      </main>
    </div>
  );
}

// ─── Building blocks ──────────────────────────────────────────────────────

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-16 sm:mt-20">
      <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#F85B05] mb-2 font-mono">
        {eyebrow}
      </div>
      <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-6">
        {title}
      </h2>
      {children}
    </section>
  );
}

function TierBlock({ range, tier, color, line, detail }: { range: string; tier: string; color: string; line: string; detail: string }) {
  return (
    <div
      className="rounded-xl p-5 border"
      style={{ borderColor: color + '40', background: color + '08' }}
    >
      <div className="flex items-baseline gap-3 mb-2">
        <span className="text-[10px] font-mono font-black tracking-wider text-zinc-500">{range}</span>
        <span className="text-base font-black uppercase tracking-[0.15em]" style={{ color }}>{tier}</span>
      </div>
      <p className="text-sm font-bold text-zinc-200 mb-1">{line}</p>
      <p className="text-xs text-zinc-500 leading-relaxed">{detail}</p>
    </div>
  );
}

function FlagCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-4">
      <div className="flex items-start gap-2 mb-1.5">
        <span className="text-[#F85B05] font-black text-base leading-none">●</span>
        <h3 className="text-[13px] font-black uppercase tracking-tight text-zinc-100">{title}</h3>
      </div>
      <p className="text-xs text-zinc-500 leading-relaxed pl-5">{body}</p>
    </div>
  );
}

function Pattern({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 text-[10px] font-mono font-black tracking-wider text-zinc-700 pt-1">{n}</div>
      <div className="min-w-0">
        <h3 className="text-base font-black tracking-tight text-zinc-100 mb-1">{title}</h3>
        <p className="text-sm text-zinc-500 leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <div className="shrink-0 w-7 h-7 rounded-full border border-[#F85B05]/40 bg-[#F85B05]/10 flex items-center justify-center">
        <span className="text-[11px] font-black text-[#F85B05] font-mono">{n}</span>
      </div>
      <div className="min-w-0 pt-1">
        <h3 className="text-sm font-black text-zinc-100 mb-1">{title}</h3>
        <p className="text-xs text-zinc-500 leading-relaxed">{children}</p>
      </div>
    </li>
  );
}

function Term({ word, children }: { word: string; children: React.ReactNode }) {
  return (
    <div className="py-3 sm:py-4 grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-1 sm:gap-6">
      <dt className="text-[12px] font-black uppercase tracking-wider text-[#F85B05]">{word}</dt>
      <dd className="text-sm text-zinc-400 leading-relaxed">{children}</dd>
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 px-4 py-3 border-l-2 border-[#F85B05]/60 bg-[#F85B05]/5">
      <p className="text-xs italic text-zinc-300 leading-relaxed">{children}</p>
    </div>
  );
}

function CTA({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="block rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-4 text-center hover:border-[#F85B05]/40 hover:bg-[#F85B05]/5 transition-all no-underline"
    >
      <span className="text-[11px] font-black uppercase tracking-[0.15em] text-zinc-300 hover:text-[#F85B05]">
        {label} →
      </span>
    </a>
  );
}
