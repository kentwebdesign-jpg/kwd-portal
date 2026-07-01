import type Anthropic from "@anthropic-ai/sdk";
import type { PageShots } from "./render";

// The design-review half of the render → critique → refine loop. A separate
// vision call looks at real screenshots of the generated home page and judges
// them against the agency wow bar — the same "render it, look at it, fix it"
// pass a human designer does, which one-shot generation is missing.

export type CritiqueProblem = {
  severity: "critical" | "major" | "minor";
  what: string;
  fix: string;
};

export type Critique = {
  score: number; // 1-10 against the wow bar
  verdict: "ship" | "revise";
  problems: CritiqueProblem[];
  summary: string;
};

// What "good" means, distilled from MASTER-BUILD-PROMPT.md so the judge scores
// the same bar the generator was asked to hit. Kept tight: a focused rubric
// out-judges a wall of rules.
const RUBRIC = `You are the design director at a premium web agency, reviewing a just-built
homepage before it goes to the client. You are looking at REAL screenshots of
the rendered site: desktop hero (1440×900), the full desktop page, and mobile
(390×844). Judge what you SEE, not what the code intended.

Score 1-10 against this bar (10 = flagship agency work):
- HERO IMPACT: does the first screen genuinely impress? Oversized confident
  type, layered depth, considered colour — or flat, timid, template-ish?
- TYPOGRAPHY: bold scale contrast, a distinctive display face, tight leading on
  headings. Timid/default-looking type caps the score at 6.
- SPACING: generous, consistent rhythm; nothing cramped against screen edges;
  sections breathe. Cramped edges cap the score at 6.
- COLOUR: cohesive palette with one accent that pops; intentional dark/light
  section contrast; nothing clashing or muddy.
- IMAGERY: images (if any) look premium and sit behind readable text (strong
  overlays). ANY garbled/AI-mangled text inside an image is CRITICAL.
- MOBILE: layout intact at 390px — no overflow, no squashed nav, tap targets
  and type sizes sane, hero still impressive.
- BROKENNESS: overlapping text, unstyled HTML, missing sections, invisible
  text (e.g. everything stuck at opacity 0), horizontal scrollbars — any of
  these is CRITICAL.
- DISTINCTIVENESS: would this pass as a bespoke build, or does it read as a
  generic centred-stacked-cards template?

Verdict rules:
- "ship" only if score >= 8 AND there are no critical problems.
- Otherwise "revise", with concrete, actionable fixes phrased as CSS/HTML
  changes (e.g. "hero h1 is ~40px — raise to clamp(3rem,7vw,5.5rem) and cut
  line-height to 1.05"), not vague vibes ("make it pop").`;

export function critiqueSystem(): string {
  return RUBRIC + `

OUTPUT FORMAT (critical): respond with ONLY a single JSON object, no markdown,
no code fences:
{
  "score": number,                // 1-10, one decimal allowed
  "verdict": "ship" | "revise",
  "summary": string,              // 1-2 sentences for the build log
  "problems": [
    { "severity": "critical" | "major" | "minor", "what": string, "fix": string }
  ]
}`;
}

export function critiqueUserContent(
  shots: PageShots,
  context: { businessName: string; designRationale: string },
): Anthropic.MessageParam["content"] {
  const img = (data: string): Anthropic.ImageBlockParam => ({
    type: "image",
    source: { type: "base64", media_type: "image/jpeg", data },
  });
  return [
    {
      type: "text",
      text:
        `Business: ${context.businessName}\n` +
        `Design rationale from the generator: ${context.designRationale || "(none given)"}\n\n` +
        `Screenshot 1 — DESKTOP HERO (1440×900, the first screen):`,
    },
    img(shots.desktopHero),
    { type: "text", text: "Screenshot 2 — FULL DESKTOP PAGE (top-to-bottom flow):" },
    img(shots.desktopFull),
    { type: "text", text: "Screenshot 3 — MOBILE (390×844, first screen):" },
    img(shots.mobile),
    { type: "text", text: "Review against the rubric and output the JSON verdict." },
  ];
}

// ── The refine pass ─────────────────────────────────────────────────────────
// Takes the critique plus the current shared design + home body and rewrites
// only what needs to change. Shared CSS changes cascade to every page.

export function reviseSystem(): string {
  return `You are the same senior designer, now FIXING your homepage based on a design
review of real rendered screenshots. Apply every fix the review calls for —
surgically. Keep everything that already works: same brand direction, same
content and copy, same class-name conventions, same pages/nav. Do not rename
classes used by other pages; extend or restyle them in place. Strengthen, don't
rebuild from scratch.

Non-negotiables while fixing (house rules): no preloaders; generous edge
padding (content never tight to the viewport edge); mobile-first integrity at
390px; text over imagery must sit on a strong overlay; British English; never
invent facts, reviews or accreditations.

OUTPUT FORMAT (critical): respond with ONLY a single JSON object, no markdown,
no code fences. Include ONLY the parts you changed; omit unchanged keys:
{
  "shared_css": string,   // the COMPLETE revised CSS design system (omit if unchanged)
  "header_html": string,  // complete revised header (omit if unchanged)
  "footer_html": string,  // complete revised footer (omit if unchanged)
  "home_body": string     // complete revised home <main> inner HTML (omit if unchanged)
}
Whatever you include must be COMPLETE — it replaces the old version wholesale.`;
}

export function reviseUser(
  critique: Critique,
  current: { css: string; header: string; footer: string; homeBody: string },
): string {
  return (
    `DESIGN REVIEW VERDICT (from real screenshots of the current build):\n` +
    JSON.stringify(critique, null, 2) +
    `\n\nCURRENT SHARED CSS:\n${current.css}` +
    `\n\nCURRENT HEADER:\n${current.header}` +
    `\n\nCURRENT FOOTER:\n${current.footer}` +
    `\n\nCURRENT HOME <main> BODY:\n${current.homeBody}` +
    `\n\nApply the fixes and output the JSON.`
  );
}

export function parseCritique(raw: string): Critique | null {
  try {
    let t = raw.trim();
    t = t.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
    const first = t.indexOf("{");
    const last = t.lastIndexOf("}");
    if (first >= 0 && last > first) t = t.slice(first, last + 1);
    const j = JSON.parse(t) as Partial<Critique>;
    const score = typeof j.score === "number" ? Math.max(1, Math.min(10, j.score)) : NaN;
    if (Number.isNaN(score)) return null;
    return {
      score,
      verdict: j.verdict === "ship" ? "ship" : "revise",
      summary: typeof j.summary === "string" ? j.summary : "",
      problems: Array.isArray(j.problems)
        ? j.problems
            .filter((p): p is CritiqueProblem => !!p && typeof p === "object" && typeof (p as CritiqueProblem).what === "string")
            .map((p) => ({
              severity: p.severity === "critical" || p.severity === "major" ? p.severity : "minor",
              what: p.what,
              fix: typeof p.fix === "string" ? p.fix : "",
            }))
        : [],
    };
  } catch {
    return null;
  }
}
