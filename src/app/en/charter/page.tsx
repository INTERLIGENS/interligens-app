import BetaNav from "@/components/beta/BetaNav";

export const metadata = {
  title: "Retail Charter — INTERLIGENS",
  description: "How to read a scan. How to spot a scam. Plain language, built for people who don't trade for a living.",
};

export default function CharterEN() {
  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans antialiased">
      <BetaNav />

      <main className="max-w-3xl mx-auto px-6 py-12 sm:py-16">

        {/* ═══ HERO ═══ */}
        <header className="mb-16">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#F85B05] mb-3 font-mono">
            RETAIL CHARTER
          </div>
          <h1 className="text-4xl sm:text-5xl font-black italic tracking-tighter uppercase leading-[0.95]">
            How to read a scan.<br />
            How to spot a scam<span className="text-[#F85B05]">.</span>
          </h1>
          <p className="mt-5 text-base text-zinc-400 max-w-xl leading-relaxed">
            Plain language. No jargon. Built for people who don&apos;t trade for a living.
            This is the only page you need to read before clicking <em>buy</em>.
          </p>
        </header>

        {/* ═══ 1. HOW TO READ A SCORE ═══ */}
        <Section eyebrow="01 — TigerScore" title="How to read a score">
          <p className="text-sm text-zinc-400 leading-relaxed mb-8">
            Every scan returns a TigerScore from <strong className="text-zinc-200">0 to 100</strong>.
            Higher means riskier. The score is a starting point — always read the evidence before deciding.
          </p>

          <div className="space-y-3">
            <TierBlock
              range="0 — 39"
              tier="SAFE"
              color="#10b981"
              line="No critical alerts found."
              detail="Looks clean — but not guaranteed safe. Verify the link, start small, watchlist it. Things change fast."
            />
            <TierBlock
              range="40 — 69"
              tier="CAUTION"
              color="#f59e0b"
              line="Suspicious signals found."
              detail="Don't rush. Check the evidence first. If you test, use a tiny amount only."
            />
            <TierBlock
              range="70 — 100"
              tier="AVOID"
              color="#ef4444"
              line="High-risk patterns detected."
              detail="Do not buy. Do not connect your wallet. If you already interacted, stop and review the case file."
            />
          </div>

          <Callout>
            A score is a starting point, not a verdict. Always read the evidence below it before deciding.
          </Callout>
        </Section>

        {/* ═══ 2. RED FLAGS THAT MATTER ═══ */}
        <Section eyebrow="02 — Signals" title="Red flags that matter">
          <p className="text-sm text-zinc-400 leading-relaxed mb-8">
            Most scans surface the same handful of warning signs. These are the ones that actually
            decide whether you can get your money out.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FlagCard
              title="Locked exits"
              body="You can buy, but you can't sell. The contract or liquidity blocks you."
            />
            <FlagCard
              title="Insider concentration"
              body="A handful of wallets hold most of the supply. They can crash the price by selling."
            />
            <FlagCard
              title="Unverified contract"
              body="The smart contract isn't open or auditable. Hidden mechanics are possible."
            />
            <FlagCard
              title="Repeat actor"
              body="The same wallets or developers behind known past scams."
            />
            <FlagCard
              title="Coordinated promotion"
              body="Many influencers posting the same thing at the same time. Paid hype."
            />
            <FlagCard
              title="Detective referenced"
              body="INTERLIGENS investigators have it on file. Read the case."
            />
            <FlagCard
              title="No real liquidity"
              body="Almost no money in the trading pool. You can't exit even if you want to."
            />
            <FlagCard
              title="Mint or freeze authority"
              body="The creator can still mint new tokens or freeze yours at will."
            />
          </div>
        </Section>

        {/* ═══ 3. HOW SCAMS USUALLY WORK ═══ */}
        <Section eyebrow="03 — Patterns" title="How scams usually work">
          <p className="text-sm text-zinc-400 leading-relaxed mb-8">
            Most crypto scams follow a small number of recipes. Once you see the pattern, you stop falling for it.
          </p>

          <div className="space-y-6">
            <Pattern
              n="01"
              title="Pump and dump"
              body="Insiders accumulate quietly. Then a wave of coordinated calls pushes the price up. Retail FOMOs in. Insiders sell. Price collapses. The whole cycle can take hours."
            />
            <Pattern
              n="02"
              title="Rugpull"
              body="A token launches with hype. Retail buys. The team or insiders pull the liquidity — the money in the trading pool — and disappear. The token is now worth zero."
            />
            <Pattern
              n="03"
              title="Fake trust, fake safety"
              body="Fake audits. Fake doxxed teams. Fake 'verified' badges. Often copy-pasted from legitimate projects to look real. If it looks too official too fast, double-check."
            />
            <Pattern
              n="04"
              title="Coordinated promotion"
              body="Influencers paid to call the same coin in the same window. It looks organic. It isn't. INTERLIGENS tracks these waves on the Watchlist."
            />
            <Pattern
              n="05"
              title="No-exit / trapped buyers"
              body="You can buy, but the contract or liquidity prevents selling. Or the slippage is so bad you'd lose almost everything trying to exit."
            />
            <Pattern
              n="06"
              title="Repeat actors / linked projects"
              body="The same people relaunch under new names. Same wallets, same patterns. Each cycle traps a new wave of buyers. The Explorer documents these case clusters."
            />
          </div>
        </Section>

        {/* ═══ 4. HOW THEY TALK ═══ */}
        <Section eyebrow="04 — Callers" title="How they talk. What it really means.">
          <p className="text-sm text-zinc-400 leading-relaxed mb-8">
            Coordinated influencers don&apos;t say <em>buy</em>. They make you feel
            you&apos;re missing something. The vocabulary changes every two years —
            the goal stays the same: get you to act before you think.
          </p>

          <div className="mb-8">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 mb-3 font-mono">
              A. The old language (2020 — 2023)
            </div>
            <ul className="space-y-2.5">
              <Phrase quote="NFA but this is going to 10x" mean="Covers them legally. Pushes you anyway." />
              <Phrase quote="Aping in" mean="Group FOMO. Switches off the part of your brain that thinks." />
              <Phrase quote="This is the play" mean="Manufactures certainty where there is none." />
              <Phrase quote="Ser this is early" mean="Urgency plus fake complicity. You&apos;re late, hurry up." />
              <Phrase quote="Gonna be huge, trust" mean="No proof. Pure manipulation." />
            </ul>
          </div>

          <div className="mb-8">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 mb-3 font-mono">
              B. The 2026 language (more implicit, more coded)
            </div>
            <ul className="space-y-2.5">
              <Phrase quote="🐯🚀" mean="Emoji only, no text. Their followers already know what to do — they don&apos;t need to convince you." />
              <Phrase quote="Community vibes are immaculate rn" mean="Atmosphere over substance." />
              <Phrase quote="I&apos;m not saying buy but..." mean="Plausible deniability plus hype." />
              <Phrase quote="[chart screenshot]" mean="No context. Manufactured visual proof." />
              <Phrase quote="Paying attention to [TOKEN] 👀" mean="Implies without saying." />
              <Phrase quote="[mass coordinated replies]" mean="Fake organic. Same window, same words." />
              <Phrase quote="The narrative is shifting" mean="Urgency without proof." />
              <Phrase quote="GM $TOKEN" mean="Pump dressed up as a greeting." />
              <Phrase quote='Thread: "alpha leak"' mean="Plays on exclusivity and secrecy." />
              <Phrase quote="I got in early, not financial advice" mean="Hype plus legal cover." />
            </ul>
          </div>

          <div className="mb-2">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-500 mb-3 font-mono">
              C. What it triggers in you
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FlagCard title="FOMO" body="Fear of missing out. The single most expensive feeling in retail crypto." />
              <FlagCard title="Belonging" body='Feeling you&apos;re "in the circle." You&apos;re not. You&apos;re the exit.' />
              <FlagCard title="Urgency" body="Act now, think later. The whole point of the script." />
              <FlagCard title="Critical override" body='"Everyone is doing it, so it must be safe." This is how scams scale.' />
            </div>
          </div>

          <Callout>
            They&apos;re not saying <em>buy</em> anymore. They&apos;re making you feel
            you&apos;re missing something. One emoji, no text — their followers
            already know. You&apos;re not in the circle. You&apos;re the exit.
          </Callout>
        </Section>

        {/* ═══ 5. BEFORE YOU BUY ═══ */}
        <Section eyebrow="05 — Discipline" title="What to do before you buy">
          <p className="text-sm text-zinc-400 leading-relaxed mb-8">
            A short discipline that prevents most retail losses. Five steps. Memorize them.
          </p>

          <ol className="space-y-4">
            <Step n="1" title="Scan the address yourself.">
              Don&apos;t trust a screenshot. Don&apos;t trust a friend. Run the address through INTERLIGENS yourself.
            </Step>
            <Step n="2" title="Read the score AND the evidence.">
              A number alone is not enough. Look at <em>why</em> it&apos;s scored that way.
            </Step>
            <Step n="3" title="Check the link.">
              Always confirm the URL. Most wallet drains start from a fake link that looks legitimate.
            </Step>
            <Step n="4" title="Start small.">
              Even on a clean scan, test with a tiny amount first. Treat the first transaction as a probe, not a position.
            </Step>
            <Step n="5" title="Set a stop in your head.">
              Decide what you can afford to lose <em>before</em> you click. Stick to it.
            </Step>
          </ol>
        </Section>

        {/* ═══ 6. IF YOU ALREADY BOUGHT ═══ */}
        <Section eyebrow="06 — Damage control" title="If you already bought">
          <p className="text-sm text-zinc-400 leading-relaxed mb-8">
            A lot of people arrive here too late. That&apos;s OK. Calm steps work better than panic.
            This isn&apos;t financial advice — it&apos;s damage control.
          </p>

          <ol className="space-y-4">
            <Step n="1" title="Stop. Breathe. Don't double down.">
              Don&apos;t average down on a token that&apos;s already broken. That&apos;s how small losses become total losses.
            </Step>
            <Step n="2" title="Re-scan it.">
              Check whether the score has shifted since you bought. Read the evidence with fresh eyes.
            </Step>
            <Step n="3" title="Don't sign anything new.">
              Don&apos;t approve, don&apos;t connect, don&apos;t migrate. That&apos;s how the second drain happens.
            </Step>
            <Step n="4" title="Save the case file.">
              Keep the report. You may need proof later — for an exchange, an investigator, or a class action.
            </Step>
            <Step n="5" title="Move to a clean wallet if needed.">
              If you already gave approvals to a sketchy contract, revoke them and migrate your remaining funds to a fresh wallet.
            </Step>
          </ol>

          <div className="mt-6 px-4 py-4 border-l-2 border-red-500/70 bg-red-500/[0.06]">
            <p className="text-sm font-black uppercase tracking-[0.08em] text-red-400 leading-snug">
              You&apos;re exit liquidity if you buy here.
            </p>
          </div>
        </Section>

        {/* ═══ 7. RETAIL LEXICON ═══ */}
        <Section eyebrow="07 — Lexicon" title="Words you'll see, in plain English">
          <p className="text-sm text-zinc-400 leading-relaxed mb-8">
            The crypto vocabulary is dense. Here&apos;s what the words actually mean.
          </p>

          <dl className="divide-y divide-zinc-800/60">
            <Term word="Wallet">Your crypto account. The address is public. The keys are private.</Term>
            <Term word="Token">A coin or asset on a blockchain. Each one has its own contract and its own rules.</Term>
            <Term word="Smart contract">The code that runs a token. It decides what&apos;s possible — and what&apos;s blocked.</Term>
            <Term word="Liquidity">The money sitting in the trading pool. Without it, you literally cannot sell.</Term>
            <Term word="Approval">When you let a contract spend your tokens. <em>Unlimited</em> approvals are blank checks. Avoid them.</Term>
            <Term word="Holders">The wallets that own a token. If too few hold too much, that&apos;s concentration risk.</Term>
            <Term word="Mint authority">The right to create new tokens out of thin air. Can dilute everyone.</Term>
            <Term word="Freeze authority">The right to lock your tokens so you can&apos;t move them.</Term>
            <Term word="Rugpull">When the team removes the liquidity and walks away. Token goes to zero.</Term>
            <Term word="Drain">When a malicious contract empties your wallet using an approval or signature you gave it.</Term>
            <Term word="KOL">Key Opinion Leader. A crypto influencer.</Term>
            <Term word="Case file">A documented investigation tied to a wallet, token, or actor.</Term>
            <Term word="TigerScore">The INTERLIGENS risk score. 0 to 100. Higher means riskier.</Term>
          </dl>
        </Section>

        {/* ═══ CTAs ═══ */}
        <section className="mt-20 pt-10 border-t border-zinc-800/60">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-600 mb-5 font-mono">
            Put it into practice
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <CTA href="/en/demo" label="Scan an address" />
            <CTA href="/en/methodology" label="Read the methodology" />
            <CTA href="/en/watchlist" label="See who we're watching" />
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer className="mt-16 pt-6 border-t border-zinc-900 text-center">
          <p className="text-[9px] font-mono tracking-wider text-zinc-700 uppercase">
            Educational. Not financial advice. INTERLIGENS Intelligence © 2026
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

function Phrase({ quote, mean }: { quote: string; mean: string }) {
  return (
    <li className="rounded-lg border border-zinc-800/80 bg-zinc-900/30 px-4 py-3">
      <div className="text-[13px] font-bold text-zinc-100 italic mb-1">&ldquo;{quote}&rdquo;</div>
      <div className="text-xs text-zinc-500 leading-relaxed">
        <span className="text-[#F85B05] font-black mr-1.5">→</span>{mean}
      </div>
    </li>
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
