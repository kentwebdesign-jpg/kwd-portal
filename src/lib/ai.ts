import Anthropic from "@anthropic-ai/sdk";
import { MASTER_BUILD_PROMPT } from "./master-build-prompt";
import { DESIGN_REFERENCES } from "./design-references";
import { DESIGN_INTELLIGENCE } from "./design-intelligence";
import { BUTTON_BUILD_SPEC } from "./button-build-spec";
import { renderPageShots } from "./render";
import {
  critiqueSystem,
  critiqueUserContent,
  parseCritique,
  reviseSystem,
  reviseUser,
  type Critique,
} from "./critique";

// Turns an onboarding brief into a complete, multi-page website using Claude,
// driven by the agency's house rules (MASTER-BUILD-PROMPT.md) plus the client's
// brief. Delivery mechanism: each page becomes its own WordPress page, so the
// output is a set of self-contained HTML fragments that share a byte-identical
// header, footer and CSS. Returns { error } if no API key is set or a call
// fails, so the build can stop cleanly rather than half-provision a site.
//
// Pipeline (the third phase is what separates this from a one-shot generator):
//   1. PLAN     — sitemap + shared design system (CSS, header, footer)
//   2. WRITE    — each page's body, in parallel
//   3. REVIEW   — render the home page to real screenshots, have a design-
//                 director pass critique them against the wow bar, refine the
//                 design, and re-check. The generator finally SEES its output.

const MODEL = "claude-opus-4-8";

export type SiteImage = { url: string; label: string };

// The IMAGES rule depends on whether we generated images for this build. With a
// set, the AI is told to use those exact (hosted) URLs across the whole site and
// invent no other photo URLs; without any, it stays image-free and leans on CSS.
function imagesSection(images?: SiteImage[] | null): string {
  if (images && images.length) {
    const list = images.map((img) => `- [${img.label}] ${img.url}`).join("\n");
    return `IMAGES: a set of professional images has been generated specifically for THIS
business and is hosted for the site. Use them THROUGHOUT the site, not just the
home hero — the home hero, service/feature cards, the about section, section
backgrounds, and relevant page headers. Reuse images across pages where it fits.
Each is labelled with what it depicts; place them where that subject is relevant
(the "hero" image suits the main hero/section backgrounds). Available images
(use these exact URLs verbatim, do not alter them):
${list}
Use them as full-bleed CSS background-image (with a gradient/overlay so text
stays readable) or as <img> with descriptive alt text and object-fit: cover. Do
NOT invent, guess or link ANY other photo URLs. Between images, keep building
visual richness with CSS (gradients, colour, shapes, large type, generous
spacing) and inline SVG for icons. If the brief contains a logo URL you may use
it and give it a proper moment; otherwise render the business name as a styled
wordmark.`;
  }
  return `IMAGES: do not use <img> tags pointing at photo URLs — there are no photo assets
yet. Build visual richness with CSS (gradients, colour, shapes, large type,
generous spacing) and inline SVG for icons. If the brief contains a logo URL you
may use it and give it a proper moment; otherwise render the business name as a
styled wordmark.`;
}

