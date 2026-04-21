"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { DemoConstellationNode } from "@/lib/mocks/constellation-demo-01";

interface Props {
  node: DemoConstellationNode | null;
  onClose: () => void;
}

/**
 * Absolute-positioned HTML overlay for the 3D constellation. Lives
 * outside the canvas so it inherits regular page typography + can be
 * dismissed with Escape / click-outside. Never mounted into the three.js
 * scene (which would kill text antialiasing).
 */
export default function NodePopover({ node, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!node) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onDocClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (cardRef.current && !cardRef.current.contains(target)) {
        // Click on the canvas (anywhere outside the card) closes.
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    // Defer so the opening click doesn't immediately trigger the handler.
    const t = setTimeout(() => document.addEventListener("mousedown", onDocClick), 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
      document.removeEventListener("mousedown", onDocClick);
    };
  }, [node, onClose]);

  if (!node) return null;

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={`${node.display} — synthetic demo node`}
      style={{
        position: "absolute",
        top: 24,
        right: 24,
        zIndex: 3,
        width: 320,
        padding: "18px 20px 16px",
        background: "rgba(18, 18, 18, 0.92)",
        border: "1px solid rgba(243, 240, 232, 0.08)",
        borderRadius: 10,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        color: "var(--bone)",
        pointerEvents: "auto",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--signal)",
          marginBottom: 8,
          wordBreak: "break-all",
        }}
      >
        {node.id}
      </div>
      <div
        style={{
          fontFamily: "Gambarino, 'General Sans', var(--font-inter), serif",
          fontSize: 22,
          lineHeight: 1.15,
          fontWeight: 400,
          color: "var(--bone)",
          marginBottom: 6,
        }}
      >
        {node.display}
      </div>
      <div
        style={{
          fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--bone-dim)",
          marginBottom: 14,
        }}
      >
        Role · {node.demoRole} · verdict {node.verdict}
      </div>

      <p
        style={{
          fontSize: 13,
          lineHeight: 1.55,
          color: "var(--bone-soft)",
          margin: 0,
          marginBottom: 16,
        }}
      >
        {node.description}
      </p>

      <div
        style={{
          fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
          fontSize: 9,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--bone-dimmer)",
          padding: "6px 8px",
          border: "1px dashed rgba(243, 240, 232, 0.18)",
          borderRadius: 4,
          marginBottom: 18,
          textAlign: "center",
        }}
      >
        SYNTHETIC · NOT A REAL ENTITY
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Link
          href="/scan"
          style={{
            flex: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 36,
            background: "var(--signal)",
            color: "var(--ink)",
            borderRadius: 6,
            fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Run a real scan →
        </Link>
        <Link
          href="/cases/botify"
          style={{
            flex: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 36,
            background: "transparent",
            color: "var(--bone)",
            border: "1px solid rgba(243, 240, 232, 0.18)",
            borderRadius: 6,
            fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          See a real casefile →
        </Link>
      </div>
    </div>
  );
}
