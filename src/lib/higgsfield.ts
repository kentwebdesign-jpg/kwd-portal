import { HiggsfieldClient, SoulSize, SoulQuality, BatchSize } from "@higgsfield/client";
import Anthropic from "@anthropic-ai/sdk";

// Generates a small set of bespoke images for a site from the brief, via
// Higgsfield's Soul text-to-image model (documented v1 client.generate() path,
// which wraps the body in { params } as the API requires). Returns hosted image
// URLs with a short label saying what each depicts, so the design can place
// them across the site (hero, service cards, about, section backgrounds).
//
// Two hard-won lessons are baked in here:
// 1. SCENE PROMPTS, NEVER "WEBSITE" PROMPTS. Asking for "a hero background
//    image for the website of X" makes the image model literally draw a
//    website — a white page full of garbled pseudo-text (the Grieve & Wifes
//    hero disaster). So Claude first turns the brief into concrete
//    photographic SCENE descriptions (a person, a place, an object — never
//    the concept "website"), and only those go to the image model.
// 2. EVERY IMAGE IS VISION-SCREENED BEFORE USE. Whatever the model returns is
//    checked by a vision pass for text/lettering/garbling/page-mockup looks
//    and for basic believability. Failures are dropped, fail-closed: a
//    missing image costs a little richness; a garbled one ruins the site.
//
// Images are an enhancement: any that fail are simply dropped, and if none
// succeed the build proceeds image-free.

const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");

type Row = { a?: string; b?: string };
function rows(v: unknown): Row[] {
  return Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Row[]) : [];
}

// The Soul JobSet result shape (see @higgsfield/client models/JobSet + types).
type JobSetLike = {
  isCompleted?: boolean;
  isNsfw?: boolean;
  jobs?: Array<{ results?: { raw?: { url?: string } } | null }>;
};

export type SiteImage = { url: string; label: string };
export type SiteImagesResult = { images: SiteImage[]; error: string | null };

const MODEL = "claude-opus-4-8";

const BASE_STYLE =
  "Photorealistic photograph, natural lighting, real-world documentary style, believable for a UK local business. " +
  "Clean uncluttered composition with clear empty space for a text overlay. " +
  "ABSOLUTELY NO text, letters, words, numbers, captions, signage, logos, watermarks, labels or lettering of any kind anywhere in the image. " +
  "No storefront signs, no billboards, no branded vehicles, no printed materials, no screens showing content. " +
  "If a surface would normally carry text, leave it blank.";

type Spec = { label: string; prompt: string; size: string };

// ── Scene writing ───────────────────────────────────────────────────────────
// Ask Claude for concrete photographic scenes derived from the trade/brief.
// The word "website" must never reach the image model.
async function writeScenes(
  brief: Record<string, unknown>,
  labels: { label: string; kind: "hero" | "service" | "supporting" }[],
): Promise<Map<string, string> | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic({ timeout: 60_000, maxRetries: 1 });
    const business = txt(brief.business_name) || "a local business";
    const what = txt(brief.what_you_do);
    const req = labels
      .map(
        (l) =>
          `- "${l.label}" (${l.kind === "hero" ? "wide cinematic establishing scene" : l.kind === "service" ? `scene depicting this service: ${l.label}` : "supporting scene"})`,
      )
      .join("\n");
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 1500,
      output_config: { effort: "low" },
      system:
        `You write photographic scene descriptions for a text-to-image model, for imagery used by a UK trade/local-service business. ` +
        `Each scene must be a CONCRETE real-world photograph description: a person working, a tool in use, a finished job, a location. ` +
        `HARD RULES: never mention websites, pages, screens, documents, posters, signs, logos or any readable text — describe physical scenes only. ` +
        `No brand names. UK setting. One or two sentences each, specific and visual (subject, setting, lighting, camera angle). ` +
        `Respond with ONLY a JSON object mapping each requested label EXACTLY as given to its scene description.`,
      messages: [
        {
          role: "user",
          content: `Business: ${business}\nWhat they do: ${what || "(not stated)"}\n\nWrite one scene for each label:\n${req}`,
        },
      ],
    });
    const message = await stream.finalMessage();
    const raw = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    let t = raw.trim().replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
    const first = t.indexOf("{");
    const last = t.lastIndexOf("}");
    if (first >= 0 && last > first) t = t.slice(first, last + 1);
    const obj = JSON.parse(t) as Record<string, unknown>;
    const map = new Map<string, string>();
    for (const l of labels) {
      const v = obj[l.label];
      if (typeof v === "string" && v.trim()) map.set(l.label, v.trim());
    }
    return map.size ? map : null;
  } catch (err) {
    console.error("Scene writing failed (falling back to templates):", err);
    return null;
  }
}

// Static fallbacks if the scene-writer is unavailable. Scene-flavoured and
// "website"-free — worse than bespoke scenes, far safer than the old wording.
function fallbackScene(kind: "hero" | "service" | "supporting", label: string, what: string): string {
  if (kind === "hero")
    return `Wide cinematic photograph of skilled tradespeople at work in a real UK setting, related to: ${what || "a professional local trade"}. Shot from a distance, shallow depth of field.`;
  if (kind === "service")
    return `Close-up photograph of hands-on professional work in progress related to: ${label}. Real tools, real materials, UK setting.`;
  return `Environmental photograph of a clean, professional UK work setting related to: ${what || "a local trade business"}.`;
}

