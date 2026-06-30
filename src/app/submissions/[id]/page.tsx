import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getViewer } from "@/lib/auth";
import { presignDownload } from "@/lib/r2";
import { buildSite } from "./actions";

export const dynamic = "force-dynamic";

// Friendly labels for the form field keys. Anything not listed falls back to
// a tidied-up version of the key itself.
const LABELS: Record<string, string> = {
  contact_name: "Your name",
  contact_filling_email: "Your email",
  business_name: "Business name",
  tagline: "Tagline",
  what_you_do: "What the business does",
  established: "Years established",
  primary_goal: "Goals for the site",
  brand_colours: "Brand colours",
  sample_designs: "Styles they like",
  sites_you_like: "Sites they like",
  sites_you_dislike: "Sites they dislike",
  style_leaning: "Style leaning",
  font_personality: "Font choice",
  pricing: "Pricing approach",
  pricing_detail: "Prices",
  reviews_choice: "Reviews approach",
  reviews_pasted: "Pasted reviews",
  google_business_name: "Google business name",
  google_rating: "Google rating",
  accreditations: "Accreditations",
  guarantees: "Guarantees",
  real_numbers: "Real numbers",
  about_story: "About / story",
  about_story_writeforme: "Write the story for them?",
  faqs_suggest: "Suggest FAQs?",
  areas_covered: "Areas covered",
  search_term: "Main search term",
  competitors: "Competitors",
  features: "Features wanted",
  phone: "Phone",
  public_email: "Public email",
  address: "Address",
  opening_hours: "Opening hours",
  whatsapp: "WhatsApp",
  socials: "Social links",
  enquiry_email: "Enquiries go to",
  domain: "Domain & hosting",
  deadline: "Deadline",
  avoid: "Things to avoid",
  anything_else: "Anything else",
};

function labelFor(key: string) {
  return LABELS[key] ?? key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

type Row = { a?: string; b?: string };

function renderValue(value: unknown) {
  if (value == null || value === "") return <span style={{ color: "#aaa" }}>—</span>;
  if (Array.isArray(value)) {
    // Repeatable rows ({a,b}) or a list of choices.
    if (value.length && typeof value[0] === "object") {
      return (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {(value as Row[]).map((r, i) => (
            <li key={i}>
              <strong>{r.a || "—"}</strong>
              {r.b ? ` — ${r.b}` : ""}
            </li>
          ))}
        </ul>
      );
    }
    return <>{(value as string[]).join(", ")}</>;
  }
  return <span style={{ whiteSpace: "pre-wrap" }}>{String(value)}</span>;
}

export default async function SubmissionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { isAdmin } = await getViewer();
  if (!isAdmin) redirect("/dashboard");

  const { id } = await params;
  const submission = await prisma.submission.findUnique({ where: { id } });
  if (!submission) notFound();

  const data = (submission.data ?? {}) as Record<string, unknown>;

  // Pull out uploaded files (stored under __files) and pre-sign download links.
  type StoredFile = { key: string; name: string; type?: string; size?: number };
  const filesByField = (data.__files ?? {}) as Record<string, StoredFile[]>;
  const fileGroups = await Promise.all(
    Object.entries(filesByField).map(async ([field, list]) => ({
      field,
      files: await Promise.all(
        (list ?? []).map(async (f) => ({ ...f, url: await presignDownload(f.key) })),
      ),
    })),
  );
  const hasFiles = fileGroups.some((g) => g.files.length > 0);

  // Everything except the file refs goes in the answers list.
  const entries = Object.entries(data).filter(([key]) => key !== "__files");

  const build = (submission.buildData ?? {}) as {
    wp_username?: string;
    wp_password?: string;
    error?: string;
  };

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px", fontFamily: "system-ui, sans-serif" }}>
      <a href="/submissions" style={{ color: "#0e7c7b", textDecoration: "none", fontSize: 14 }}>
        ← All briefs
      </a>
      <h1 style={{ fontSize: 26, margin: "12px 0 2px" }}>{submission.businessName ?? "Untitled brief"}</h1>
      <p style={{ color: "#777", marginTop: 0, fontSize: 14 }}>
        {submission.contactName ?? "—"} · {submission.contactEmail ?? "—"} · {submission.status} ·{" "}
        {submission.createdAt.toLocaleString("en-GB")}
      </p>

      {/* Site build (InstaWP) */}
      <section style={{ marginTop: 24, border: "1px solid #e8e8e8", borderRadius: 12, padding: 20 }}>
        <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>Site build</h2>

        {submission.buildStatus === "ready" && submission.buildSiteUrl ? (
          <div style={{ marginBottom: 14, fontSize: 14 }}>
            <p style={{ color: "#137e6d", fontWeight: 600, margin: "0 0 8px" }}>
              ✓ Site provisioned{submission.builtAt ? ` — ${submission.builtAt.toLocaleString("en-GB")}` : ""}
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 8 }}>
              <a href={submission.buildSiteUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#0e7c7b", fontWeight: 600 }}>
                Open site →
              </a>
              <a href={`${submission.buildSiteUrl.replace(/\/$/, "")}/wp-admin`} target="_blank" rel="noopener noreferrer" style={{ color: "#0e7c7b", fontWeight: 600 }}>
                WP admin →
              </a>
            </div>
            {(build.wp_username || build.wp_password) && (
              <p style={{ color: "#666", margin: 0, fontFamily: "monospace", fontSize: 13 }}>
                {build.wp_username} / {build.wp_password}
              </p>
            )}
          </div>
        ) : submission.buildStatus === "error" ? (
          <p style={{ color: "#c0392b", fontSize: 14, margin: "0 0 12px" }}>
            Build failed: {build.error ?? "unknown error"}. Check the template slug and try again.
          </p>
        ) : null}

        <form action={buildSite}>
          <input type="hidden" name="id" value={submission.id} />
          <button
            type="submit"
            style={{ background: "#0e7c7b", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 600, cursor: "pointer" }}
          >
            {submission.buildStatus === "ready" ? "Rebuild site" : "Build site"}
          </button>
        </form>
        <p style={{ color: "#aaa", fontSize: 12, margin: "8px 0 0" }}>
          Spins up a fresh WordPress site for this client. Image generation and content population
          come next.
        </p>
      </section>

      {hasFiles && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, margin: "0 0 10px" }}>Uploaded files</h2>
          {fileGroups.map((g) =>
            g.files.length === 0 ? null : (
              <div key={g.field} style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".05em", color: "#999", margin: "0 0 6px" }}>
                  {labelFor(g.field)}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                  {g.files.map((f) => (
                    <a
                      key={f.key}
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: "block", border: "1px solid #eee", borderRadius: 8, padding: 8, textDecoration: "none", color: "#0e7c7b", fontSize: 13, maxWidth: 160 }}
                    >
                      {f.type?.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.url} alt={f.name} style={{ width: 140, height: 100, objectFit: "cover", borderRadius: 4, display: "block", marginBottom: 6 }} />
                      ) : null}
                      <span style={{ wordBreak: "break-word" }}>{f.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            ),
          )}
        </section>
      )}

      <dl style={{ marginTop: 28 }}>
        {entries.map(([key, value]) => (
          <div key={key} style={{ padding: "12px 0", borderBottom: "1px solid #f0f0f0" }}>
            <dt style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: ".05em", color: "#999" }}>
              {labelFor(key)}
            </dt>
            <dd style={{ margin: "4px 0 0", fontSize: 15, color: "#222" }}>{renderValue(value)}</dd>
          </div>
        ))}
      </dl>
    </main>
  );
}
