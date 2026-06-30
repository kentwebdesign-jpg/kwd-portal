"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSiteFromTemplate } from "@/lib/instawp";

// Admin-only: provision a WordPress site for this brief via InstaWP.
export async function buildSite(formData: FormData) {
  const { isAdmin } = await getViewer();
  if (!isAdmin) throw new Error("Not authorised.");

  const id = String(formData.get("id") ?? "");
  const templateSlug = String(formData.get("template_slug") ?? "").trim();
  if (!id || !templateSlug) return;

  const submission = await prisma.submission.findUnique({ where: { id } });
  if (!submission) return;

  try {
    const site = await createSiteFromTemplate({
      templateSlug,
      siteName: submission.businessName ?? undefined,
    });
    await prisma.submission.update({
      where: { id },
      data: {
        buildStatus: "ready",
        buildSiteUrl: site.wp_url ?? null,
        buildData: {
          wp_username: site.wp_username ?? null,
          wp_password: site.wp_password ?? null,
          task_id: site.task_id ?? null,
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
