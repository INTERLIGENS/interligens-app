"use client";

import { useEffect, useRef, useState } from "react";
import { TIGRE_VIDEOS, type TigreTier } from "@/lib/tigre/videoManifest";

interface TigreVideoPlayerProps {
  tier: TigreTier;
}

export default function TigreVideoPlayer({ tier }: TigreVideoPlayerProps) {
  const [src, setSrc] = useState<string>("");
  const [hidden, setHidden] = useState(false);
  const [opacity, setOpacity] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const triedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    triedRef.current = new Set();
    const pool = TIGRE_VIDEOS[tier];
    const initial = pool[Math.floor(Math.random() * pool.length)];
    triedRef.current.add(initial);
    setSrc(initial);
    setOpacity(1);
    setHidden(false);
  }, [tier]);

  const handleError = () => {
    const pool = TIGRE_VIDEOS[tier];
    const untried = pool.filter((v) => !triedRef.current.has(v));
    if (untried.length > 0) {
      const next = untried[Math.floor(Math.random() * untried.length)];
      triedRef.current.add(next);
      setSrc(next);
    } else {
      setHidden(true);
    }
  };

  if (!src || hidden) return null;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        marginTop: 20,
        marginBottom: 4,
      }}
    >
      <video
        ref={videoRef}
        key={src}
        src={src}
        autoPlay
        muted
        playsInline
        style={{
          maxWidth: 400,
          width: "100%",
          borderRadius: 12,
          display: "block",
          background: "#000",
          opacity,
          transition: "opacity 2s ease-out",
        }}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (!v || !v.duration) return;
          const remaining = v.duration - v.currentTime;
          if (remaining <= 2) {
            setOpacity(remaining / 2);
          }
        }}
        onEnded={() => setOpacity(0)}
        onError={handleError}
      />
    </div>
  );
}
