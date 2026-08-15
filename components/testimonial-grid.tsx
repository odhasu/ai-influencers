"use client";

import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const testimonials = [
  ["IE0_sR4QfRg", "Member story: building a focused product strategy"],
  ["-yUZ4U91dVQ", "Member story: developing a high-ticket workflow"],
  ["7xr2eSPviGM", "Member story: lessons from the first six months"],
  ["K4zdxmcqkcQ", "Member story: starting a reselling operation"],
  ["evjICkbXsig", "Member story: learning the fundamentals"],
  ["uP7VTQFMmFY", "Member story: moving from side project to process"],
  ["fX0Jrb7-bkI", "Member story: staying consistent while growing"],
  ["A8NgC6evgpA", "Member story: improving sourcing decisions"],
  ["I80B0-LlEUk", "Member story: building repeatable systems"],
  ["JsOt0YROtMk", "Member story: early lessons from reselling"]
] as const;

type TestimonialGridProps = {
  onPlay?: (videoId: string, position: number) => void;
  limit?: number;
};

export function TestimonialGrid({ onPlay, limit = testimonials.length }: TestimonialGridProps) {
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const playerRef = useRef<HTMLIFrameElement>(null);
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const visibleTestimonials = testimonials.slice(0, Math.max(0, limit));

  useEffect(() => {
    if (activeVideo) playerRef.current?.focus();
  }, [activeVideo]);

  function play(videoId: string, position: number) {
    setActiveVideo(videoId);
    onPlay?.(videoId, position);
  }

  return (
    <div className="video-grid">
      {visibleTestimonials.map(([id, title], index) =>
        activeVideo === id ? (
          <article className="video-card active" key={id}>
            <span className="video-thumb video-player">
              <iframe
                ref={playerRef}
                title={title}
                tabIndex={-1}
                src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </span>
            <span>
              <span className="video-title">{title}</span>
              <span className="video-source">Inner Circle Member</span>
            </span>
            <button
              className="video-card-close"
              type="button"
              onClick={() => {
                setActiveVideo(null);
                window.requestAnimationFrame(() => triggerRefs.current.get(id)?.focus());
              }}
            >
              Close video
            </button>
          </article>
        ) : (
          <button
            className="video-card"
            type="button"
            key={id}
            ref={(element) => {
              if (element) triggerRefs.current.set(id, element);
              else triggerRefs.current.delete(id);
            }}
            aria-label={`Play testimonial: ${title}`}
            onClick={() => play(id, index + 1)}
          >
            <span className="video-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
                alt=""
                loading="lazy"
                decoding="async"
                fetchPriority="low"
              />
              <span className="play-icon" aria-hidden="true">
                <Play size={22} fill="currentColor" />
              </span>
            </span>
            <span>
              <span className="video-title">{title}</span>
              <span className="video-source">Inner Circle Member</span>
            </span>
          </button>
        )
      )}
    </div>
  );
}
