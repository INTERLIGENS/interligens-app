export default async function Home({
  params,
}: {
  params: Promise<{ locale: "en" | "fr" }>;
}) {
  const { locale } = await params;
  const isFR = locale === "fr";

  return (
    <main className="min-h-screen p-10">
      <div className="max-w-3xl space-y-6">
        <h1 className="text-4xl font-semibold">INTERLIGENS</h1>

        <p className="text-lg opacity-80">
          {isFR
            ? "Démo read-only : Token • Wallet • KOL — connecté à Solana."
            : "Read-only demo: Token • Wallet • KOL — connected to Solana."}
        </p>

        <a
          className="inline-flex rounded-lg border px-4 py-2 hover:bg-black/5"
          href={`/${locale}/demo`}
        >
          {isFR ? "Ouvrir la démo" : "Open demo"}
        </a>
      </div>
    </main>
  );
}
