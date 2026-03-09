export default function MentionsLegalesEN() {
  return (
    <main className="min-h-screen bg-gray-950 text-white px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-orange-400 mb-2">Legal Notice</h1>
          <p className="text-gray-400 text-sm">Last updated: March 2026</p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Publisher</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            This website is published by INTERLIGENS.<br />
            Contact: <a href="mailto:contact@interligens.com" className="text-orange-400 hover:text-orange-300">contact@interligens.com</a>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Hosting</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            This website is hosted by Vercel Inc., 340 Pine Street, Suite 701, San Francisco,
            CA 94104, United States. Website: vercel.com
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Intellectual property</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            All content on this website (texts, graphics, logos, data) is the exclusive property
            of INTERLIGENS, unless otherwise stated. Any reproduction or distribution without
            prior written consent is strictly prohibited.
          </p>
        </section>

        <div className="pt-4 border-t border-gray-800">
          <a href="/en" className="text-orange-400 hover:text-orange-300 text-sm transition">← Back to home</a>
        </div>
      </div>
    </main>
  );
}
