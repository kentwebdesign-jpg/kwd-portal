"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildClientSite } from "@/lib/sitebuilder";

// Admin-only: provision a WordPress site for this brief and build it out
// (theme + pages from the brief) via InstaWP.
export async function buildSite(formData: FormData) {
  const { isAdmin } = await getViewer();
  if (!isAdmin) throw new Error("Not authorised.");

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const submission = await prisma.submission.findUnique({ where: { id } });
  if (!submission) return;

  // The InstaWP server fetches the theme zip from our public URL.
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const themeUrl = `${proto}://${host}/themes/kwd-theme.zip`;

  try {
    const result = await buildClientSite(submission.data as Record<string, unknown>, { themeUrl });
    await prisma.submission.update({
      where: { id },
      data: {
        buildStatus: "ready",
        buildSiteUrl: result.siteUrl,
        buildData: {
          wp_username: result.adminUser,
          wp_password: result.adminPassword,
          app_password: result.appPassword,
          site_id: result.siteId,
        } as Prisma.InputJsonValue,
        builtAt: new Date(),
      },
    });
  } catch (err) {
    await prisma.submission.update({
      where: { id },
      data: {
        buildStatus: "error",
        buildData: { error: err instanceof Error ? err.message : String(err) } as Prisma.InputJsonValue,
      },
    });
  }

  revalidatePath(`/submissions/${id}`);
}
