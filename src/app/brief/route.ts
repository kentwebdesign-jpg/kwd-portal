import { auth } from "@clerk/nextjs/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

// Serves the onboarding form HTML, but only to a signed-in user. The form's
// assets (css/js/images) live in /public/brief and stay public; only this
// page (and the saved data) is gated. Middleware also guards /brief.
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return new Response(null, { status: 307, headers: { Location: "/" } });
  }

  const html = await readFile(path.join(process.cwd(), "form", "index.html"), "utf8");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
