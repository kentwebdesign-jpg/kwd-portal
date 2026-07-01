import { HiggsfieldClient, SoulSize, SoulQuality, BatchSize } from "@higgsfield/client";

// Generates a small set of bespoke images for a site from the brief, via
// Higgsfield's Soul text-to-image model (documented v1 client.generate() path,
// which wraps the body in { params } as the API requires). Returns hosted image
// URLs with a short label saying what each depicts, so the design can place
// them across the site (hero, service cards, about, section backgrounds).
//
// Images are an enhancement: any that fail are simply dropped, and if none
// succeed the build proceeds image-free. Generation runs in parallel so the
// whole set costs roughly the wall-time of a single image.

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

const BASE_STYLE =
  "Modern, clean, professional, cinematic lighting. No text, no words, no letters, no logos, no watermarks.";

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

  const business = txt(brief.business_name) || "a local business";
  const what = txt(brief.what_you_do);
  const style = txt(brief.style_leaning);
  const styleBit = style ? `Visual style: ${style}. ` : "";
  const whatBit = what ? `, which does: ${what}` : "";

  // Build a small, varied set of prompts: a wide hero + up to 3 supporting
  // images. Supporting images track the client's services when listed;
  // otherwise fall back to generic professional scenes.
  const specs: { label: string; prompt: string; size: string }[] = [
    {
      label: "hero",
      size: SoulSize.LANDSCAPE_2048x1152,
      prompt: `Wide hero background image for the website of ${business}${whatBit}. ${styleBit}${BASE_STYLE}`,
    },
  ];

  const services = rows(brief.services)
    .map((r) => txt(r.a))
    .filter(Boolean)
    .slice(0, 3);

  if (services.length) {
    for (const s of services) {
      specs.push({
        label: s,
        size: SoulSize.SQUARE_1536x1536,
        prompt: `Image representing the service "${s}" offered by ${business}. ${styleBit}${BASE_STYLE}`,
      });
    }
  } else {
    specs.push({
      label: "team",
      size: SoulSize.SQUARE_1536x1536,
      prompt: `Image representing the people behind ${business} at work. ${styleBit}${BASE_STYLE}`,
    });
    specs.push({
      label: "quality",
      size: SoulSize.SQUARE_1536x1536,
      prompt: `Close-up detail image conveying the quality of work of ${business}${what ? ` (${what})` : ""}. ${styleBit}${BASE_STYLE}`,
    });
    specs.push({
      label: "context",
      size: SoulSize.LANDSCAPE_2048x1152,
      prompt: `Contextual scene for the website of ${business}${whatBit}. ${styleBit}${BASE_STYLE}`,
    });
  }

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

    const images = settled.filter((r): r is SiteImage => !!r.url);
    if (!images.length) return { images: [], error: firstError ?? "no images generated" };
    return { images, error: null };
  } catch (err) {
    const name = err instanceof Error ? err.constructor.name : "Error";
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Higgsfield image generation failed:", name, msg);
    return { images: [], error: `${name}: ${msg}` };
  }
}