// How the house rules map onto THIS delivery mechanism (individual WP pages).
// The master prompt is the quality bar; this is the output contract.
function deliveryContract(images?: SiteImage[] | null): string {
  return `

────────────────────────────────────────────────────────
DELIVERY MECHANISM FOR THIS BUILD (read carefully)
────────────────────────────────────────────────────────
The site is published as a set of INDIVIDUAL WordPress pages — one WordPress
page per page in the sitemap. It is NOT a single scrolling page. Each page's
content is a self-contained HTML fragment injected into a blank-canvas
WordPress theme (the theme adds no chrome of its own).

Because every page is standalone, the shared chrome is repeated verbatim on
each page:
- ONE shared CSS design system (a single block of CSS) reused byte-for-byte on
  every page.
- A byte-identical HEADER (the sticky top bar + nav — the Grieve & Wife
  standard) on every page.
- A byte-identical FOOTER (page links, short bio, client logo, contact incl.
  phone + registered address, and the "Built by Kent Web Design" credit) on
  every page.

INTERNAL LINKS: root-relative. The home page is the site root, so its nav link
is exactly "/". Every other page links as "/<slug>/" (leading and trailing
slash, e.g. "/boiler-repair/"). The nav in the header must link to every page
in the sitemap and the hrefs MUST match the page slugs exactly.

${imagesSection(images)}

SEO: WordPress supplies each page's <title> (from the WP page title) and the
theme emits the meta description we set, plus /wp-sitemap.xml and robots.txt.
Your job on-page: one keyword-led <h1> per page, semantic headings, and
schema.org JSON-LD embedded directly in the page body as
<script type="application/ld+json"> (valid anywhere in the document) —
LocalBusiness on the home/contact page, FAQPage on the FAQ page, etc. Never
invent reviews, ratings or accreditations for the schema.

JAVASCRIPT & MOTION (the WOW layer): the page MUST still be fully usable without
JS (progressive enhancement) — use CSS/HTML for core interactions (<details> for
FAQs, position: sticky for the mobile call bar). ON TOP of that, you MAY load
lightweight motion libraries from a CDN via <script src> to deliver the wow layer:
Lenis (smooth-scroll) and GSAP + ScrollTrigger (staggered reveals, pinned
sections, parallax, clip-path image reveals, counters). Keep it lean, lazy-init,
respect prefers-reduced-motion, and never drop below the Lighthouse-90 budget.
Full 3D/WebGL is out of scope for this auto-build (no asset pipeline) — get the
"wow" from bold type, depth, layered CSS and choreographed GSAP motion instead.
No preloaders, ever.

MOTION SAFETY (hard requirement): content must NEVER be invisible without JS or
before a scroll trigger fires. Anything animated in must start visible-enough
(no permanent opacity:0 in CSS; set initial states from JS only), so a
screenshot or no-JS visit still shows a complete page.`;
}

// ── Phase 1: plan the site + design system ────────────────────────────────
function planSystem(images?: SiteImage[] | null): string {
  return `${MASTER_BUILD_PROMPT}
${DESIGN_REFERENCES}
${DESIGN_INTELLIGENCE}
${BUTTON_BUILD_SPEC}
${deliveryContract(images)}

────────────────────────────────────────────────────────
YOUR TASK NOW — PHASE 1 of 2: PLAN THE SITE + DESIGN SYSTEM
────────────────────────────────────────────────────────
From the client's brief, decide the sitemap and design the SHARED parts of the
site: the one CSS design system, the header (with working nav to every page)
and the footer. Do NOT write the body content of each page yet — that happens in
phase 2. For each page, instead write a clear internal outline of what it must
contain, derived from the brief.

Sitemap rules (build to the brief, honour the master prompt):
- Always a HOME page (is_home: true, slug "home").
- If it's a service business, ONE page per distinct service the brief lists
  (each gets its own explained page — real substance, not a stub).
- ONE page per town/area the brief actually lists as covered — real, distinct
  content each. Never invent coverage; never spin up thin near-duplicate town
  pages.
- An FAQ page (wired to FAQPage schema in phase 2).
- A contact page (click-to-call, address, hours, enquiry form UX per the master
  prompt) and an about page if the brief gives a story.
- Only add feature pages the brief asks for. Keep it to what the brief supports.

Build the palette AND the fonts from the client's brand/logo cues, make it
visually distinct (not a template), and hit the master prompt's quality bar.

OUTPUT FORMAT (critical): respond with ONLY a single JSON object, no markdown,
no code fences, no commentary. Shape:
{
  "site_title": string,            // the business name for the WP site title
  "tagline": string,               // short tagline for the WP site description
  "design_rationale": string,      // 1-3 sentences: palette + font choices and why (for our logs)
  "shared_css": string,            // the COMPLETE CSS design system, WITHOUT a <style> tag. Includes @import for Google fonts, resets, layout, header, footer, buttons, sections, cards, FAQ, forms, responsive media queries, reduced-motion.
  "header_html": string,           // the full <header>…</header> markup: sticky top bar, wordmark/logo, nav linking to every page ("/" for home, "/<slug>/" for others), and a primary call-to-action (tel: link).
  "footer_html": string,           // the full <footer>…</footer> markup: page links, short bio, logo/wordmark, contact (phone + registered address), socials if provided, auto-updating year, and a small "Built by Kent Web Design" credit linking to https://kentwebdesign.com
  "shared_js": string,             // OPTIONAL vanilla JS WITHOUT a <script> tag (scroll reveals, mobile nav toggle, form success state). "" if none. Site must work without it.
  "pages": [
    {
      "slug": string,              // url slug, lowercase-hyphen. Home is "home".
      "title": string,             // WP page title / <title>
      "nav_label": string,         // short label used in the header nav
      "is_home": boolean,
      "h1": string,                // the single keyword-led H1 for this page
      "meta_description": string,  // unique ~150 char meta description
      "outline": string            // detailed, brief-derived instructions for what sections + copy this page must contain in phase 2
    }
  ]
}`;
}

