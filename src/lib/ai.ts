import Anthropic from "@anthropic-ai/sdk";

// Turns an onboarding brief into a complete, polished, self-contained one-page
// website design (HTML + inline CSS) using Claude. Returns null if no API key
// is set or the call fails, so the build can fall back to the basic theme.

const SYSTEM = `You are a world-class web designer and front-end developer creating a
complete, finished marketing website for a small business, on behalf of Kent Web Design
(a web design agency in Kent, UK).

From the client's onboarding brief, produce ONE polished, modern, responsive single-page
website as a self-contained HTML fragment.

OUTPUT FORMAT (critical):
- Output ONLY HTML. No markdown, no code fences, no commentary before or after.
- Begin with a single <style>...</style> block containing ALL the CSS, then the page markup.
- Do NOT include <!DOCTYPE>, <html>, <head>, or <body> tags. Your output is injected into the page body.
- No JavaScript and no <script> tags. CSS only.
- Do NOT use <img> tags pointing at photo URLs (there are no photo assets yet). Create visual
  richness with CSS: gradients, colour, shapes, large type, generous spacing, and inline SVG for
  icons. If a logo URL is in the brief you may use it; otherwise style the business name as a wordmark.

DESIGN BAR:
- It must look like a real, professionally designed agency website. Beautiful and finished, not a
  template or a wireframe.
- Modern layout: a sticky header with the business name, anchor navigation, and a primary
  call-to-action; a striking hero; clearly separated sections; a strong footer.
- Cohesive visual identity: choose a tasteful colour palette. Use the brief's brand colours if
  provided; otherwise pick colours suited to the business type and the requested style. Pair good
  Google Fonts (via @import in the <style>) - a characterful display face for headings and a clean
  face for body text.
- Responsive and mobile-first (flexbox/grid, media queries). Generous whitespace, a clear type
  scale, strong visual hierarchy, accessible contrast, tasteful hover states and subtle transitions.

CONTENT:
- Populate every section with real, specific copy from the brief: business name, what they do,
  a services section (a card or grid item per service), their story/about, trust signals (reviews,
  accreditations, guarantees, real numbers) only if genuinely provided, and a contact section.
- Contact: use tel: and mailto: links and show the phone, email, address, opening hours and areas
  covered that the brief provides. Do NOT build a form (there is no backend to receive it).
- Voice: plain English, short sentences, lead with the outcome for the customer, first person "we",
  British spelling, no jargon, no em dashes or en dashes. Never invent facts (prices, awards, client
  names, statistics) - only use what the brief gives you.

Build the best site you can for this specific business.`;

export async function generateSiteDesign(brief: Record<string, unknown>): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const client = new Anthropic();
    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      output_config: { effort: "medium" }, // design quality vs build time
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content:
            "Design a complete one-page website for this business. Here is the onboarding brief as JSON:\n\n" +
            JSON.stringify(brief, null, 2),
        },
      ],
    });

    const message = await stream.finalMessage();
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Strip any accidental markdown code fences.
    let html = text.trim();
    html = html.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();

    if (html.length < 200) return null; // implausibly short — treat as failure
    return html;
  } catch (err) {
    console.error("AI design generation failed, falling back to basic theme:", err);
    return null;
  }
}
