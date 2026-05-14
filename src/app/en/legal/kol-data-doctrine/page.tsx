export const metadata = {
  title: "KOL Data Doctrine | INTERLIGENS",
  description:
    "How INTERLIGENS collects and processes public data about crypto Key Opinion Leaders for anti-fraud intelligence.",
};

export default function KolDataDoctrineEN() {
  const updated = "May 2026";
  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-10">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F85B05] mb-2 font-mono">
            LEGAL · DATA DOCTRINE
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            KOL Data Doctrine — How INTERLIGENS Handles Public Actor Data
          </h1>
          <p className="text-zinc-500 text-sm">Last updated: {updated}</p>
        </div>

        <Section title="A. Purpose and Legal Basis">
          <p>
            INTERLIGENS collects and processes publicly available data about crypto
            Key Opinion Leaders (KOLs) for the sole purpose of anti-fraud intelligence
            and retail investor protection.
          </p>
          <p>
            Legal basis: legitimate interest in combating financial fraud
            (GDPR Art. 6(1)(f)), public interest, and journalistic / research
            exemption where applicable.
          </p>
        </Section>

        <Section title="B. Data Sources">
          <p>All data originates exclusively from public sources:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Public blockchain transactions (on-chain data is public by design)</li>
            <li>Public social media posts (X / Twitter, Telegram public channels)</li>
            <li>Public smart contract deployments</li>
            <li>Published investigative reports from third parties</li>
          </ul>
          <p>
            INTERLIGENS does <strong className="text-white">not</strong> use private
            data, hacked data, leaked data, or any data obtained through unauthorized
            access.
          </p>
        </Section>

        <Section title="C. Data Minimization">
          <p>
            Only data directly relevant to assessing crypto fraud risk is collected.
          </p>
          <p>Civil identity is not published unless:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>The individual has publicly disclosed their identity, or</li>
            <li>
              A judicial authority has identified them in connection with fraud.
            </li>
          </ul>
          <p>
            Handle ≠ civil identity. Social media handles are not treated as personal
            identification unless self-disclosed.
          </p>
        </Section>

        <Section title="D. What We Publish">
          <ul className="list-disc pl-5 space-y-1">
            <li>Public wallet addresses linked to documented risk patterns</li>
            <li>Token promotion history (public posts)</li>
            <li>On-chain transaction analysis (public blockchain data)</li>
            <li>Risk scoring based on documented signals</li>
          </ul>
          <p>
            We use language like &quot;documented critical risk&quot; — never
            &quot;guilty&quot; or &quot;criminal&quot; unless sourced from an
            official judicial decision.
          </p>
        </Section>

        <Section title="E. What We Do Not Publish">
          <ul className="list-disc pl-5 space-y-1">
            <li>Home addresses, phone numbers, family members&apos; identities</li>
            <li>Private communications</li>
            <li>Unverified allegations without on-chain evidence</li>
            <li>Absolute claims of guilt or criminality</li>
          </ul>
        </Section>

        <Section title="F. Right of Rectification">
          <p>
            Any individual referenced in the INTERLIGENS KOL Registry may request a
            review of their profile.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Contact:{" "}
              <a
                href="mailto:admin@interligens.com"
                className="text-[#F85B05] hover:text-white transition-colors"
              >
                admin@interligens.com
              </a>
            </li>
            <li>Requests are reviewed within 30 business days.</li>
            <li>
              If factual errors are identified, corrections are applied promptly.
            </li>
            <li>
              Removal requests are evaluated on a case-by-case basis, balancing the
              individual&apos;s rights against the public interest in fraud
              prevention.
            </li>
          </ul>
        </Section>

        <Section title="G. Audit Trail and Evidence Integrity">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              All data points in the KOL Registry are timestamped and
              source-attributed.
            </li>
            <li>
              Evidence snapshots are archived with SHA-256 hashes for integrity
              verification.
            </li>
            <li>
              No data is fabricated, interpolated, or AI-hallucinated. Every claim
              is grounded in verifiable public evidence.
            </li>
          </ul>
        </Section>

        <Section title="H. Data Retention">
          <p>
            KOL profiles are retained as long as the associated risk signals remain
            relevant.
          </p>
          <p>
            Profiles may be archived (not deleted) when risk signals are no longer
            active, to preserve the historical record for ongoing or future
            investigations.
          </p>
        </Section>

        <Section title="I. Contact">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Data inquiries:{" "}
              <a
                href="mailto:admin@interligens.com"
                className="text-[#F85B05] hover:text-white transition-colors"
              >
                admin@interligens.com
              </a>
            </li>
            <li>
              Takedown requests:{" "}
              <a
                href="mailto:takedown@interligens.com"
                className="text-[#F85B05] hover:text-white transition-colors"
              >
                takedown@interligens.com
              </a>
            </li>
          </ul>
          <p className="text-zinc-500 italic">
            &quot;Evidence-based. Not financial advice.&quot;
          </p>
        </Section>

        <Footer />
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      <div className="text-sm text-zinc-400 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

function Footer() {
  return (
    <div className="pt-6 border-t border-zinc-800 flex flex-wrap items-center gap-6">
      <a
        href="/en/demo"
        className="text-[#F85B05] hover:text-white text-sm transition-colors"
      >
        &larr; Back to Home
      </a>
      <a
        href="/en/legal/disclaimer"
        className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
      >
        Disclaimer
      </a>
      <a
        href="/en/legal/privacy"
        className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
      >
        Privacy Policy
      </a>
      <a
        href="/en/legal/terms"
        className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
      >
        Terms of Use
      </a>
      <a
        href="/en/correction"
        className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
      >
        Correction Process
      </a>
      <a
        href="/fr/legal/kol-data-doctrine"
        className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
      >
        FR
      </a>
    </div>
  );
}
