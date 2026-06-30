"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { headers } from "next/headers";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildClientSite } from "@/lib/sitebuilder";
import { sendAdminEmail } from "@/lib/email";

// Admin-only: kick off a background build of the client's site. Returns
// immediately; the build runs after the response (Next `after`) and reports
// progress via buildStage, then emails the admin when done.
export async function buildSite(formData: FormData) {
  const { isAdmin } = await getViewer();
  if (!isAdmin) throw new Error("Not authorised.");

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const submission = await prisma.submission.findUnique({ where: { id } });
  if (!submission) return;

  // The InstaWP server fetches the theme zips from our public URL.
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const themeBaseUrl = `${proto}://${host}/themes`;

  const data = submission.data as Record<string, unknown>;
  const business = submission.businessName ?? "the client";

  // Flip to "building" right away so the UI shows progress.
  await prisma.submission.update({
    where: { id },
    data: { buildStatus: "building", buildStage: "Starting", buildData: {} as Prisma.InputJsonValue },
  });
  revalidatePath(`/submissions/${id}`);

  // Run the actual build after the response is sent.
  after(async () => {
    try {
      const result = await buildClientSite(data, {
        themeBaseUrl,
        onStage: async (s) => {
          await prisma.submission.update({ where: { id }, data: { buildStage: s } });
        },
      });

      await prisma.submission.update({
        where: { id },
        data: {
          buildStatus: "ready",
          buildStage: null,
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

      const adminUrl = `${result.siteUrl.replace(/\/$/, "")}/wp-admin`;
      await sendAdminEmail({
        subject: `Site built: ${business}`,
        text:
          `The AI-designed website for ${business} has finished building.\n\n` +
          `View site: ${result.siteUrl}\n` +
          `WordPress admin: ${adminUrl}\n` +
          `Login: ${result.adminUser} / ${result.adminPassword}`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.submission.update({
        where: { id },
        data: { buildStatus: "error", buildStage: null, buildData: { error: msg } as Prisma.InputJsonValue },
      });
      await sendAdminEmail({
        subject: `Site build FAILED: ${business}`,
        text: `The build for ${business} failed:\n\n${msg}\n\nYou can try again from the portal.`,
      });
    }
  });
}
