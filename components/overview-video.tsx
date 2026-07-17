"use client";

import Hls from "hls.js";
import { useCallback, useEffect, useRef } from "react";
import { captureFunnelEvent } from "@/lib/analytics/client";

export function OverviewVideo({ streamUrl, videoId = "thank-you-vsl" }: { streamUrl: string; videoId?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingSecondsRef = useRef(new Set<number>());
  const watchedSecondsRef = useRef(new Set<number>());
  const milestonesRef = useRef(new Set<number>());
  const startedRef = useRef(false);

  const flushWatchBatch = useCallback(() => {
    const video = videoRef.current;
    const watchedSeconds = [...pendingSecondsRef.current].sort((a, b) => a - b).slice(0, 30);
    if (!video || !watchedSeconds.length) return;
    watchedSeconds.forEach((second) => pendingSecondsRef.current.delete(second));
    const duration = Number.isFinite(video.duration) ? Math.max(0, Math.round(video.duration)) : 0;
    const furthestSecond = watchedSecondsRef.current.size
      ? Math.max(...watchedSecondsRef.current)
      : Math.max(0, Math.round(video.currentTime));
    captureFunnelEvent("vsl_watch_batch", {
      video_id: videoId,
      watched_seconds: watchedSeconds,
      furthest_second: furthestSecond,
      video_duration_seconds: duration,
      percent: duration ? Math.min(100, Math.round((furthestSecond / duration) * 100)) : 0
    });
  }, [videoId]);

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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
      if (!startedRef.current) {
        startedRef.current = true;
        captureFunnelEvent("vsl_started", { video_id: videoId });
      }
      captureFunnelEvent("vsl_played", {
        video_id: videoId,
        furthest_second: Math.max(0, Math.round(video.currentTime))
      });
    };
    const onPause = () => {
      flushWatchBatch();
      if (!video.ended) {
        captureFunnelEvent("vsl_paused", {
          video_id: videoId,
          furthest_second: Math.max(0, Math.round(video.currentTime))
        });
      }
    };
    const onTimeUpdate = () => {
      if (video.paused || video.ended) return;
      const second = Math.max(0, Math.floor(video.currentTime));
      if (!watchedSecondsRef.current.has(second)) {
        watchedSecondsRef.current.add(second);
        pendingSecondsRef.current.add(second);
      }

      if (pendingSecondsRef.current.size >= 5) flushWatchBatch();
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      const percent = Math.min(100, Math.floor((video.currentTime / video.duration) * 100));
      for (const milestone of [25, 50, 75, 90, 100]) {
        if (percent >= milestone && !milestonesRef.current.has(milestone)) {
          milestonesRef.current.add(milestone);
          captureFunnelEvent("vsl_progress_reached", {
            video_id: videoId,
            percent: milestone,
            furthest_second: second,
            video_duration_seconds: Math.round(video.duration)
          });
        }
      }
    };
    const onEnded = () => {
      flushWatchBatch();
      captureFunnelEvent("vsl_completed", {
        video_id: videoId,
        percent: 100,
        furthest_second: Math.max(0, Math.round(video.duration)),
        video_duration_seconds: Math.max(0, Math.round(video.duration))
      });
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    window.addEventListener("pagehide", flushWatchBatch);
    return () => {
      flushWatchBatch();
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
      window.removeEventListener("pagehide", flushWatchBatch);
    };
  }, [flushWatchBatch, videoId]);

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
