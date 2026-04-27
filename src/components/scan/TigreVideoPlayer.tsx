"use client";

import { useEffect, useRef, useState } from "react";
import { getRandomTigreVideo, type TigreTier } from "@/lib/tigre/videoManifest";

interface TigreVideoPlayerProps {
  tier: TigreTier;
}

export default function TigreVideoPlayer({ tier }: TigreVideoPlayerProps) {
  const [src, setSrc] = useState<string>("");
  const [opacity, setOpacity] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setSrc(getRandomTigreVideo(tier));
    setOpacity(1);
  }, [tier]);

  if (!src) return null;

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
        onError={() => {
          if (videoRef.current) videoRef.current.style.display = "none";
        }}
      />
    </div>
  );
}
