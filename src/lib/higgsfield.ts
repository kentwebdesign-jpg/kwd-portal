import { higgsfield, config } from "@higgsfield/client/v2";

// Generates a hero image for a site from the brief, via Higgsfield's v2 API
// (Soul text-to-image). Returns the image URL, or null if Higgsfield isn't
// configured or generation fails — the image is an enhancement, so a failure
// must NOT break the build.

const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// The v2 subscribe() resolves to this shape (see @higgsfield/client v2 types).
type V2Response = { status: string; images?: { url?: string }[] };

export async function generateHeroImage(brief: Record<string, unknown>): Promise<string | null> {
  const id = process.env.HIGGSFIELD_API_KEY;
  const secret = process.env.HIGGSFIELD_SECRET;
  if (!id || !secret) return null;

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
      return url ?? null;
    }
    console.error("Higgsfield returned no completed image:", res?.status ?? "timeout");
    return null;
  } catch (err) {
    console.error("Higgsfield image generation failed:", err);
    return null;
  }
}
