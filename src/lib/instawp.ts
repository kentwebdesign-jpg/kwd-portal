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

// Provision a fresh WordPress site. A plain create returns a pooled site that
// is ready instantly with login credentials filled (named/reserved sites
// provision asynchronously and return empty credentials, which the pipeline
// can't use). The business name becomes the site title later, via REST.
export async function createSite(): Promise<InstaWpSite> {
  const headers = instaHeaders();

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${INSTAWP_BASE}/sites`, {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.status === false) {
      throw new Error(json?.message || `InstaWP error (HTTP ${res.status})`);
    }

    const site = (json.data ?? json) as InstaWpSite;
    // A ready pooled site has credentials; an async one comes back empty.
    if (site.wp_username && site.wp_password) return site;

    // Discard the still-provisioning site and try for a ready one.
    if (site.id) {
      await fetch(`${INSTAWP_BASE}/sites/${site.id}`, { method: "DELETE", headers }).catch(() => {});
    }
  }

  throw new Error("InstaWP only returned sites still provisioning (no credentials). Try again shortly.");
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
