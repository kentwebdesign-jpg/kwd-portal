// InstaWP API — provision a WordPress site from a template.
// Docs: https://docs.instawp.com/en/article/create-a-site-via-api-fq00b5/

const INSTAWP_BASE = "https://app.instawp.io/api/v2";

export type InstaWpSite = {
  id?: number | string;
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

  // InstaWP only allows a-z A-Z 0-9 and - in the site name, and subdomains must
  // be globally unique — so append a short random suffix.
  const base = (opts.siteName ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const suffix = Math.random().toString(36).slice(2, 6);
  const safeName = base ? `${base}-${suffix}` : "";

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

function instaHeaders() {
  const token = process.env.INSTAWP_API_TOKEN;
  if (!token) throw new Error("INSTAWP_API_TOKEN is not set.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

// Run a shell/WP-CLI command on a site via InstaWP's two-step command API
// (create command -> execute on site -> clean up). Returns the raw output.
export async function runWpCli(siteId: number | string, command: string): Promise<string> {
  const headers = instaHeaders();

  const cRes = await fetch(`${INSTAWP_BASE}/commands`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "kwd-pipeline", command }),
  });
  const cJson = await cRes.json().catch(() => ({}));
  const commandId = cJson?.data?.id;
  if (!commandId) throw new Error(cJson?.message || "Failed to create command.");

  try {
    const eRes = await fetch(`${INSTAWP_BASE}/sites/${siteId}/execute-command`, {
      method: "POST",
      headers,
      body: JSON.stringify({ command_id: commandId }),
    });
    const eJson = await eRes.json().catch(() => ({}));
    if (!eRes.ok || eJson?.status === false) {
      throw new Error(eJson?.message || `Command failed (HTTP ${eRes.status})`);
    }
    return String(eJson?.data ?? "");
  } finally {
    await fetch(`${INSTAWP_BASE}/commands/${commandId}`, { method: "DELETE", headers }).catch(() => {});
  }
}

// InstaWP prefixes command output with a "<timestamp> <command>" line; the
// real result is the last non-empty line.
export function lastLine(output: string): string {
  const lines = output.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines[lines.length - 1] ?? "";
}
