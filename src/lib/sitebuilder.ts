import { createSite, runWpCli, lastLine } from "./instawp";
import { wpClient } from "./wp";
import { generateSite } from "./ai";

// Turns a submitted brief into a built-out, MULTI-PAGE WordPress site. The AI
// design is essential: if Claude can't produce the site, the build STOPS with
// an error (no half-built site). Order matters — design first, so a failure
// doesn't leave an orphaned InstaWP site behind. Each page in the plan becomes
// its own WordPress page, sharing a byte-identical header, footer and CSS.

type Brief = Record<string, unknown>;

const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export type BuiltPage = { title: string; slug: string; url: string; isHome: boolean };

export type BuildResult = {
  siteUrl: string;
  siteId: number | string;
  adminUser: string;
  adminPassword: string; // for wp-admin login
  appPassword: string; // for REST writes
  pages: BuiltPage[]; // every WordPress page we created
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

  // 1. Design the whole multi-page site first. If this fails, stop here —
  //    nothing has been provisioned.
  await stage("Designing the site with AI (house rules + brief)");
  const site = await generateSite(data);
  if (!site.pages || site.pages.length === 0) {
    throw new Error(site.error ? `AI design failed: ${site.error}` : "AI design failed (no pages returned)");
  }

  // 2. Provision the WordPress site.
  await stage("Provisioning the WordPress site");
  const wpSite = await createSite();
  const siteId = wpSite.id;
  const siteUrl = wpSite.wp_url;
  const adminUser = wpSite.wp_username;
  const adminPassword = wpSite.wp_password ?? "";
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

  // 4. Blank-canvas theme + pretty permalinks so /<slug>/ links resolve.
  await stage("Preparing WordPress");
  await runWpCli(siteId, `wp theme install ${opts.themeBaseUrl}/kwd-canvas.zip --activate`);
  await runWpCli(siteId, `wp rewrite structure '/%postname%/' --hard`);
  await runWpCli(siteId, `wp rewrite flush --hard`);

  const wp = wpClient(siteUrl, adminUser, appPassword);
  await wp.updateSettings({
    title: site.siteTitle || txt(data.business_name) || "New site",
    description: site.tagline || txt(data.tagline),
  });

  // 5. Create every page.
  const built: BuiltPage[] = [];
  let homeId: number | undefined;
  for (let i = 0; i < site.pages.length; i++) {
    const p = site.pages[i];
    await stage(`Building pages (${i + 1}/${site.pages.length}): ${p.title}`);
    const res = await wp.createPage({
      title: p.title,
      slug: p.slug,
      content: p.html,
      excerpt: p.metaDescription,
    });
    if (p.isHome && typeof res.id === "number") homeId = res.id;
    built.push({
      title: p.title,
      slug: p.slug,
      url: typeof res.link === "string" ? res.link : `${siteUrl.replace(/\/$/, "")}/${p.slug}/`,
      isHome: p.isHome,
    });
  }

  // 6. Set the home page as the front page.
  if (homeId != null) {
    await stage("Setting the home page");
    await wp.updateSettings({ show_on_front: "page", page_on_front: homeId });
  }

  return { siteUrl, siteId, adminUser, adminPassword, appPassword, pages: built };
}
