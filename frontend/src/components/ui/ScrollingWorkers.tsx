"use client";

import React, { useRef, useEffect } from "react";

// Six high-quality AI-generated images of Indian vocational workers
const WORKER_IMAGES = [
  {
    src: "/images/worker_electrician.png",
    label: "Electrician",
    trade: "ITI Electrical",
  },
  {
    src: "/images/worker_weaver.png",
    label: "Weaver Artisan",
    trade: "Handloom Craft",
  },
  {
    src: "/images/worker_carpenter.png",
    label: "Carpenter",
    trade: "Wood Craft",
  },
  {
    src: "/images/worker_tailor.png",
    label: "Tailor",
    trade: "PMKVY Apparel",
  },
  {
    src: "/images/worker_mechanic.png",
    label: "Auto Mechanic",
    trade: "ITI Motor Vehicle",
  },
  {
    src: "/images/worker_beautician.png",
    label: "Beautician",
    trade: "PMKVY Beauty & Wellness",
  },
];

// Duplicate so the loop is seamless — we need at least 2× for infinite scroll
const TRACK_IMAGES = [...WORKER_IMAGES, ...WORKER_IMAGES, ...WORKER_IMAGES];

export default function ScrollingWorkers() {
  // Pause on hover
  const trackRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (trackRef.current) {
      trackRef.current.style.animationPlayState = "paused";
    }
  };

  const handleMouseLeave = () => {
    if (trackRef.current) {
      trackRef.current.style.animationPlayState = "running";
    }
  };

  return (
    <>
      <style>{`
        @keyframes saathi-marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(calc(-100% / 3)); }
        }

        .saathi-marquee-track {
          display: flex;
          width: max-content;
          animation: saathi-marquee 40s linear infinite;
          will-change: transform;
        }

        /* Slower on mobile — fewer pixels to cover */
        @media (max-width: 768px) {
          .saathi-marquee-track {
            animation-duration: 28s;
          }
        }

        .saathi-marquee-item {
          position: relative;
          flex-shrink: 0;
          width: 340px;
          height: 220px;
          overflow: hidden;
        }

        @media (max-width: 768px) {
          .saathi-marquee-item {
            width: 240px;
            height: 160px;
          }
        }

        .saathi-marquee-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center top;
          display: block;
          /* Subtle scale creates depth */
          transform: scale(1.04);
          transition: transform 0.6s ease;
        }

        .saathi-marquee-item:hover img {
          transform: scale(1.0);
        }

        /* ── Diagonal gradient mask blending adjacent images ── */
        /* Each image bleeds into the next via diagonal masks */
        .saathi-marquee-item::before {
          content: '';
          position: absolute;
          inset: 0;
          /* Left-bleed: right edge fades to transparent */
          background: linear-gradient(
            105deg,
            transparent 50%,
            rgba(255, 248, 241, 0.85) 88%,
            rgba(255, 248, 241, 1) 100%
          );
          z-index: 2;
          pointer-events: none;
        }

        .saathi-marquee-item::after {
          content: '';
          position: absolute;
          inset: 0;
          /* Right-bleed: left edge fades to transparent */
          background: linear-gradient(
            105deg,
            rgba(255, 248, 241, 1) 0%,
            rgba(255, 248, 241, 0.7) 12%,
            transparent 40%
          );
          z-index: 2;
          pointer-events: none;
        }

        /* Label badge that appears on hover */
        .saathi-marquee-label {
          position: absolute;
          bottom: 12px;
          left: 16px;
          z-index: 4;
          display: flex;
          flex-direction: column;
          gap: 2px;
          opacity: 0;
          transform: translateY(6px);
          transition: opacity 0.3s ease, transform 0.3s ease;
          pointer-events: none;
        }

        .saathi-marquee-item:hover .saathi-marquee-label {
          opacity: 1;
          transform: translateY(0);
        }

        .saathi-marquee-label-name {
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 13px;
          color: #fff;
          text-shadow: 0 1px 4px rgba(0,0,0,0.5);
          white-space: nowrap;
          line-height: 1.2;
        }

        .saathi-marquee-label-trade {
          font-family: var(--font-body);
          font-weight: 500;
          font-size: 11px;
          color: var(--color-parchment-glow);
          text-shadow: 0 1px 4px rgba(0,0,0,0.5);
          white-space: nowrap;
        }

        /* Bottom gradient overlay inside each image for label readability */
        .saathi-marquee-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to top,
            rgba(0, 20, 16, 0.55) 0%,
            transparent 45%
          );
          z-index: 3;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .saathi-marquee-item:hover .saathi-marquee-overlay {
          opacity: 1;
        }
      `}</style>

      <section
        aria-label="Indian vocational workers gallery"
        style={{
          width: "100%",
          overflow: "hidden",
          position: "relative",
          background: "var(--color-cream-canvas)",
          /* Thin top/bottom borders as a subtle frame */
          borderTop: "1px solid rgba(0, 64, 56, 0.07)",
          borderBottom: "1px solid rgba(0, 64, 56, 0.07)",
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* ── Hard edge masks on left & right so images fade at viewport edges ── */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: "120px",
            background:
              "linear-gradient(to right, var(--color-cream-canvas) 0%, transparent 100%)",
            zIndex: 10,
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: "120px",
            background:
              "linear-gradient(to left, var(--color-cream-canvas) 0%, transparent 100%)",
            zIndex: 10,
            pointerEvents: "none",
          }}
        />

        {/* ── The scrolling track ── */}
        <div
          ref={trackRef}
          className="saathi-marquee-track"
          aria-hidden="true"
        >
          {TRACK_IMAGES.map((worker, idx) => (
            <div key={idx} className="saathi-marquee-item">
              <img
                src={worker.src}
                alt={`${worker.label} — ${worker.trade}`}
                loading={idx < 6 ? "eager" : "lazy"}
                decoding="async"
              />
              {/* Hover bottom overlay */}
              <div className="saathi-marquee-overlay" />
              {/* Label badge */}
              <div className="saathi-marquee-label">
                <span className="saathi-marquee-label-name">{worker.label}</span>
                <span className="saathi-marquee-label-trade">{worker.trade}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Accessible caption below the strip ── */}
        <p
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
          }}
        >
          A continuous gallery of Indian vocational workers — electricians,
          weavers, carpenters, tailors, mechanics, and beauticians — happily
          engaged in their skilled trades.
        </p>
      </section>
    </>
  );
}
