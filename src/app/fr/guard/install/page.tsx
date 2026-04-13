"use client";

const STEPS = [
  {
    title: "Telecharger l'extension",
    desc: "Clonez ou telechargez le dossier interligens-guard/ depuis le depot INTERLIGENS.",
    detail: "git clone https://github.com/INTERLIGENS/interligens-app.git",
  },
  {
    title: "Ouvrir les Extensions Chrome",
    desc: "Naviguez vers chrome://extensions/ dans votre navigateur Chrome.",
    detail: "Tapez chrome://extensions dans la barre d'adresse et appuyez sur Entree.",
  },
  {
    title: "Activer le mode Developpeur",
    desc: "Activez le bouton Mode developpeur en haut a droite de la page des extensions.",
    detail: null,
  },
  {
    title: 'Cliquer sur "Charger l\'extension non empaquetee"',
    desc: "Cliquez sur le bouton qui apparait apres l'activation du mode developpeur.",
    detail: null,
  },
  {
    title: "Selectionner le dossier de l'extension",
    desc: "Naviguez vers le dossier interligens-guard/ dans le depot clone et selectionnez-le.",
    detail: "Le dossier contient manifest.json, background.js, content.js et popup.html.",
  },
  {
    title: "Naviguer vers un DEX",
    desc: "Visitez pump.fun, Jupiter, Raydium, Birdeye ou DexScreener avec une page token Solana.",
    detail: "Le badge INTERLIGENS Guard apparaitra automatiquement en bas a droite.",
  },
];

export default function GuardInstallPageFR() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000000",
        color: "#FFFFFF",
        fontFamily: "monospace",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 16px",
      }}
    >
      <header style={{ textAlign: "center", paddingTop: 60, marginBottom: 40 }}>
        <div style={{ fontSize: 13, color: "#FF6B00", fontWeight: 700, letterSpacing: 2, marginBottom: 8 }}>
          INTERLIGENS GUARD
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>
          Guide d&apos;installation
        </h1>
        <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
          Installation en mode developpeur (Chrome Web Store bientot disponible)
        </p>
      </header>

      <div style={{ maxWidth: 520, width: "100%", marginBottom: 48 }}>
        {STEPS.map((step, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 14,
              marginBottom: 24,
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "2px solid #FF6B00",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 700,
                color: "#FF6B00",
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{step.title}</div>
              <div style={{ fontSize: 13, color: "#aaa", lineHeight: 1.5 }}>{step.desc}</div>
              {step.detail && (
                <div
                  style={{
                    marginTop: 8,
                    background: "#0a0a12",
                    border: "1px solid #1a1a24",
                    borderRadius: 6,
                    padding: "8px 12px",
                    fontSize: 11,
                    color: "#888",
                    wordBreak: "break-all",
                  }}
                >
                  {step.detail}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Depannage */}
      <section style={{ maxWidth: 520, width: "100%", marginBottom: 48 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Depannage</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            {
              q: "Le badge n'apparait pas ?",
              a: "Verifiez que vous etes sur une page token (pas la page d'accueil). Rafraichissez la page. Verifiez chrome://extensions pour les erreurs.",
            },
            {
              q: "L'extension affiche une erreur ?",
              a: "Cliquez sur l'icone de l'extension et verifiez le popup. Assurez-vous que l'API INTERLIGENS est accessible.",
            },
            {
              q: "Comment mettre a jour ?",
              a: "Mettez a jour le code source, puis cliquez sur l'icone de rafraichissement sur la carte de l'extension dans chrome://extensions.",
            },
          ].map((item) => (
            <div
              key={item.q}
              style={{
                background: "#0a0a12",
                border: "1px solid #1a1a24",
                borderRadius: 8,
                padding: "12px 14px",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{item.q}</div>
              <div style={{ fontSize: 12, color: "#888", lineHeight: 1.5 }}>{item.a}</div>
            </div>
          ))}
        </div>
      </section>

      <div style={{ marginBottom: 32 }}>
        <a
          href="/fr/guard"
          style={{ color: "#FF6B00", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          &larr; Retour a INTERLIGENS Guard
        </a>
      </div>

      <footer
        style={{
          marginTop: "auto",
          paddingBottom: 24,
          textAlign: "center",
          fontSize: 11,
          color: "#333",
        }}
      >
        Propulse par INTERLIGENS | app.interligens.com
      </footer>
    </div>
  );
}
