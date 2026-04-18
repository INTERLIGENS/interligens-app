import Link from "next/link";

const SECTION_TITLE: React.CSSProperties = {
  textTransform: "uppercase",
  fontSize: 11,
  letterSpacing: "0.08em",
  color: "#FF6B00",
  marginBottom: 12,
  marginTop: 40,
};

const BODY: React.CSSProperties = {
  fontSize: 14,
  color: "rgba(255,255,255,0.7)",
  lineHeight: 1.8,
};

const ITEM: React.CSSProperties = {
  display: "flex",
  gap: 12,
  marginBottom: 10,
  alignItems: "flex-start",
};

const DOT: React.CSSProperties = {
  color: "#FF6B00",
  marginTop: 2,
  flexShrink: 0,
};

export default function TrustPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#000000",
        color: "#FFFFFF",
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "60px 24px",
        }}
      >
        <Link
          href="/investigators/box"
          style={{
            fontSize: 12,
            color: "rgba(255,255,255,0.5)",
            textDecoration: "none",
          }}
        >
          ← Back to cases
        </Link>
        <div
          style={{
            textTransform: "uppercase",
            fontSize: 11,
            letterSpacing: "0.12em",
            color: "#FF6B00",
            marginTop: 20,
            marginBottom: 8,
          }}
        >
          INVESTIGATORS · TRUST
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: "#FFFFFF",
          }}
        >
          How INTERLIGENS protects your work
        </h1>
        <div
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.4)",
            marginTop: 8,
            marginBottom: 32,
            lineHeight: 1.7,
          }}
        >
          Your investigator box is built on a simple principle: the things
          that identify your work belong only to you. We designed the system
          so we cannot read your raw evidence even if we wanted to.
        </div>

        <div style={SECTION_TITLE}>What we cannot read</div>
        <div style={BODY}>
          <div style={ITEM}>
            <span style={DOT}>→</span>
            <span>
              <strong style={{ color: "#FFFFFF" }}>Your files.</strong> They
              are encrypted in your browser before upload. We store opaque
              ciphertext only.
            </span>
          </div>
          <div style={ITEM}>
            <span style={DOT}>→</span>
            <span>
              <strong style={{ color: "#FFFFFF" }}>Your notes.</strong>{" "}
              Everything you type in the Notes tab is encrypted before storage.
              The server sees ciphertext.
            </span>
          </div>
          <div style={ITEM}>
            <span style={DOT}>→</span>
            <span>
              <strong style={{ color: "#FFFFFF" }}>
                Your case titles and tags.
              </strong>{" "}
              Encrypted with the same key. The only people who can read them
              are you and whoever you explicitly share with.
            </span>
          </div>
          <div style={ITEM}>
            <span style={DOT}>→</span>
            <span>
              <strong style={{ color: "#FFFFFF" }}>Your passphrase.</strong>{" "}
              It never leaves your device. We have no copy, no reset, no
              backdoor.
            </span>
          </div>
        </div>

        <div style={SECTION_TITLE}>What our system uses</div>
        <div style={BODY}>
          <div style={ITEM}>
            <span style={DOT}>→</span>
            <span>
              Derived entities you extract: wallets, handles, transaction
              hashes, URLs, domains.
            </span>
          </div>
          <div style={ITEM}>
            <span style={DOT}>→</span>
            <span>Hypothesis titles and status.</span>
          </div>
          <div style={ITEM}>
            <span style={DOT}>→</span>
            <span>Timeline event titles and dates.</span>
          </div>
          <div style={ITEM}>
            <span style={DOT}>→</span>
            <span>
              These power our intelligence engine and the Assistant. None of
              this is raw evidence — it is the structured derivation you chose
              to produce.
            </span>
          </div>
        </div>

        <div style={SECTION_TITLE}>What happens if you share</div>
        <div style={BODY}>
          <div style={ITEM}>
            <span style={DOT}>→</span>
            <span>
              Only derived entities are included in a share link. Notes and
              files are never included.
            </span>
          </div>
          <div style={ITEM}>
            <span style={DOT}>→</span>
            <span>
              A share link expires automatically and can be revoked at any
              time.
            </span>
          </div>
          <div style={ITEM}>
            <span style={DOT}>→</span>
            <span>
              The snapshot is frozen at the moment you created the link. We
              never re-fetch live data to serve a share.
            </span>
          </div>
        </div>

        <div style={SECTION_TITLE}>What happens if you publish</div>
        <div style={BODY}>
          <div style={ITEM}>
            <span style={DOT}>→</span>
            <span>You select exactly which entities to submit.</span>
          </div>
          <div style={ITEM}>
            <span style={DOT}>→</span>
            <span>
              We review every submission before anything goes into the
              public Intel Vault.
            </span>
          </div>
          <div style={ITEM}>
            <span style={DOT}>→</span>
            <span>
              Attribution uses your investigator handle. You decide if you
              want to go on record.
            </span>
          </div>
          <div style={ITEM}>
            <span style={DOT}>→</span>
            <span>Raw content is never published.</span>
          </div>
        </div>

        <div style={SECTION_TITLE}>Confidentiality protection</div>
        <div style={BODY}>
          <div style={ITEM}>
            <span style={DOT}>→</span>
            <span>
              <strong style={{ color: "#FFFFFF" }}>Workspace watermark.</strong>{" "}
              Every page in your workspace carries a confidential watermark
              with your investigator handle and the current date. It appears on
              screenshots and on printed documents, so the source of any
              unauthorized disclosure can be traced back.
            </span>
          </div>
          <div style={ITEM}>
            <span style={DOT}>→</span>
            <span>
              <strong style={{ color: "#FFFFFF" }}>Session fingerprint.</strong>{" "}
              Sensitive actions — case access, AI queries, file URL generation,
              share link creation — record an audit line containing your
              hashed IP and a truncated browser signature. You can inspect
              your own trail at{" "}
              <a
                href="/investigators/box/audit"
                style={{ color: "#FF6B00", textDecoration: "none" }}
              >
                /investigators/box/audit
              </a>
              . This data can be used in legal proceedings if needed.
            </span>
          </div>
          <div style={ITEM}>
            <span style={DOT}>→</span>
            <span>
              <strong style={{ color: "#FFFFFF" }}>Rate limits.</strong> Export
              and sharing actions are rate-limited per workspace to prevent
              bulk data extraction. If you hit a limit during normal use, give
              it a few minutes — the window resets hourly.
            </span>
          </div>
        </div>

        <div style={SECTION_TITLE}>What we cannot recover</div>
        <div style={BODY}>
          <div style={ITEM}>
            <span style={DOT}>→</span>
            <span>Your passphrase.</span>
          </div>
          <div style={ITEM}>
            <span style={DOT}>→</span>
            <span>Your encrypted data without your passphrase.</span>
          </div>
          <div style={ITEM}>
            <span style={DOT}>→</span>
            <span>
              This is the proof. If we could recover it, the guarantee would
              be a marketing line, not a design.
            </span>
          </div>
        </div>

        <div
          style={{
            marginTop: 60,
            paddingTop: 16,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            fontSize: 11,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          Questions about how any of this works? Use the feedback button in
          your workspace — it reaches the team directly.
        </div>
      </div>
    </main>
  );
}
