"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import VaultGate from "@/components/vault/VaultGate";
import { useVaultSession } from "@/hooks/useVaultSession";
import { encryptString } from "@/lib/vault/crypto.client";
import { describeResponse } from "@/lib/investigators/errorMessages";

/**
 * Entry point for "Create your own graph" on the CONSTELLATION landing.
 *
 * We encrypt an empty payload with the investigator's metaKey, POST a new
 * VaultNetworkGraph row, and forward to /investigators/box/graphs/[id] so
 * the user lands directly on the editor with a blank canvas. Failure modes
 * (vault locked, network, migration missing) stay on this page with a
 * recoverable message.
 */

function autoTitle(): string {
  const now = new Date();
  const d = now.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
  const t = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `Untitled graph · ${d} ${t}`;
}

function NewGraphInner() {
  const router = useRouter();
  const { keys, isLoading } = useVaultSession();
  const [error, setError] = useState<string | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    if (isLoading || !keys || firedRef.current) return;
    firedRef.current = true;

    (async () => {
      try {
        const emptyPayload = JSON.stringify({ nodes: [], edges: [] });
        const ct = await encryptString(emptyPayload, keys.metaKey);
        const res = await fetch("/api/investigators/graphs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: autoTitle(),
            description: null,
            payloadEnc: ct.enc,
            payloadIv: ct.iv,
            nodeCount: 0,
            edgeCount: 0,
          }),
        });
        if (!res.ok) {
          setError(describeResponse(res));
          firedRef.current = false;
          return;
        }
        const data = await res.json();
        router.replace(`/investigators/box/graphs/${data.graph.id}`);
      } catch {
        setError("Encryption failed — please retry.");
        firedRef.current = false;
      }
    })();
  }, [isLoading, keys, router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#000",
        color: "#FFF",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ maxWidth: 420, padding: "0 24px", textAlign: "center" }}>
        <div
          style={{
            textTransform: "uppercase",
            fontSize: 11,
            letterSpacing: "0.14em",
            color: "#FF6B00",
          }}
        >
          CONSTELLATION
        </div>
        <div
          style={{
            fontSize: 15,
            color: "rgba(255,255,255,0.7)",
            marginTop: 12,
            lineHeight: 1.5,
          }}
        >
          {error ? "We couldn't start your graph." : "Preparing a fresh graph…"}
        </div>
        {error && (
          <>
            <div
              style={{
                marginTop: 14,
                color: "#FF9AAB",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
            <button
              type="button"
              onClick={() => {
                firedRef.current = false;
                setError(null);
              }}
              style={{
                marginTop: 18,
                backgroundColor: "#FF6B00",
                color: "#FFFFFF",
                border: "none",
                height: 36,
                padding: "0 18px",
                borderRadius: 6,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </>
        )}
      </div>
    </main>
  );
}

export default function NewGraphPage() {
  return (
    <VaultGate>
      <NewGraphInner />
    </VaultGate>
  );
}
