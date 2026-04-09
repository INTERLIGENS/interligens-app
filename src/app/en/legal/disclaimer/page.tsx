export const metadata = { title: "Disclaimer — INTERLIGENS" };

export default function DisclaimerPage() {
  const updated = "April 2026";
  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-10">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F85B05] mb-2 font-mono">LEGAL</div>
          <h1 className="text-3xl font-bold text-white mb-2">Disclaimer</h1>
          <p className="text-zinc-500 text-sm">Last updated: {updated}</p>
        </div>

        <Section title="Analytical Outputs — Not Advice">
          <p>
            INTERLIGENS is a blockchain intelligence platform. All data, risk scores, reports,
            case files, and analytical outputs provided by this platform are for informational
            and analytical purposes only. They do not constitute financial advice, legal advice,
            investment recommendations, or allegations of wrongdoing.
          </p>
          <p>
            Platform outputs reflect patterns and signals observed in publicly available data at
            the time of analysis. They are not guarantees, predictions, definitive conclusions,
            or accusations against any individual or entity.
          </p>
        </Section>

        <Section title="No Financial Advice">
          <p>
            Nothing on this platform should be interpreted as a recommendation to buy, sell, or
            hold any cryptocurrency, token, or digital asset. Users are solely responsible for
            their own financial decisions. Always conduct your own research and consult a
            qualified professional before making any financial decision.
          </p>
        </Section>

        <Section title="Accuracy and Completeness">
          <p>
            While INTERLIGENS strives to provide accurate and current information, the platform
            makes no warranties or representations regarding the completeness, accuracy,
            reliability, or timeliness of any data or output. Blockchain data is inherently
            complex, decentralized, and may be subject to errors, omissions, delays, or
            manipulation by third parties.
          </p>
          <p>
            Risk scores and analytical outputs may change as new data becomes available. A low
            risk score does not guarantee safety. A high risk score does not constitute proof
            of fraud or malicious intent.
          </p>
        </Section>

        <Section title="Third-Party Data Sources">
          <p>
            INTERLIGENS processes data from various third-party sources including public
            blockchains, social media platforms, and other publicly accessible systems.
            INTERLIGENS does not control, endorse, or guarantee the accuracy or availability
            of these sources.
          </p>
        </Section>

        <Section title="Limitation of Liability">
          <p>
            To the maximum extent permitted by law, INTERLIGENS, its operators, affiliates, and
            contributors shall not be liable for any direct, indirect, incidental, special,
            consequential, or punitive damages arising from or related to your use of the
            platform, reliance on its outputs, or inability to access the service.
          </p>
          <p>
            The platform is provided &quot;as is&quot; and &quot;as available&quot; without
            warranties of any kind.
          </p>
        </Section>

        <Section title="Correction Process">
          <p>
            If you believe any information on this platform is factually inaccurate or
            misattributed, you may submit a correction request through our{" "}
            <a href="/en/correction" className="text-[#F85B05] hover:text-white transition-colors">
              Correction Process
            </a>
            . All requests are reviewed on their merits and supporting evidence.
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
      <a href="/en/demo" className="text-[#F85B05] hover:text-white text-sm transition-colors">&larr; Back to Home</a>
      <a href="/en/legal/terms" className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">Terms of Use</a>
      <a href="/en/legal/privacy" className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">Privacy Policy</a>
      <a href="/en/correction" className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">Correction Process</a>
    </div>
  );
}
