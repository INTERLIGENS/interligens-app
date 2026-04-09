export const metadata = { title: "Privacy Policy — INTERLIGENS" };

export default function PrivacyPolicyPage() {
  const updated = "April 2026";
  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-10">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F85B05] mb-2 font-mono">LEGAL</div>
          <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-zinc-500 text-sm">Last updated: {updated}</p>
        </div>

        <Section title="1. Who We Are">
          <p>
            INTERLIGENS is a blockchain intelligence platform. This Privacy Policy explains how we
            collect, use, and protect information when you access or use our platform.
          </p>
          <p>
            For privacy-related inquiries, contact:{" "}
            <a href="mailto:admin@interligens.com" className="text-[#F85B05] hover:text-white transition-colors">
              admin@interligens.com
            </a>
          </p>
        </Section>

        <Section title="2. Information We Collect">
          <h3 className="text-sm font-semibold text-zinc-300 mt-2">Account and Access Data</h3>
          <p>
            When you access the beta platform, we collect the information provided during the
            onboarding process, including your email address and the terms of your NDA acceptance.
            Session identifiers are stored via secure cookies to maintain your authenticated state.
          </p>

          <h3 className="text-sm font-semibold text-zinc-300 mt-4">Usage Data</h3>
          <p>
            We collect standard usage data including pages visited, scan queries performed,
            timestamps, browser type, and device information. This data is used for platform
            operation, security monitoring, and service improvement.
          </p>

          <h3 className="text-sm font-semibold text-zinc-300 mt-4">Scan Queries</h3>
          <p>
            When you perform a scan, the blockchain address or token identifier you submit is
            processed to generate analytical outputs. Scan queries may be logged for security,
            abuse prevention, and platform improvement purposes.
          </p>

          <h3 className="text-sm font-semibold text-zinc-300 mt-4">Correction Requests</h3>
          <p>
            If you submit a correction request, the information you provide (including contact
            details and supporting evidence) is collected and stored for the purpose of processing
            your request.
          </p>
        </Section>

        <Section title="3. How We Use Your Information">
          <p>We use collected information to:</p>
          <ul className="list-disc list-inside space-y-1 text-zinc-400">
            <li>Provide, operate, and maintain the platform.</li>
            <li>Authenticate access and enforce beta access controls.</li>
            <li>Process scan queries and generate analytical outputs.</li>
            <li>Monitor for security threats, abuse, and unauthorized access.</li>
            <li>Process correction requests and legal inquiries.</li>
            <li>Improve platform accuracy, reliability, and user experience.</li>
            <li>Comply with legal obligations.</li>
          </ul>
          <p>
            We do not sell, rent, or trade your personal information to third parties for marketing
            purposes.
          </p>
        </Section>

        <Section title="4. Cookies and Session Management">
          <p>
            The platform uses essential cookies to manage authentication sessions. These cookies
            are strictly necessary for the platform to function and cannot be opted out of while
            using the service.
          </p>
          <p>
            We do not use third-party advertising cookies or tracking pixels for marketing
            purposes.
          </p>
        </Section>

        <Section title="5. Data Retention">
          <p>
            We retain account and access data for the duration of your beta access and for a
            reasonable period thereafter for security and legal compliance purposes. Usage logs
            are retained for up to 12 months. Correction request records are retained
            indefinitely as part of our editorial integrity process.
          </p>
          <p>
            You may request deletion of your personal data by contacting{" "}
            <a href="mailto:admin@interligens.com" className="text-[#F85B05] hover:text-white transition-colors">
              admin@interligens.com
            </a>
            . Deletion requests will be processed within 30 days, subject to any legal retention
            obligations.
          </p>
        </Section>

        <Section title="6. Third-Party Processors">
          <p>
            We use the following third-party services to operate the platform:
          </p>
          <ul className="list-disc list-inside space-y-1 text-zinc-400">
            <li><strong className="text-zinc-300">Cloud hosting providers</strong> — Infrastructure and deployment services (United States).</li>
            <li><strong className="text-zinc-300">Database providers</strong> — Managed database services (United States / EU).</li>
            <li><strong className="text-zinc-300">AI service providers</strong> — Analytical processing services (United States). Scan data may be processed through AI APIs to generate explanatory outputs. No personal data is shared beyond the analytical query context.</li>
          </ul>
          <p>
            Each processor is subject to their own privacy policies and data processing agreements.
          </p>
        </Section>

        <Section title="7. Data Security">
          <p>
            We implement reasonable technical and organizational measures to protect your
            information against unauthorized access, alteration, disclosure, or destruction. These
            include encrypted connections (TLS), access controls, session management, and regular
            security reviews.
          </p>
          <p>
            No system is perfectly secure. While we take security seriously, we cannot guarantee
            absolute protection of your data.
          </p>
        </Section>

        <Section title="8. Your Rights">
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc list-inside space-y-1 text-zinc-400">
            <li>Access the personal data we hold about you.</li>
            <li>Request correction of inaccurate data.</li>
            <li>Request deletion of your personal data.</li>
            <li>Object to or restrict certain types of processing.</li>
            <li>Request data portability where technically feasible.</li>
          </ul>
          <p>
            To exercise any of these rights, contact{" "}
            <a href="mailto:admin@interligens.com" className="text-[#F85B05] hover:text-white transition-colors">
              admin@interligens.com
            </a>
            . We will respond within 30 days.
          </p>
        </Section>

        <Section title="9. International Transfers">
          <p>
            Your data may be processed in the United States and other jurisdictions where our
            service providers operate. By using the platform, you consent to the transfer and
            processing of your data in these jurisdictions.
          </p>
        </Section>

        <Section title="10. Children">
          <p>
            The platform is not intended for use by individuals under the age of 18. We do not
            knowingly collect personal information from minors.
          </p>
        </Section>

        <Section title="11. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. Changes take effect upon
            publication on this page. We encourage you to review this policy periodically.
          </p>
        </Section>

        <Section title="12. Contact">
          <p>
            For privacy-related inquiries:{" "}
            <a href="mailto:admin@interligens.com" className="text-[#F85B05] hover:text-white transition-colors">
              admin@interligens.com
            </a>
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
      <a href="/en/legal/disclaimer" className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">Disclaimer</a>
      <a href="/en/correction" className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">Correction Process</a>
    </div>
  );
}