// ── Vision screening ────────────────────────────────────────────────────────
// Look at the actual generated image and reject anything with text/garbling or
// a screenshot/document/mockup look. Fail-closed: any screening failure drops
// the image — a missing photo is recoverable, a garbled one is not.
async function screenImage(url: string, label: string): Promise<{ pass: boolean; reason: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { pass: false, reason: "no API key for screening" };
  try {
    const client = new Anthropic({ timeout: 60_000, maxRetries: 1 });
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 300,
      output_config: { effort: "low" },
      system:
        `You are QA for imagery on a professional local-business website. REJECT the image if ANY of these are true: ` +
        `(1) it contains text, letters, words, numbers, signage, logos or lettering of any kind — including blurry, garbled or AI-mangled pseudo-text; ` +
        `(2) it looks like a website, app, screenshot, document, poster, flyer or any kind of page/mockup rather than a photograph of the real world; ` +
        `(3) it has obvious AI artefacts (mangled hands/faces/objects) or looks cheap/fake rather than a believable professional photograph. ` +
        `Respond with ONLY JSON: {"pass": boolean, "reason": string}.`,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `Image intended as "${label}" for the site:` },
            { type: "image", source: { type: "url", url } },
            { type: "text", text: "Screen it and output the JSON." },
          ],
        },
      ],
    });
    const message = await stream.finalMessage();
    const raw = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    let t = raw.trim().replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
    const first = t.indexOf("{");
    const last = t.lastIndexOf("}");
    if (first >= 0 && last > first) t = t.slice(first, last + 1);
    const j = JSON.parse(t) as { pass?: unknown; reason?: unknown };
    return { pass: j.pass === true, reason: typeof j.reason === "string" ? j.reason : "" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { pass: false, reason: `screening failed (${msg})` };
  }
}

// Generate a single image and return its URL (or throw so the caller can note
// the reason). Capped so one slow generation can't hang the whole build.
async function generateOne(client: HiggsfieldClient, prompt: string, size: string): Promise<string | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 150_000));
  const gen = client.generate(
    "/v1/text2image/soul",
    { prompt, width_and_height: size, quality: SoulQuality.HD, batch_size: BatchSize.SINGLE },
    { withPolling: true },
  );
  const jobSet = (await Promise.race([gen, timeout])) as JobSetLike | null;
  if (!jobSet) throw new Error("timeout after 150s");
  if (jobSet.isNsfw) throw new Error("image flagged NSFW");
  if (!jobSet.isCompleted) throw new Error("generation did not complete");
  const url = jobSet.jobs?.[0]?.results?.raw?.url;
  if (!url) throw new Error("completed but no image URL");
  return url;
}

export async function generateSiteImages(brief: Record<string, unknown>): Promise<SiteImagesResult> {
  const id = process.env.HIGGSFIELD_API_KEY;
  const secret = process.env.HIGGSFIELD_SECRET;
  if (!id || !secret) return { images: [], error: "HIGGSFIELD_API_KEY / HIGGSFIELD_SECRET not set" };

  const what = txt(brief.what_you_do);

  // Decide the set: a wide hero + up to 3 service scenes (or generic
  // supporting scenes when no services are listed).
  const services = rows(brief.services)
    .map((r) => txt(r.a))
    .filter(Boolean)
    .slice(0, 3);
  const wanted: { label: string; kind: "hero" | "service" | "supporting"; size: string }[] = [
    { label: "hero", kind: "hero", size: SoulSize.LANDSCAPE_2048x1152 },
    ...(services.length
      ? services.map((s) => ({ label: s, kind: "service" as const, size: SoulSize.SQUARE_1536x1536 }))
      : [
          { label: "team", kind: "supporting" as const, size: SoulSize.SQUARE_1536x1536 },
          { label: "quality", kind: "supporting" as const, size: SoulSize.SQUARE_1536x1536 },
          { label: "context", kind: "supporting" as const, size: SoulSize.LANDSCAPE_2048x1152 },
        ]),
  ];

  // 1. Turn the brief into concrete photographic scenes.
  const scenes = await writeScenes(brief, wanted);
  const specs: Spec[] = wanted.map((w) => ({
    label: w.label,
    size: w.size,
    prompt: `${scenes?.get(w.label) ?? fallbackScene(w.kind, w.label, what)} ${BASE_STYLE}`,
  }));

  try {
    const client = new HiggsfieldClient({ apiKey: id, apiSecret: secret });
    let firstError: string | null = null;
    const settled = await Promise.all(
      specs.map((spec) =>
        generateOne(client, spec.prompt, spec.size)
          .then((url) => ({ label: spec.label, url }))
          .catch((err: unknown) => {
            const name = err instanceof Error ? err.constructor.name : "Error";
            const msg = err instanceof Error ? err.message : String(err);
            if (!firstError) firstError = `${name}: ${msg}`;
            console.error(`Higgsfield image "${spec.label}" failed:`, name, msg);
            return { label: spec.label, url: null as string | null };
          }),
      ),
    );
    const generated = settled.filter((r): r is SiteImage => !!r.url);

    // 2. Vision-screen every generated image; drop failures (fail-closed).
    const screened = await Promise.all(
      generated.map(async (img) => {
        const verdict = await screenImage(img.url, img.label);
        if (!verdict.pass) {
          console.error(`Image "${img.label}" REJECTED by vision screen: ${verdict.reason}`);
          if (!firstError) firstError = `image "${img.label}" rejected: ${verdict.reason}`;
        }
        return verdict.pass ? img : null;
      }),
    );
    const images = screened.filter((i): i is SiteImage => i !== null);

    if (!images.length) return { images: [], error: firstError ?? "no images generated" };
    return { images, error: null };
  } catch (err) {
    const name = err instanceof Error ? err.constructor.name : "Error";
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Higgsfield image generation failed:", name, msg);
    return { images: [], error: `${name}: ${msg}` };
  }
}
