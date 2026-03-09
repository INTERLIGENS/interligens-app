export default function DisclaimerEN() {
  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-orange-400 mb-2">Disclaimer</h1>
          <p className="text-gray-400 text-sm">Last updated: March 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Informational purposes only</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            INTERLIGENS is a blockchain intelligence tool designed to assist users in identifying
            potentially risky wallet addresses and tokens. All data, scores, and analyses provided
            by this platform are for informational purposes only and do not constitute financial,
            legal, or investment advice.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">No financial advice</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            Nothing on this platform should be interpreted as a recommendation to buy, sell, or
            hold any cryptocurrency or digital asset. Users are solely responsible for their own
            investment decisions. Always conduct your own research and consult a qualified financial
            advisor before making any financial decision.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Accuracy of information</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            While we strive to provide accurate and up-to-date information, INTERLIGENS makes no
            warranties or representations regarding the completeness, accuracy, or reliability of
            any data displayed. Blockchain data is inherently complex and may be subject to errors,
            omissions, or delays.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Limitation of liability</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            INTERLIGENS and its operators shall not be liable for any direct, indirect, incidental,
            or consequential damages arising from the use of, or inability to use, this platform or
            its data. Use of this service is entirely at your own risk.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Third-party sources</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            INTERLIGENS aggregates data from various third-party sources. We do not control or
            endorse these sources and are not responsible for their content, accuracy, or
            availability.
          </p>
        </section>

        <div className="pt-4 border-t border-gray-800">
          <a href="/en" className="text-orange-400 hover:text-orange-300 text-sm transition">← Back to home</a>
        </div>
      </div>
    </main>
  );
}