// ── Phase 2: write one page's body ─────────────────────────────────────────
function pageSystem(shared: SharedDesign, images?: SiteImage[] | null): string {
  return `${MASTER_BUILD_PROMPT}
${DESIGN_REFERENCES}
${DESIGN_INTELLIGENCE}
${BUTTON_BUILD_SPEC}
${deliveryContract(images)}

────────────────────────────────────────────────────────
YOUR TASK NOW — PHASE 2 of 2: WRITE ONE PAGE'S BODY CONTENT
────────────────────────────────────────────────────────
The shared design system, header and footer for this site have ALREADY been
designed (below). You are writing the unique BODY of a single page. Match the
existing CSS class names and visual language exactly — reuse the classes defined
in the shared CSS; introduce new ones only when a section genuinely needs them,
in the same style.

SHARED CSS (already applied to every page — reuse these classes):
${shared.css}

SHARED HEADER (already on the page, do not repeat it):
${shared.header}

SHARED FOOTER (already on the page, do not repeat it):
${shared.footer}

OUTPUT FORMAT (critical): output ONLY the HTML that goes INSIDE the page's
<main> element — the page's sections and their content. Do NOT output <style>,
the header, the footer, the <main> wrapper, <html>/<head>/<body>, markdown, code
fences, or any commentary. Start directly with the first section element.

Requirements for this page:
- Lead with the page's <h1> exactly as specified.
- Populate every section with real, specific copy from the brief — British
  English, plain and benefit-led, no clichés or filler, never invent facts.
- Include repeated, clear CTA moments (tel: links formatted correctly) and, on
  relevant pages, the enquiry form UX and JSON-LD schema described above.`;
}

export type SitePage = {
  slug: string;
  title: string;
  navLabel: string;
  isHome: boolean;
  metaDescription: string;
  html: string; // full page content: <style> + header + <main> + footer + <script>
};

// Diagnostics from the design-review loop, surfaced in the portal's build log.
export type DesignReview = {
  reviewed: boolean; // false when no renderer was available
  passes: number; // how many render→critique rounds ran
  initialScore: number | null;
  finalScore: number | null;
  verdict: string; // "ship" | "revise" | "skipped: <reason>"
  summary: string; // the reviewer's final one-liner
};

export type SiteResult =
  | { pages: SitePage[]; siteTitle: string; tagline: string; design: DesignReview; error?: undefined }
  | { error: string; pages?: undefined };

type SharedDesign = { css: string; header: string; footer: string; js: string };

type PlanPage = {
  slug: string;
  title: string;
  nav_label: string;
  is_home: boolean;
  h1: string;
  meta_description: string;
  outline: string;
};

type Plan = {
  site_title: string;
  tagline: string;
  design_rationale?: string;
  shared_css: string;
  header_html: string;
  footer_html: string;
  shared_js?: string;
  pages: PlanPage[];
};

const MAX_PAGES = 16;
const PAGE_CONCURRENCY = 4;
// Design-review budget: at most this many critique rounds (each may trigger one
// refine). Two rounds catches "flat/broken" and verifies the fix landed.
const MAX_REVIEW_ROUNDS = 2;
const SHIP_SCORE = 8;

function newClient() {
  // Cap each request so a slow/stalled call fails to the caller rather than
  // hanging the whole build.
  return new Anthropic({ timeout: 5 * 60 * 1000, maxRetries: 1 });
}

async function runText(
  client: Anthropic,
  system: string,
  user: string | Anthropic.MessageParam["content"],
  maxTokens: number,
  effort: "low" | "medium" | "high",
): Promise<string> {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    output_config: { effort },
    system,
    messages: [{ role: "user", content: user }],
  });
  const message = await stream.finalMessage();
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

// Strip accidental markdown code fences and pull the outermost JSON object.
function extractJson(text: string): string {
  let t = text.trim();
  t = t.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  return t;
}

function stripFragment(text: string): string {
  let t = text.trim();
  t = t.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
  return t;
}

function safeSlug(raw: string, fallback: string): string {
  const s = String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || fallback;
}

function assemblePage(shared: SharedDesign, body: string): string {
  const script = shared.js.trim() ? `\n<script>\n${shared.js}\n</script>` : "";
  return `<style>\n${shared.css}\n</style>\n${shared.header}\n<main>\n${body}\n</main>\n${shared.footer}${script}`;
}

