import { higgsfield, config } from "@higgsfield/client/v2";

// Generates a hero image for a site from the brief, via Higgsfield. Returns the
// image URL, or null if Higgsfield isn't configured or generation fails — the
// image is an enhancement, so a failure must NOT break the build.

const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");

type JobSet = { isCompleted?: boolean; jobs?: Array<{ results?: { raw?: { url?: string } } }> };

export async function generateHeroImage(brief: Record<string, unknown>): Promise<string | null> {
  const id = process.env.HIGGSFIELD_API_KEY;
  const secret = process.env.HIGGSFIELD_SECRET;
  if (!id || !secret) return null;

  try {
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
    const gen = higgsfield.subscribe("flux-pro/kontext/max/text-to-image", {
      input: {
        aspect_ratio: "16:9",
        prompt,
        safety_tolerance: 2,
        seed: Math.floor(Math.random() * 1_000_000),
      },
      withPolling: true,
    });

    const jobSet = (await Promise.race([gen, timeout])) as unknown as JobSet | null;
    if (jobSet?.isCompleted) {
      const url = jobSet.jobs?.[0]?.results?.raw?.url;
      return url ?? null;
    }
    return null;
  } catch (err) {
    console.error("Higgsfield image generation failed:", err);
    return null;
  }
}
