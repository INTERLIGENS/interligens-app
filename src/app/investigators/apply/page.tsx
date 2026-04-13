export default function ApplyPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight mb-4">
          Apply to INTERLIGENS Investigators
        </h1>
        <p className="text-white/60 mb-8">
          We currently onboard investigators by invitation. Send a short
          introduction, your investigation focus, and any public work we can
          reference.
        </p>
        <a
          href="mailto:investigators@interligens.com?subject=Investigator%20application"
          className="inline-block bg-[#FF6B00] text-white px-5 py-2 rounded font-medium"
        >
          Email investigators@interligens.com
        </a>
        <p className="text-white/40 text-xs mt-10">
          By applying, you agree to our Mutual NDA during the onboarding
          flow. Your workspace uses client-side encryption — INTERLIGENS
          cannot read the contents of your cases.
        </p>
      </div>
    </main>
  );
}
