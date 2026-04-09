export const metadata = { title: "Terms of Use — INTERLIGENS" };

export default function TermsOfUsePage() {
  const updated = "April 2026";
  const email = "admin@interligens.com";
  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-10">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#F85B05] mb-2 font-mono">LEGAL</div>
          <h1 className="text-3xl font-bold text-white mb-2">Terms of Use</h1>
          <p className="text-zinc-500 text-sm">Last updated: {updated}</p>
        </div>

        <Section title="1. Nature of the Service">
          <p>
            INTERLIGENS is a blockchain intelligence platform that provides analytical outputs
            relating to on-chain activity, token risk patterns, wallet behaviors, and publicly
            observable activity. The platform produces risk scores, investigative
            reports, case files, and related analytical materials.
          </p>
          <p>
            All outputs are the result of proprietary analytical processes applied
            to publicly available data. They reflect observed patterns and signals — not
            certainties. They do not constitute allegations of wrongdoing, legal
            conclusions, financial advice, or investment recommendations of any kind.
          </p>
        </Section>

        <Section title="2. Private Beta Access">
          <p>
            Access to INTERLIGENS is currently provided on a private beta basis, under invitation
            only. Beta access is subject to a Non-Disclosure Agreement (NDA) executed at the time
            of onboarding. The platform, its features, its outputs, and its availability may change,
            be updated, or be discontinued at any time without prior notice.
          </p>
          <p>
            Beta access does not create any ongoing right of access, any expectation of continuity,
            or any obligation on the part of INTERLIGENS to maintain, update, or provide the
            service. INTERLIGENS reserves the right to revoke, suspend, or modify access at its
            sole discretion, with or without cause, and without liability.
          </p>
        </Section>

        <Section title="3. Authorized Use">
          <p>You may use the platform to:</p>
          <ul className="list-disc list-inside space-y-1 text-zinc-400">
            <li>Conduct due diligence on blockchain addresses, tokens, and related on-chain activity.</li>
            <li>Review analytical outputs, risk scores, and investigative materials for personal informational purposes.</li>
            <li>Share scan results and reports with identified recipients for personal or compliance purposes, subject to the NDA.</li>
          </ul>
        </Section>

        <Section title="4. Prohibited Use">
          <p>You may not:</p>
          <ul className="list-disc list-inside space-y-1 text-zinc-400">
            <li>Redistribute, resell, publicly republish, or commercially exploit platform data, reports, or outputs without prior written authorization.</li>
            <li>Use platform outputs to harass, defame, threaten, or target any individual or entity.</li>
            <li>Attempt to reverse-engineer, decompile, extract, scrape, or replicate any aspect of the platform, including but not limited to its analytical methods, scoring logic, detection systems, or proprietary processes.</li>
            <li>Use automated tools, bots, scripts, or any non-human access method to interact with the platform.</li>
            <li>Misrepresent platform outputs as legal findings, regulatory determinations, accusations of wrongdoing, or financial advice.</li>
            <li>Circumvent, disable, or interfere with any security, access control, or rate-limiting feature of the platform.</li>
            <li>Use the platform for any purpose that violates applicable law.</li>
          </ul>
        </Section>

        <Section title="5. Analytical Outputs — No Guarantee">
          <p>
            INTERLIGENS outputs are analytical in nature. They are based on data available at the
            time of analysis and reflect observed patterns and signals — not certainties, not
            accusations, and not conclusions of fact or law.
          </p>
          <p>
            The platform does not guarantee the accuracy, completeness, timeliness, or reliability
            of any output. Risk scores may change as new data becomes available. The absence of a
            risk signal does not certify safety. The presence of a risk signal does not constitute
            proof of wrongdoing, fraud, or malicious intent.
          </p>
          <p>
            Users are solely responsible for their own decisions and actions based on platform
            outputs. INTERLIGENS does not provide financial, legal, or investment advice under any
            circumstance.
          </p>
        </Section>

        <Section title="6. Limitation of Liability">
          <p>
            To the maximum extent permitted by applicable law, INTERLIGENS, its operators, officers,
            directors, affiliates, employees, and contributors shall not be liable for any direct,
            indirect, incidental, special, consequential, or punitive damages arising from or
            related to:
          </p>
          <ul className="list-disc list-inside space-y-1 text-zinc-400">
            <li>Your use of, or inability to use, the platform.</li>
            <li>Any action taken or not taken based on platform outputs.</li>
            <li>Errors, omissions, interruptions, delays, or inaccuracies in platform data or availability.</li>
            <li>Unauthorized access to your account or data.</li>
            <li>Any third-party conduct, content, or services accessed through the platform.</li>
          </ul>
          <p>
            The platform is provided &quot;as is&quot; and &quot;as available&quot; without
            warranties of any kind, whether express or implied, including but not limited to
            implied warranties of merchantability, fitness for a particular purpose, accuracy,
            or non-infringement. INTERLIGENS expressly disclaims all such warranties.
          </p>
        </Section>

        <Section title="7. Indemnification">
          <p>
            You agree to indemnify, defend, and hold harmless INTERLIGENS, its operators, officers,
            directors, affiliates, and employees from and against any claims, liabilities, damages,
            losses, costs, or expenses (including reasonable legal fees) arising from or related to
            your use of the platform, your violation of these Terms, or your violation of any third
            party&apos;s rights.
          </p>
        </Section>

        <Section title="8. Intellectual Property">
          <p>
            All content, data structures, analytical methods, scoring systems, detection systems,
            investigative frameworks, reports, visual designs, and software comprising the
            INTERLIGENS platform are the exclusive property of INTERLIGENS or its licensors and
            are protected by applicable intellectual property laws. The proprietary nature of
            these systems is a core asset of INTERLIGENS.
          </p>
          <p>
            No license, right, or interest in any INTERLIGENS intellectual property is granted by
            virtue of platform access, except the limited, revocable, non-exclusive,
            non-transferable right to use platform outputs for the authorized purposes described
            herein.
          </p>
        </Section>

        <Section title="9. Correction and Dispute Process">
          <p>
            INTERLIGENS maintains a formal correction process. If you believe any published
            information is factually inaccurate or misattributed, you may submit a correction
            request through our dedicated{" "}
            <a href="/en/correction" className="text-[#F85B05] hover:text-white transition-colors">
              Correction Process
            </a>{" "}
            page.
          </p>
          <p>
            Correction requests are reviewed on their merits and supported evidence. INTERLIGENS
            reserves the sole and absolute right to accept, reject, or partially implement any
            correction at its discretion. Submission of a correction request does not create any
            obligation to modify, remove, or alter any published content.
          </p>
        </Section>

        <Section title="10. Suspension and Termination">
          <p>
            INTERLIGENS may suspend or terminate your access to the platform at any time, for any
            reason, including but not limited to: violation of these Terms, breach of the NDA,
            suspected abuse, or operational necessity — without prior notice and without liability.
          </p>
          <p>
            Upon termination, all rights granted to you under these Terms cease immediately. Any
            obligations that by their nature should survive termination (including confidentiality,
            limitation of liability, indemnification, and intellectual property) shall continue in
            full effect.
          </p>
        </Section>

        <Section title="11. Service Availability">
          <p>
            INTERLIGENS does not guarantee uninterrupted, continuous, or error-free access to the
            platform. The service may be temporarily unavailable due to maintenance, updates,
            technical issues, or circumstances beyond our reasonable control. No liability arises
            from service interruptions.
          </p>
        </Section>

        <Section title="12. Language">
          <p>
            These Terms are drafted in English. In the event of any inconsistency between the
            English version and any translation, the English version shall prevail.
          </p>
        </Section>

        <Section title="13. Governing Law and Jurisdiction">
          <p>
            These Terms are governed by and construed in accordance with the laws of the State of
            Delaware, United States, without regard to its conflict of law provisions. Any dispute
            arising from or relating to these Terms or your use of the platform shall be subject to
            the exclusive jurisdiction of the courts of the State of Delaware.
          </p>
        </Section>

        <Section title="14. Changes to These Terms">
          <p>
            INTERLIGENS reserves the right to modify these Terms at any time. Changes take effect
            upon publication on this page. Continued use of the platform after changes constitutes
            acceptance of the updated Terms. It is your responsibility to review these Terms
            periodically.
          </p>
        </Section>

        <Section title="15. Contact">
          <p>
            For questions regarding these Terms:{" "}
            <a href={`mailto:${email}`} className="text-[#F85B05] hover:text-white transition-colors">
              {email}
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
      <a href="/en/legal/privacy" className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">Privacy Policy</a>
      <a href="/en/legal/disclaimer" className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">Disclaimer</a>
      <a href="/en/correction" className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors">Correction Process</a>
    </div>
  );
}
