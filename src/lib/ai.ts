import Anthropic from "@anthropic-ai/sdk";

// Turns a raw onboarding brief into professional, ready-to-use website copy
// using Claude. Returns null if no API key is set or the call fails, so the
// build pipeline can fall back to plain brief text.

export type SiteContent = {
  siteTitle: string;
  tagline: string;
  heroHeading: string;
  heroSubtext: string;
  homeIntro: string;
  ctaLabel: string;
  services: { name: string; description: string }[];
  aboutParagraphs: string[];
  contactIntro: string;
  metaDescription: string;
};

// Kent Web Design house voice (from the brand guidelines).
const SYSTEM = `You are a senior web copywriter at Kent Web Design, a local web design
agency serving small businesses across Kent, England.

Write professional, ready-to-publish website copy from the client's onboarding brief.

Voice rules (follow exactly):
- Plain English, short sentences, no jargon or buzzwords.
- Lead with the outcome for the business owner, not features.
- First person plural ("we") when speaking as the business.
- No em dashes or en dashes. Use commas, full stops, or rewrite.
- British spelling. Local and human in tone.
- Never invent facts (prices, awards, client names, statistics). Only use what the brief gives you.
- If a detail is missing, write naturally around it rather than guessing.

Produce copy for a Home, About, Services and Contact page. Keep the hero punchy,
the intro warm, service descriptions one or two sentences each, and the about
section genuine. Return only the structured object.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    siteTitle: { type: "string" },
    tagline: { type: "string" },
    heroHeading: { type: "string" },
    heroSubtext: { type: "string" },
    homeIntro: { type: "string" },
    ctaLabel: { type: "string" },
    services: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["name", "description"],
      },
    },
    aboutParagraphs: { type: "array", items: { type: "string" } },
    contactIntro: { type: "string" },
    metaDescription: { type: "string" },
  },
  required: [
    "siteTitle",
    "tagline",
    "heroHeading",
    "heroSubtext",
    "homeIntro",
    "ctaLabel",
    "services",
    "aboutParagraphs",
    "contactIntro",
    "metaDescription",
  ],
} as const;

export async function generateSiteContent(brief: Record<string, unknown>): Promise<SiteContent | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      system: SYSTEM,
      output_config: {
        effort: "low", // copywriting — keep the build fast; raise later if needed
        format: { type: "json_schema", schema: SCHEMA },
      },
      messages: [
        {
          role: "user",
          content:
            "Here is the client's onboarding brief as JSON. Write the website copy.\n\n" +
            JSON.stringify(brief, null, 2),
        },
      ],
    });

    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return null;
    return JSON.parse(text.text) as SiteContent;
  } catch (err) {
    console.error("AI content generation failed, falling back to brief text:", err);
    return null;
  }
}
