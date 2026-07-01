import { higgsfield, config } from "@higgsfield/client/v2";

// Generates a hero image for a site from the brief, via Higgsfield's v2 API
// (Soul text-to-image). Returns { url } on success, or { url: null, error } so
// the caller can surface WHY it failed — the image is an enhancement, so a
// failure must NOT break the build.

const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// The v2 subscribe() resolves to this shape (see @higgsfield/client v2 types).
type V2Response = { status: string; images?: { url?: string }[] };

export type HeroImageResult = { url: string | null; error: string | null };

export async function generateHeroImage(brief: Record<string, unknown>): Promise<HeroImageResult> {
  const id = process.env.HIGGSFIELD_API_KEY;
  const secret = process.env.HIGGSFIELD_SECRET;
  if (!id || !secret) return { url: null, error: "HIGGSFIELD_API_KEY / HIGGSFIELD_SECRET not set" };

  try {
    // v2 credentials format is a single "KEY_ID:KEY_SECRET" string.
    config({ credentials: `${id}:${secret}` });

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
    const gen = higgsfield.subscribe("/v1/text2image/soul", {
      input: {
        prompt,
        width_and_height: "1696x960", // widest supported landscape (~16:9), good for a hero
        quality: "1080p",
        batch_size: 1,
        enhance_prompt: true,
        seed: Math.floor(Math.random() * 1_000_000),
      },
      withPolling: true,
    });

    const res = (await Promise.race([gen, timeout])) as V2Response | null;
    if (res && res.status === "completed") {
      const url = res.images?.[0]?.url;
      if (url) return { url, error: null };
      return { url: null, error: "completed but no image URL returned" };
    }
    const status = res?.status ?? "timeout after 150s";
    console.error("Higgsfield returned no completed image:", status);
    return { url: null, error: `no image (${status})` };
  } catch (err) {
    const name = err instanceof Error ? err.constructor.name : "Error";
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Higgsfield image generation failed:", name, msg);
    return { url: null, error: `${name}: ${msg}` };
  }
}