// Run tasks with a small concurrency cap so we don't hammer the API or blow the
// per-build time budget when there are many pages.
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// ── Phase 3: the design-review loop ─────────────────────────────────────────
// Render the home page, critique the screenshots against the wow bar, refine
// the shared design + home body, verify the fix with a second render. Returns
// the (possibly improved) design and what happened, and never throws — any
// infrastructure failure just means "reviewed as far as we got".
async function designReviewLoop(
  client: Anthropic,
  shared: SharedDesign,
  homeBody: string,
  context: { businessName: string; designRationale: string },
  onStage: (s: string) => Promise<void>,
): Promise<{ shared: SharedDesign; homeBody: string; review: DesignReview }> {
  const review: DesignReview = {
    reviewed: false,
    passes: 0,
    initialScore: null,
    finalScore: null,
    verdict: "skipped: renderer unavailable",
    summary: "",
  };

  let current = { shared, homeBody };
  // Keep the best-scoring version so a refine can never make the site worse.
  let best: { shared: SharedDesign; homeBody: string; score: number } | null = null;

  for (let round = 1; round <= MAX_REVIEW_ROUNDS; round++) {
    await onStage(`Reviewing the design (pass ${round})`);
    const shots = await renderPageShots(
      assemblePage(current.shared, current.homeBody),
      context.businessName,
    );
    if (!shots) {
      // No Chrome available (or render blew up) — stop reviewing, keep the
      // best version we have. First round: nothing was ever reviewed.
      if (review.passes === 0) review.verdict = "skipped: renderer unavailable";
      break;
    }

    let critique: Critique | null = null;
    try {
      const raw = await runText(client, critiqueSystem(), critiqueUserContent(shots, context), 3000, "medium");
      critique = parseCritique(raw);
    } catch (err) {
      console.error(`Design critique (pass ${round}) failed:`, err);
    }
    if (!critique) {
      if (review.passes === 0) review.verdict = "skipped: critique failed";
      break;
    }

    review.reviewed = true;
    review.passes = round;
    review.summary = critique.summary;
    if (review.initialScore == null) review.initialScore = critique.score;
    review.finalScore = critique.score;
    review.verdict = critique.verdict;

    if (best == null || critique.score >= best.score) {
      best = { ...current, score: critique.score };
    } else {
      // The refine regressed the score — roll back to the earlier version.
      current = { shared: best.shared, homeBody: best.homeBody };
      review.finalScore = best.score;
      break;
    }

    const hasCritical = critique.problems.some((p) => p.severity === "critical");
    if (critique.verdict === "ship" && critique.score >= SHIP_SCORE && !hasCritical) break;
    if (round === MAX_REVIEW_ROUNDS) break; // out of budget — ship the best we have

    // Refine: apply the reviewer's fixes to the shared design + home body.
    await onStage(`Refining the design (pass ${round})`);
    try {
      const raw = await runText(
        client,
        reviseSystem(),
        reviseUser(critique, {
          css: current.shared.css,
          header: current.shared.header,
          footer: current.shared.footer,
          homeBody: current.homeBody,
        }),
        32000,
        "high",
      );
      const patch = JSON.parse(extractJson(raw)) as Partial<{
        shared_css: string;
        header_html: string;
        footer_html: string;
        home_body: string;
      }>;
      const revised: SharedDesign = {
        css: typeof patch.shared_css === "string" && patch.shared_css.trim() ? patch.shared_css : current.shared.css,
        header:
          typeof patch.header_html === "string" && patch.header_html.trim() ? patch.header_html : current.shared.header,
        footer:
          typeof patch.footer_html === "string" && patch.footer_html.trim() ? patch.footer_html : current.shared.footer,
        js: current.shared.js,
      };
      const revisedBody =
        typeof patch.home_body === "string" && patch.home_body.trim() ? patch.home_body : current.homeBody;
      const changed =
        revised.css !== current.shared.css ||
        revised.header !== current.shared.header ||
        revised.footer !== current.shared.footer ||
        revisedBody !== current.homeBody;
      if (!changed) break; // reviewer's fixes produced no diff — nothing more to verify
      current = { shared: revised, homeBody: revisedBody };
    } catch (err) {
      console.error(`Design refine (pass ${round}) failed:`, err);
      break; // keep the best reviewed version
    }
  }

  if (best && best.score >= (review.finalScore ?? 0)) {
    current = { shared: best.shared, homeBody: best.homeBody };
  }
  return { shared: current.shared, homeBody: current.homeBody, review };
}

