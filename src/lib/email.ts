// Sends admin notifications via Mailgun's HTTP API. No-op (logs only) if Mailgun
// isn't configured, so builds never fail just because email isn't set up.

export async function sendAdminEmail(opts: { subject: string; text: string }): Promise<void> {
  const key = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (!key || !domain) {
    console.log("Email skipped (Mailgun not configured):", opts.subject);
    return;
  }

  const to = process.env.NOTIFY_EMAIL || "hello@kentwebdesign.com";
  const from = process.env.MAILGUN_FROM || `Kent Web Design Portal <noreply@${domain}>`;
  // Mailgun EU region by default (override with MAILGUN_BASE for US).
  const base = process.env.MAILGUN_BASE || "https://api.eu.mailgun.net";

  const body = new URLSearchParams({ from, to, subject: opts.subject, text: opts.text });

  try {
    const res = await fetch(`${base}/v3/${domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`api:${key}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      console.error("Mailgun send failed:", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("Mailgun error:", err);
  }
}
