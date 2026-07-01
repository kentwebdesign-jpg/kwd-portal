import { HiggsfieldClient, SoulSize, SoulQuality, BatchSize } from "@higgsfield/client";

// Generates a hero image for a site from the brief, via Higgsfield's Soul
// text-to-image model. Uses the documented v1 client.generate() path, which
// wraps the request body in { params } as the API requires (the v2 subscribe()
// posts it flat and the endpoint rejects that with "body.params: Field
// required"). Returns { url } on success, or { url: null, error } so the caller
// can surface WHY it failed — the image is an enhancement, so a failure must
// NOT break the build.

const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// The Soul JobSet result shape (see @higgsfield/client models/JobSet + types).
type JobSetLike = {
  isCompleted?: boolean;
  isNsfw?: boolean;
  jobs?: Array<{ results?: { raw?: { url?: string } } | null }>;
};

export type HeroImageResult = { url: string | null; error: string | null };

export async function generateHeroImage(brief: Record<string, unknown>): Promise<HeroImageResult> {
  const id = process.env.HIGGSFIELD_API_KEY;
  const secret = process.env.HIGGSFIELD_SECRET;
  if (!id || !secret) return { url: null, error: "HIGGSFIELD_API_KEY / HIGGSFIELD_SECRET not set" };

  try {
    const client = new HiggsfieldClient({ apiKey: id, apiSecret: secret });

    const business = txt(brief.business_name);
    const what = txt(brief.what_you_do);
    const style = txt(brief.style_leaning);
    const prompt =
      `Professional, high-quality hero background image for the website of ` +
      `${business || "a local business"}${what ? `, which does: ${what}` : ""}. ` +
      `${style ? `Visual style: ${style}. ` : ""}` +
      `Modern, clean, cinematic lighting. No text, no words, no letters, no logos, no watermarks.`;

    // Cap the wait so a slow generation can't hang the whole build.
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 150_000));
    const gen = client.generate(
      "/v1/text2image/soul",
      {
        prompt,
        width_and_height: SoulSize.LANDSCAPE_2048x1152, // 16:9, good for a hero
        quality: SoulQuality.HD,
        batch_size: BatchSize.SINGLE,
      },
      { withPolling: true },
    );

    const jobSet = (await Promise.race([gen, timeout])) as JobSetLike | null;
    if (!jobSet) return { url: null, error: "timeout after 150s" };
    if (jobSet.isNsfw) return { url: null, error: "image was flagged NSFW" };
    if (jobSet.isCompleted) {
      const url = jobSet.jobs?.[0]?.results?.raw?.url;
      if (url) return { url, error: null };
      return { url: null, error: "completed but no image URL returned" };
    }
    return { url: null, error: "generation did not complete" };
  } catch (err) {
    const name = err instanceof Error ? err.constructor.name : "Error";
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Higgsfield image generation failed:", name, msg);
    return { url: null, error: `${name}: ${msg}` };
  }
}
