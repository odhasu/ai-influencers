"use client";

import { Play } from "lucide-react";
import { useState } from "react";

export const testimonials = [
  ["IE0_sR4QfRg", "He makes $25,000/m selling unbranded glasses"],
  ["-yUZ4U91dVQ", "He's Doing $20,000/Month With High Ticket Reselling"],
  ["7xr2eSPviGM", "$0 to $30,000/Month in 6 Months"],
  ["K4zdxmcqkcQ", "16 Year Old: $0 → $27K/Month"],
  ["evjICkbXsig", "15 Year Old Hitting $22K/Month"],
  ["uP7VTQFMmFY", "From Trampoline Park to $21K/Month"],
  ["fX0Jrb7-bkI", "He Bought a C8 Corvette From Reselling"],
  ["A8NgC6evgpA", "16 Year Old: $0 → $8K/Month"],
  ["I80B0-LlEUk", "16 Year Old Made $70,000 With High Ticket Reselling"],
  ["JsOt0YROtMk", "He's 15 and Makes $10,000/Month"]
] as const;

type TestimonialGridProps = {
  onPlay?: (videoId: string, position: number) => void;
};

export function TestimonialGrid({ onPlay }: TestimonialGridProps) {
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  function play(videoId: string, position: number) {
    setActiveVideo(videoId);
    onPlay?.(videoId, position);
  }

  return (
    <div className="video-grid">
      {testimonials.map(([id, title], index) =>
        activeVideo === id ? (
          <article className="video-card active" key={id}>
            <span className="video-thumb video-player">
              <iframe
                title={title}
                src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </span>
            <span>
              <span className="video-title">{title}</span>
              <span className="video-source">Inner Circle Member</span>
            </span>
          </article>
        ) : (
          <button
            className="video-card"
            type="button"
            key={id}
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
