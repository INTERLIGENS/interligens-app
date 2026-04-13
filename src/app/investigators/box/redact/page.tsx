"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import VaultGate from "@/components/vault/VaultGate";

type Tool = "black" | "blur";

type Rect = {
  id: string;
  tool: Tool;
  x: number;
  y: number;
  w: number;
  h: number;
};

const LABEL_STYLE: React.CSSProperties = {
  textTransform: "uppercase",
  fontSize: 11,
  letterSpacing: "0.08em",
  color: "rgba(255,255,255,0.4)",
  display: "block",
  marginBottom: 8,
};

const PRIMARY_BTN: React.CSSProperties = {
  backgroundColor: "#FF6B00",
  color: "#FFFFFF",
  height: 44,
  borderRadius: 6,
  fontSize: 14,
  padding: "0 20px",
  border: "none",
  cursor: "pointer",
};

const SECONDARY_BTN: React.CSSProperties = {
  backgroundColor: "transparent",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "rgba(255,255,255,0.7)",
  height: 44,
  borderRadius: 6,
  fontSize: 14,
  padding: "0 20px",
  cursor: "pointer",
};

const OPSEC_ITEMS = [
  "Browser tabs hidden",
  "Local time / timezone not visible",
  "URL bar cleared or redacted",
  "OS notifications not visible",
  "Screen corners / dock not visible",
  "Extension icons not visible",
];

function RedactInner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [rects, setRects] = useState<Rect[]>([]);
  const [tool, setTool] = useState<Tool>("black");
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(
    null
  );
  const [opsec, setOpsec] = useState<Record<string, boolean>>({});

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setRects([]);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  function drawCanvas() {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);

    for (const r of rects) {
      if (r.tool === "black") {
        ctx.fillStyle = "#000000";
        ctx.fillRect(r.x, r.y, r.w, r.h);
      } else {
        const region = ctx.getImageData(r.x, r.y, r.w, r.h);
        const temp = document.createElement("canvas");
        temp.width = r.w;
        temp.height = r.h;
        const tctx = temp.getContext("2d");
        if (tctx) {
          tctx.putImageData(region, 0, 0);
          ctx.save();
          ctx.filter = "blur(10px)";
          ctx.drawImage(temp, r.x, r.y);
          ctx.restore();
        }
      }
    }

    if (dragStart && dragCurrent) {
      const x = Math.min(dragStart.x, dragCurrent.x);
      const y = Math.min(dragStart.y, dragCurrent.y);
      const w = Math.abs(dragCurrent.x - dragStart.x);
      const h = Math.abs(dragCurrent.y - dragStart.y);
      ctx.strokeStyle = "#FF6B00";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }
  }

  useEffect(() => {
    drawCanvas();
  }, [image, rects, dragStart, dragCurrent]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Delete" || e.key === "Backspace") {
        setRects((prev) => prev.slice(0, -1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function canvasCoords(ev: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (ev.clientX - rect.left) * scaleX,
      y: (ev.clientY - rect.top) * scaleY,
    };
  }

  function onDown(ev: React.MouseEvent<HTMLCanvasElement>) {
    if (!image) return;
    setDragStart(canvasCoords(ev));
    setDragCurrent(canvasCoords(ev));
  }
  function onMove(ev: React.MouseEvent<HTMLCanvasElement>) {
    if (!dragStart) return;
    setDragCurrent(canvasCoords(ev));
  }
  function onUp() {
    if (!dragStart || !dragCurrent) return;
    const x = Math.min(dragStart.x, dragCurrent.x);
    const y = Math.min(dragStart.y, dragCurrent.y);
    const w = Math.abs(dragCurrent.x - dragStart.x);
    const h = Math.abs(dragCurrent.y - dragStart.y);
    if (w > 4 && h > 4) {
      setRects((prev) => [
        ...prev,
        { id: `${Date.now()}`, tool, x, y, w, h },
      ]);
    }
    setDragStart(null);
    setDragCurrent(null);
  }

  function download() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `redacted-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link
          href="/investigators/box"
          className="text-xs text-white/50 hover:text-white"
        >
          ← Back to cases
        </Link>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#FFFFFF",
            marginTop: 8,
            marginBottom: 24,
          }}
        >
          Redaction tool
        </h1>

        <div
          className="grid gap-6"
          style={{ gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)" }}
        >
          {/* LEFT: canvas */}
          <div>
            {!image ? (
              <label
                style={{
                  display: "block",
                  border: "1px dashed rgba(255,255,255,0.2)",
                  borderRadius: 8,
                  padding: 60,
                  textAlign: "center",
                  color: "rgba(255,255,255,0.4)",
                  cursor: "pointer",
                }}
              >
                Drag & drop a screenshot or click to browse
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </label>
            ) : (
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 8,
                  overflow: "hidden",
                  backgroundColor: "#0a0a0a",
                }}
              >
                <canvas
                  ref={canvasRef}
                  onMouseDown={onDown}
                  onMouseMove={onMove}
                  onMouseUp={onUp}
                  onMouseLeave={onUp}
                  style={{
                    width: "100%",
                    height: "auto",
                    display: "block",
                    cursor: "crosshair",
                  }}
                />
              </div>
            )}
          </div>

          {/* RIGHT: tools */}
          <div>
            <label style={LABEL_STYLE}>Tool</label>
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setTool("black")}
                style={{
                  ...(tool === "black" ? PRIMARY_BTN : SECONDARY_BTN),
                  height: 38,
                }}
              >
                Black rectangle
              </button>
              <button
                onClick={() => setTool("blur")}
                style={{
                  ...(tool === "blur" ? PRIMARY_BTN : SECONDARY_BTN),
                  height: 38,
                }}
              >
                Blur rectangle
              </button>
            </div>

            <div className="flex flex-col gap-2 mb-6">
              <button
                onClick={() => setRects((p) => p.slice(0, -1))}
                style={{ ...SECONDARY_BTN, height: 38 }}
                disabled={rects.length === 0}
              >
                Undo last
              </button>
              <button
                onClick={() => setRects([])}
                style={{ ...SECONDARY_BTN, height: 38 }}
                disabled={rects.length === 0}
              >
                Clear all
              </button>
              <button
                onClick={download}
                style={{ ...PRIMARY_BTN, height: 44 }}
                disabled={!image}
              >
                Download redacted image
              </button>
            </div>

            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.06)",
                paddingTop: 20,
                marginBottom: 20,
              }}
            >
              <label style={LABEL_STYLE}>OPSEC checklist</label>
              <div className="flex flex-col gap-2">
                {OPSEC_ITEMS.map((item) => (
                  <label
                    key={item}
                    className="flex items-center gap-2"
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.3)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!!opsec[item]}
                      onChange={(e) =>
                        setOpsec((p) => ({ ...p, [item]: e.target.checked }))
                      }
                    />
                    {item}
                  </label>
                ))}
              </div>
            </div>

            <div
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.3)",
                lineHeight: 1.6,
              }}
            >
              This tool runs entirely in your browser. Your screenshots are
              never sent to our servers.
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function RedactPage() {
  return (
    <VaultGate>
      <RedactInner />
    </VaultGate>
  );
}
