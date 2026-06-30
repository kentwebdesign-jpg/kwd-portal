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

export async function createSiteFromTemplate(opts: {
  templateSlug: string;
  siteName?: string;
  isShared?: boolean;
}): Promise<InstaWpSite> {
  const token = process.env.INSTAWP_API_TOKEN;
  if (!token) throw new Error("INSTAWP_API_TOKEN is not set.");

  const res = await fetch(`${INSTAWP_BASE}/sites/template`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      template_slug: opts.templateSlug,
      site_name: opts.siteName,
      is_reserved: true,
      ...(opts.isShared ? { is_shared: true } : {}),
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.status === false) {
    throw new Error(json?.message || `InstaWP error (HTTP ${res.status})`);
  }

  // InstaWP wraps the payload in { status, message, data: {...} }.
  return (json.data ?? json) as InstaWpSite;
}
