// Shared minimal markdown renderer for casefile views (Platform + Token).
// Supports: # ## ### headings, **bold**, - bullets, fenced ``` code blocks,
// --- / ___ horizontal rules, paragraphs. Tables and other syntax fall
// through as plain paragraph text. No dependencies.
//
// Visual conventions: white headings, orange-700 bold, JetBrains Mono code
// (#111 bg, 4px radius, 12px padding), bullets with disc, hr in #333.
import React from "react";

export default function renderMarkdown(md: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const lines = md.split(/\r?\n/);
  let para: string[] = [];
  let bullets: string[] = [];
  let code: string[] | null = null;
  let key = 0;

  const inline = (s: string): React.ReactNode => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={i} style={{ color: "#FF6B00", fontWeight: 700 }}>{p.slice(2, -2)}</strong>
        : <span key={i}>{p}</span>,
    );
  };
  const flushPara = () => {
    if (para.length) {
      out.push(<p key={key++} style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.75, margin: "0 0 12px" }}>{inline(para.join(" "))}</p>);
      para = [];
    }
  };
  const flushBullets = () => {
    if (bullets.length) {
      out.push(
        <ul key={key++} style={{ margin: "0 0 14px", paddingLeft: 22, listStyleType: "disc" }}>
          {bullets.map((b, i) => <li key={i} style={{ fontSize: 13, color: "#9ca3af", lineHeight: 1.7, marginBottom: 5 }}>{inline(b)}</li>)}
        </ul>,
      );
      bullets = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.trim().startsWith("```")) {
      if (code === null) { flushPara(); flushBullets(); code = []; }
      else {
        out.push(<pre key={key++} style={{ background: "#111111", borderRadius: 4, padding: 12, fontSize: 12, lineHeight: 1.6, color: "#d1d5db", fontFamily: "var(--font-jetbrains-mono), monospace", overflowX: "auto", margin: "0 0 14px" }}>{code.join("\n")}</pre>);
        code = null;
      }
      continue;
    }
    if (code !== null) { code.push(raw); continue; }

    if (/^#{1,3}\s/.test(line)) {
      flushPara(); flushBullets();
      const level = line.match(/^#+/)![0].length;
      const text = line.replace(/^#+\s/, "");
      const size = level === 1 ? 26 : level === 2 ? 20 : 15;
      out.push(<div key={key++} style={{ fontSize: size, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.015em", margin: level === 1 ? "8px 0 14px" : "24px 0 10px" }}>{text}</div>);
    } else if (/^[-*]\s/.test(line)) {
      flushPara();
      bullets.push(line.replace(/^[-*]\s/, ""));
    } else if (/^(-{3,}|_{3,})$/.test(line.trim())) {
      flushPara(); flushBullets();
      out.push(<hr key={key++} style={{ border: "none", borderTop: "1px solid #333333", margin: "22px 0" }} />);
    } else if (line.trim() === "") {
      flushPara(); flushBullets();
    } else {
      flushBullets();
      para.push(line);
    }
  }
  flushPara(); flushBullets();
  if (code) out.push(<pre key={key++} style={{ background: "#111111", borderRadius: 4, padding: 12, fontSize: 12, lineHeight: 1.6, color: "#d1d5db", fontFamily: "var(--font-jetbrains-mono), monospace", overflowX: "auto" }}>{code.join("\n")}</pre>);
  return out;
}
