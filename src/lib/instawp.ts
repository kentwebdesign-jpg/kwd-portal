// InstaWP API — provision a WordPress site from a template.
// Docs: https://docs.instawp.com/en/article/create-a-site-via-api-fq00b5/

const INSTAWP_BASE = "https://app.instawp.io/api/v2";

export type InstaWpSite = {
  wp_url?: string;
  wp_username?: string;
  wp_password?: string;
  task_id?: number | string;
  is_pool?: boolean;
};

// Provision a fresh WordPress site (no template needed — InstaWP serves one
// from its pool, ready in seconds).
export async function createSite(opts: { siteName?: string }): Promise<InstaWpSite> {
  const token = process.env.INSTAWP_API_TOKEN;
  if (!token) throw new Error("INSTAWP_API_TOKEN is not set.");

  // InstaWP only allows a-z A-Z 0-9 and - in the site name.
  const safeName = (opts.siteName ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  const res = await fetch(`${INSTAWP_BASE}/sites`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      ...(safeName ? { site_name: safeName } : {}),
      is_reserved: true,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.status === false) {
    throw new Error(json?.message || `InstaWP error (HTTP ${res.status})`);
  }

  // InstaWP wraps the payload in { status, message, data: {...} }.
  return (json.data ?? json) as InstaWpSite;
}
