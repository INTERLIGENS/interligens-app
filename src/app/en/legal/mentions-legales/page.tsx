export const metadata = { title: "Legal Notice — INTERLIGENS" };

export default function LegalNoticePage() {
  const updated = "April 2026";
  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-10">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F85B05] mb-2 font-mono">LEGAL</div>
          <h1 className="text-3xl font-bold text-white mb-2">Legal Notice</h1>
          <p className="text-zinc-500 text-sm">Last updated: {updated}</p>
        </div>

        <Section title="Publisher">
          <p>
            This platform is published and operated by INTERLIGENS.<br />
            Entity type: Delaware C-Corp (United States).<br />
            Contact:{" "}
            <a href="mailto:admin@interligens.com" className="text-[#F85B05] hover:text-white transition-colors">
              admin@interligens.com
            </a>
          </p>
        </Section>

        <Section title="Hosting">
          <p>
            Vercel Inc., 340 Pine Street, Suite 701, San Francisco, CA 94104, United States.
          </p>
        </Section>

        <Section title="Intellectual Property">
          <p>
            All content, data structures, analytical methods, scoring systems, investigative
            frameworks, visual designs, reports, and software comprising the INTERLIGENS platform
            are the exclusive property of INTERLIGENS or its licensors.
          </p>
          <p>
            Any reproduction, distribution, modification, or extraction of platform content
            without prior written authorization is strictly prohibited and may be subject to
            legal action.
          </p>
        </Section>

        <Section title="Personal Data">
          <p>
            For information about how we collect and process personal data, please refer to our{" "}
            <a href="/en/legal/privacy" className="text-[#F85B05] hover:text-white transition-colors">
              Privacy Policy
            </a>
            .
          </p>
        </Section>

        <Section title="Applicable Law">
          <p>
            This platform and its use are governed by the laws of the State of Delaware,
            United States. Any dispute shall be subject to the exclusive jurisdiction of the
            courts of the State of Delaware.
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
      <a href="/en/legal/disclaimer" className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">Disclaimer</a>
    </div>
  );
}
