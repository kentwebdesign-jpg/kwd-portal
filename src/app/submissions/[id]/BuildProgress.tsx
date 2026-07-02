"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Live build progress: an ordered checklist that ticks off each stage as the
// build moves through it, plus an elapsed timer so a stuck build is obvious.
// Polls the server (router.refresh) so buildStage updates arrive without a
// manual reload.

// The canonical order the build runs in. Each entry matches the buildStage
// strings emitted by sitebuilder.ts. "Adding imagery" only happens when a hero
// image was generated; if it's skipped, it simply shows as done once the build
// has moved past it (by position), which reads correctly.
const STEPS: { label: string; match: (s: string) => boolean }[] = [
  { label: "Generating imagery", match: (s) => s.startsWith("Generating imagery") },
  { label: "Designing the site with AI", match: (s) => s.startsWith("Designing the site") },
  { label: "Writing page content", match: (s) => s.startsWith("Writing page content") },
  { label: "Design review (render → critique → refine)", match: (s) => s.startsWith("Reviewing the design") || s.startsWith("Refining the design") },
  { label: "Provisioning WordPress", match: (s) => s.startsWith("Provisioning") },
  { label: "Setting up access", match: (s) => s.startsWith("Setting up access") },
  { label: "Preparing WordPress", match: (s) => s.startsWith("Preparing WordPress") },
  { label: "Adding imagery to the site", match: (s) => s.startsWith("Adding imagery") },
  { label: "Building pages", match: (s) => s.startsWith("Building pages") },
  { label: "Setting the home page", match: (s) => s.startsWith("Setting the home page") },
];

// If a build runs longer than this, flag it as possibly stuck.
// The design phase alone (plan + pages + the render→critique→refine review)
// legitimately runs 8-12 minutes, so only flag well beyond that.
const STALE_SECONDS = 900;

function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function BuildProgress({
  currentStage,
  startedAt,
}: {
  currentStage: string | null;
  startedAt: string | null;
}) {
  const router = useRouter();

  // Poll for stage/status changes.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [router]);

  // Tick the elapsed timer every second. Start at 0 (matches server render) and
  // set the real time on mount to avoid a hydration mismatch.
  const [now, setNow] = useState<number>(0);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const stage = currentStage ?? "";
  const matchedIndex = STEPS.findIndex((s) => s.match(stage));
  const currentIndex = matchedIndex === -1 ? 0 : matchedIndex;

  const startedMs = startedAt ? new Date(startedAt).getTime() : null;
  const elapsed = startedMs ? Math.max(0, Math.floor((now - startedMs) / 1000)) : null;
  const stale = elapsed != null && elapsed >= STALE_SECONDS;

  return (
    <div style={{ margin: "4px 0 12px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
        <span style={{ color: stale ? "#b45309" : "#0e7c7b", fontWeight: 600, fontSize: 14 }}>
          {stale ? "Still building…" : "Building…"}
        </span>
        {elapsed != null && (
          <span
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 13,
              color: stale ? "#b45309" : "#888",
            }}
          >
            {fmt(elapsed)}
          </span>
        )}
      </div>

      <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {STEPS.map((step, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          const color = done ? "#137e6d" : active ? "#0e7c7b" : "#bbb";
          const extra = active ? detail(stage) : "";
          return (
            <li
              key={step.label}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 14 }}
            >
              <span
                aria-hidden
                style={{
                  width: 18,
                  height: 18,
                  flex: "0 0 18px",
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#fff",
                  background: done ? "#137e6d" : active ? "#0e7c7b" : "#e2e2e2",
                }}
              >
                {done ? "✓" : active ? <Spinner /> : ""}
              </span>
              <span style={{ color, fontWeight: active ? 600 : 400 }}>{step.label}</span>
              {extra && <span style={{ color: "#999", fontSize: 12 }}>{extra}</span>}
            </li>
          );
        })}
      </ol>

      {stale && (
        <p style={{ color: "#b45309", fontSize: 12, margin: "10px 0 0" }}>
          This is taking longer than usual. The build may have been interrupted (e.g. a redeploy). If it does not
          finish shortly, re-run it.
        </p>
      )}
    </div>
  );
}

// For "Building pages (3/7): Contact" show just the "(3/7): Contact" part next
// to the "Building pages" step. Other stages have no useful extra detail.
function detail(stage: string): string {
  if (stage.startsWith("Building pages")) return stage.slice("Building pages".length).trim();
  if (stage.startsWith("Writing page content")) return stage.slice("Writing page content".length).trim();
  if (stage.startsWith("Reviewing the design") || stage.startsWith("Refining the design")) return stage;
  return "";
}

function Spinner() {
  return (
    <span
      style={{
        width: 10,
        height: 10,
        border: "2px solid rgba(255,255,255,0.5)",
        borderTopColor: "#fff",
        borderRadius: "50%",
        display: "inline-block",
        animation: "kwd-spin 0.7s linear infinite",
      }}
    >
      <style>{`@keyframes kwd-spin{to{transform:rotate(360deg)}}`}</style>
    </span>
  );
}
