import { createSite, runWpCli, lastLine } from "./instawp";
import { wpClient } from "./wp";
import { generateSiteDesign } from "./ai";

// Turns a submitted brief into a built-out WordPress site. The AI design is
// essential: if Claude can't produce a design, the build STOPS with an error
// (no half-built basic site). Order matters — design first, so a failure
// doesn't leave an orphaned InstaWP site behind.

type Brief = Record<string, unknown>;

const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export type BuildResult = {
  siteUrl: string;
  siteId: number | string;
  adminUser: string;
  adminPassword: string; // for wp-admin login
  appPassword: string; // for REST writes
};

export async function buildClientSite(
  data: Brief,
  opts: { themeBaseUrl: string; onStage?: (stage: string) => void | Promise<void> },
): Promise<BuildResult> {
  const stage = async (s: string) => {
    try {
      await opts.onStage?.(s);
    } catch {
      // progress reporting is best-effort
    }
  };

  // 1. Design first. If this fails, stop here — nothing has been provisioned.
  await stage("Designing the site with AI");
  const ai = await generateSiteDesign(data);
  if (!ai.html) {
    throw new Error(ai.error ? `AI design failed: ${ai.error}` : "AI design failed (no content returned)");
  }
  const design = ai.html;

  // 2. Provision the WordPress site.
  await stage("Provisioning the WordPress site");
  const site = await createSite();
  const siteId = site.id;
  const siteUrl = site.wp_url;
  const adminUser = site.wp_username;
  const adminPassword = site.wp_password ?? "";
  if (!siteId || !siteUrl || !adminUser) {
    throw new Error("InstaWP did not return full site details.");
  }

  // 3. Access for REST writes.
  await stage("Setting up access");
  const appPassword = lastLine(
    await runWpCli(siteId, `wp user application-password create ${adminUser} kwd-portal --porcelain`),
  );
  if (!/^[A-Za-z0-9]{16,}$/.test(appPassword)) {
    throw new Error("Could not obtain an application password from the new site.");
  }

  // 4. Publish the design on the blank canvas theme.
  await stage("Building the site");
  await runWpCli(siteId, `wp theme install ${opts.themeBaseUrl}/kwd-canvas.zip --activate`);

  const wp = wpClient(siteUrl, adminUser, appPassword);
  await wp.updateSettings({
    title: txt(data.business_name) || "New site",
    description: txt(data.tagline),
  });
  const home = await wp.createPage({ title: txt(data.business_name) || "Home", slug: "home", content: design });
  await wp.updateSettings({ show_on_front: "page", page_on_front: home.id as number });

  return { siteUrl, siteId, adminUser, adminPassword, appPassword };
}
