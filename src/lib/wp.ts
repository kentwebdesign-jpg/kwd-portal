// Minimal WordPress REST client using Basic Auth (admin user + application
// password). Used to create pages and set options on a provisioned site.

type Json = Record<string, unknown>;

export function wpClient(siteUrl: string, user: string, appPassword: string) {
  const base = siteUrl.replace(/\/$/, "");
  const auth = "Basic " + Buffer.from(`${user}:${appPassword}`).toString("base64");

  async function req(method: string, path: string, body?: unknown): Promise<Json> {
    const res = await fetch(`${base}/wp-json${path}`, {
      method,
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as Json;
    if (!res.ok) {
      throw new Error((json.message as string) || `WP REST ${method} ${path} failed (HTTP ${res.status})`);
    }
    return json;
  }

  return {
    // `excerpt` becomes the page's meta description (the canvas theme emits it
    // in <head>). Returns the created page incl. `id` and `link` (its URL).
    createPage: (p: { title: string; content: string; slug?: string; status?: string; excerpt?: string }) =>
      req("POST", "/wp/v2/pages", { status: "publish", ...p }),
    updateSettings: (s: Json) => req("POST", "/wp/v2/settings", s),
  };
}
