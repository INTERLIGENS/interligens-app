"use client";

import { useEffect, useRef, useState } from "react";
import { getRandomTigreVideo, type TigreTier } from "@/lib/tigre/videoManifest";

interface TigreVideoPlayerProps {
  tier: TigreTier;
}

export default function TigreVideoPlayer({ tier }: TigreVideoPlayerProps) {
  const [src, setSrc] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setSrc(getRandomTigreVideo(tier));
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
        }}
        onError={() => {
          // video unavailable — hide silently
          if (videoRef.current) videoRef.current.style.display = "none";
        }}
      />
    </div>
  );
}
