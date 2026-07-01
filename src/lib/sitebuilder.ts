import { createSite, deleteSite, runWpCli, lastLine } from "./instawp";
import { wpClient } from "./wp";
import { generateSite, type DesignReview } from "./ai";
import { generateSiteImages } from "./higgsfield";

// Turns a submitted brief into a built-out, MULTI-PAGE WordPress site. The AI
// design is essential: if Claude can't produce the site, the build STOPS with
// an error (no half-built site). Order matters — design first, so a failure
// doesn't leave an orphaned InstaWP site behind. Each page in the plan becomes
// its own WordPress page, sharing a byte-identical header, footer and CSS.
//
// Imagery: before designing, we generate a small set of bespoke images
// (Higgsfield) and hand their URLs to the design so they get used across the
// whole site. Images are an enhancement — if generation isn't configured or
// fails, the build proceeds image-free. Once the site exists we re-host each
// image into the site's own WP media library and rewrite the URLs, so nothing
// depends on an external CDN.

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
  // Diagnostics: how many images were generated and re-hosted on the site,
  // plus the reason if generation failed.
  images: { generated: number; hostedOnSite: number; error: string | null };
  // Diagnostics from the render→critique→refine design review.
  design: DesignReview;
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

  // 1. Generate a small set of bespoke images from the brief (best-effort). If
  //    Higgsfield isn't configured or the calls fail, the set is empty and the
  //    site is designed image-free.
  await stage("Generating imagery");
  const imageSet = await generateSiteImages(data);
  const images = imageSet.images;

  // 2. Design the whole multi-page site, handing it the image library. This now
  //    includes the render→critique→refine design review (the pipeline renders
  //    its own output to screenshots and fixes what it sees). If it fails, stop
  //    here — nothing has been provisioned yet.
  await stage("Designing the site with AI (house rules + brief)");
  const site = await generateSite(data, { images, onStage: opts.onStage });
  if (!site.pages || site.pages.length === 0) {
    throw new Error(site.error ? `AI design failed: ${site.error}` : "AI design failed (no pages returned)");
  }

  // 3. Provision the WordPress site.
  await stage("Provisioning the WordPress site");
  const wpSite = await createSite();
  const siteId = wpSite.id;
  const siteUrl = wpSite.wp_url;
  const adminUser = wpSite.wp_username;
  const adminPassword = wpSite.wp_password ?? "";
  if (!siteId || !siteUrl || !adminUser) {
    throw new Error("InstaWP did not return full site details.");
  }

  // From here on a site exists, so a failure must clean it up rather than leave
  // an orphaned InstaWP site behind.
  try {
    // 4. Access for REST writes.
    await stage("Setting up access");
    const appPassword = lastLine(
      await runWpCli(siteId, `wp user application-password create ${adminUser} kwd-portal --porcelain`),
    );
    if (!/^[A-Za-z0-9]{16,}$/.test(appPassword)) {
      throw new Error("Could not obtain an application password from the new site.");
    }

    // 5. Blank-canvas theme + pretty permalinks so /<slug>/ links resolve.
    await stage("Preparing WordPress");
    await runWpCli(siteId, `wp theme install ${opts.themeBaseUrl}/kwd-canvas.zip --activate`);
    await runWpCli(siteId, `wp rewrite structure '/%postname%/' --hard`);
    await runWpCli(siteId, `wp rewrite flush --hard`);

    const wp = wpClient(siteUrl, adminUser, appPassword);
    await wp.updateSettings({
      title: site.siteTitle || txt(data.business_name) || "New site",
      description: site.tagline || txt(data.tagline),
    });

    // 6. Re-host each generated image into the site's own media library and map
    //    its external URL to the local one. The design references these URLs
    //    across multiple pages, so we rewrite every page below. Best-effort: any
    //    image that fails to re-host keeps its working external URL.
    const urlMap: [string, string][] = [];
    if (images.length) {
      await stage("Adding imagery to the site");
      for (const img of images) {
        try {
          const attachId = lastLine(await runWpCli(siteId, `wp media import '${img.url}' --porcelain`));
          if (/^\d+$/.test(attachId)) {
            const local = lastLine(await runWpCli(siteId, `wp eval 'echo wp_get_attachment_url(${attachId});'`));
            if (/^https?:\/\//.test(local)) urlMap.push([img.url, local]);
          }
        } catch {
          // keep the external URL if re-hosting this image fails
        }
      }
    }

    // 7. Create every page, rewriting any generated image URLs to their
    //    re-hosted local equivalents.
    const built: BuiltPage[] = [];
    let homeId: number | undefined;
    for (let i = 0; i < site.pages.length; i++) {
      const p = site.pages[i];
      await stage(`Building pages (${i + 1}/${site.pages.length}): ${p.title}`);
      let html = p.html;
      for (const [src, local] of urlMap) html = html.split(src).join(local);
      const res = await wp.createPage({
        title: p.title,
        slug: p.slug,
        content: html,
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

    // 8. Set the home page as the front page.
    if (homeId != null) {
      await stage("Setting the home page");
      await wp.updateSettings({ show_on_front: "page", page_on_front: homeId });
    }

    return {
      siteUrl,
      siteId,
      adminUser,
      adminPassword,
      appPassword,
      pages: built,
      images: { generated: images.length, hostedOnSite: urlMap.length, error: imageSet.error },
      design: site.design,
    };
  } catch (err) {
    await deleteSite(siteId);
    throw err;
  }
}