export async function generateSite(
  brief: Record<string, unknown>,
  opts: { images?: SiteImage[] | null; onStage?: (stage: string) => void | Promise<void> } = {},
): Promise<SiteResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { error: "ANTHROPIC_API_KEY is not set" };

  const images = opts.images ?? null;
  const stage = async (s: string) => {
    try {
      await opts.onStage?.(s);
    } catch {
      // progress reporting is best-effort
    }
  };
  const briefJson = JSON.stringify(brief, null, 2);
  const client = newClient();
  const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  // ── Phase 1: plan + shared design system ──
  let plan: Plan;
  try {
    const raw = await runText(
      client,
      planSystem(images),
      "Plan the multi-page website and design the shared CSS, header and footer for this business. Here is the onboarding brief as JSON:\n\n" +
        briefJson,
      20000,
      "high",
    );
    plan = JSON.parse(extractJson(raw)) as Plan;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("AI site planning failed:", msg);
    return { error: `AI site planning failed: ${msg}` };
  }

  if (
    !plan?.shared_css ||
    !plan.header_html ||
    !plan.footer_html ||
    !Array.isArray(plan.pages) ||
    plan.pages.length === 0
  ) {
    return { error: "AI plan was incomplete (missing design system or pages)." };
  }

  let shared: SharedDesign = {
    css: plan.shared_css,
    header: plan.header_html,
    footer: plan.footer_html,
    js: plan.shared_js ?? "",
  };

  // Normalise + de-duplicate slugs; guarantee exactly one home page.
  const seen = new Set<string>();
  const planPages = plan.pages.slice(0, MAX_PAGES);
  let homeAssigned = false;
  const normPages = planPages.map((p, i) => {
    const isHome = !homeAssigned && (p.is_home || i === 0);
    if (isHome) homeAssigned = true;
    let slug = isHome ? "home" : safeSlug(p.slug, `page-${i + 1}`);
    while (seen.has(slug)) slug = `${slug}-${i + 1}`;
    seen.add(slug);
    return { ...p, slug, is_home: isHome };
  });
  if (!homeAssigned && normPages[0]) normPages[0].is_home = true;

  // ── Phase 2: write each page's body (bounded concurrency) ──
  await stage(`Writing page content (${normPages.length} pages)`);
  const pageSys = pageSystem(shared, images);
  const bodies = await mapPool(normPages, PAGE_CONCURRENCY, async (p) => {
    const user =
      `Write the <main> body for this page.\n\n` +
      `PAGE:\n${JSON.stringify(
        { slug: p.slug, title: p.title, is_home: p.is_home, h1: p.h1, meta_description: p.meta_description, outline: p.outline },
        null,
        2,
      )}\n\nFULL CLIENT BRIEF (for facts and copy — never invent beyond it):\n${briefJson}`;

    let body = "";
    for (let attempt = 0; attempt < 2 && body.length < 80; attempt++) {
      try {
        body = stripFragment(await runText(client, pageSys, user, 14000, "medium"));
      } catch (err) {
        console.error(`Page "${p.slug}" generation attempt ${attempt + 1} failed:`, err);
      }
    }
    if (body.length < 80) {
      // Last-resort fallback so the page still exists and the nav stays intact.
      body = `<section class="section"><div class="container"><h1>${p.h1 || p.title}</h1><p>${p.meta_description || ""}</p></div></section>`;
    }
    return body;
  });

  // ── Phase 3: render → critique → refine (the loop that gives the build eyes) ──
  const homeIdx = Math.max(0, normPages.findIndex((p) => p.is_home));
  const reviewed = await designReviewLoop(
    client,
    shared,
    bodies[homeIdx],
    {
      businessName: plan.site_title || txt(brief.business_name) || "the business",
      designRationale: plan.design_rationale ?? "",
    },
    stage,
  );
  shared = reviewed.shared;
  bodies[homeIdx] = reviewed.homeBody;

  // ── Assemble every page with the final (reviewed) shared design ──
  const pages: SitePage[] = normPages.map((p, i) => ({
    slug: p.slug,
    title: p.title || plan.site_title,
    navLabel: p.nav_label || p.title || p.slug,
    isHome: p.is_home,
    metaDescription: p.meta_description || plan.tagline || "",
    html: assemblePage(shared, bodies[i]),
  }));

  return {
    pages,
    siteTitle: plan.site_title || "New site",
    tagline: plan.tagline || "",
    design: reviewed.review,
  };
}
