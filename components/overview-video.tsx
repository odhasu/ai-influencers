"use client";

import Hls from "hls.js";
import { useEffect, useRef } from "react";

export function OverviewVideo({ streamUrl }: { streamUrl: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
      return;
    }

    if (!Hls.isSupported()) return;

    const hls = new Hls();
    hls.loadSource(streamUrl);
    hls.attachMedia(video);
    return () => hls.destroy();
  }, [streamUrl]);

  return (
    <video
      ref={videoRef}
      className="overview-video"
      controls
      playsInline
      preload="metadata"
      poster="https://stream.clyro.io/i/8V01yqULxPLLwB0100E2lRPpd00CFZVm00V4X02l02QjMnvxrc/thumbnail.jpg"
    >
      Your browser does not support this video.
    </video>
  );
}
