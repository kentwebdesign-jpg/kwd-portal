import { createSite, runWpCli, lastLine } from "./instawp";
import { wpClient } from "./wp";
import { generateSiteContent, type SiteContent } from "./ai";

// Turns a submitted brief into a built-out WordPress site: provision via
// InstaWP, install the KWD theme, and create real pages. Page copy is written
// by Claude from the brief, falling back to plain brief text if AI is off.

type Brief = Record<string, unknown>;

const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
// Preserve line breaks in multi-line answers.
const para = (v: unknown) =>
  esc(txt(v))
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

// Services from the brief's repeatable rows.
function briefServices(data: Brief): { name: string; description: string }[] {
  const s = data.__services;
  if (!Array.isArray(s)) return [];
  return (s as { a?: string; b?: string }[])
    .filter((r) => r && (r.a || r.b))
    .map((r) => ({ name: r.a ?? "", description: r.b ?? "" }));
}

// AI-written services if present, otherwise the brief's own.
function serviceList(data: Brief, ai: SiteContent | null) {
  return ai?.services?.length ? ai.services : briefServices(data);
}

function serviceCards(list: { name: string; description: string }[]) {
  return (
    `<div class="cards">` +
    list
      .map(
        (r) => `<div class="card"><h3>${esc(r.name)}</h3>${r.description ? `<p>${esc(r.description)}</p>` : ""}</div>`,
      )
      .join("") +
    `</div>`
  );
}

function homeHtml(data: Brief, ai: SiteContent | null) {
  const heading = esc(ai?.heroHeading || txt(data.business_name) || "Your business");
  const subtext = esc(ai?.heroSubtext || txt(data.tagline) || txt(data.what_you_do));
  const cta = esc(ai?.ctaLabel || "Get in touch");
  const intro = ai?.homeIntro ? `<p>${esc(ai.homeIntro)}</p>` : para(data.what_you_do);
  const svc = serviceList(data, ai);

  let html = `<section class="hero"><div class="container"><h1>${heading}</h1>`;
  if (subtext) html += `<p>${subtext}</p>`;
  html += `<a class="btn" href="/contact/">${cta}</a></div></section><div class="container">`;
  if (intro) html += `<h2>What we do</h2>${intro}`;
  if (svc.length) html += `<h2>Our services</h2>${serviceCards(svc)}`;
  html += `</div>`;
  return html;
}

function aboutHtml(data: Brief, ai: SiteContent | null) {
  if (ai?.aboutParagraphs?.length) return ai.aboutParagraphs.map((p) => `<p>${esc(p)}</p>`).join("");
  const story = txt(data.about_story);
  return story ? para(story) : `<p>About ${esc(txt(data.business_name) || "us")}.</p>`;
}

function servicesHtml(data: Brief, ai: SiteContent | null) {
  const svc = serviceList(data, ai);
  return svc.length ? serviceCards(svc) : `<p>Our services.</p>`;
}

function contactHtml(data: Brief, ai: SiteContent | null) {
  const rows: string[] = [];
  if (txt(data.phone)) rows.push(`<li><strong>Phone:</strong> ${esc(txt(data.phone))}</li>`);
  if (txt(data.public_email)) rows.push(`<li><strong>Email:</strong> ${esc(txt(data.public_email))}</li>`);
  if (txt(data.address)) rows.push(`<li><strong>Address:</strong> ${esc(txt(data.address))}</li>`);
  if (txt(data.opening_hours)) rows.push(`<li><strong>Hours:</strong> ${esc(txt(data.opening_hours))}</li>`);
  const intro = ai?.contactIntro ? `<p>${esc(ai.contactIntro)}</p>` : "";
  let html = intro + (rows.length ? `<ul class="contact-list">${rows.join("")}</ul>` : `<p>Get in touch.</p>`);
  if (txt(data.areas_covered)) html += `<h2>Areas we cover</h2>${para(data.areas_covered)}`;
  return html;
}

export type BuildResult = {
  siteUrl: string;
  siteId: number | string;
  adminUser: string;
  adminPassword: string; // for wp-admin login
  appPassword: string; // for REST writes
};

export async function buildClientSite(data: Brief, opts: { themeUrl: string }): Promise<BuildResult> {
  const site = await createSite();
  const siteId = site.id;
  const siteUrl = site.wp_url;
  const adminUser = site.wp_username;
  const adminPassword = site.wp_password ?? "";
  if (!siteId || !siteUrl || !adminUser) {
    throw new Error("InstaWP did not return full site details.");
  }

  // Mint an application password for REST writes.
  const appPassword = lastLine(
    await runWpCli(siteId, `wp user application-password create ${adminUser} kwd-portal --porcelain`),
  );
  if (!/^[A-Za-z0-9]{16,}$/.test(appPassword)) {
    throw new Error("Could not obtain an application password from the new site.");
  }

  // Install + activate the KWD theme.
  await runWpCli(siteId, `wp theme install ${opts.themeUrl} --activate`);

  // Write professional copy with Claude (falls back to brief text if AI is off).
  const ai = await generateSiteContent(data);

  // Site identity + pages via REST.
  const wp = wpClient(siteUrl, adminUser, appPassword);
  await wp.updateSettings({
    title: ai?.siteTitle || txt(data.business_name) || "New site",
    description: ai?.tagline || txt(data.tagline),
  });

  const home = await wp.createPage({ title: "Home", slug: "home", content: homeHtml(data, ai) });
  const about = await wp.createPage({ title: "About", slug: "about", content: aboutHtml(data, ai) });
  const servicesPage = await wp.createPage({ title: "Services", slug: "services", content: servicesHtml(data, ai) });
  const contact = await wp.createPage({ title: "Contact", slug: "contact", content: contactHtml(data, ai) });

  await wp.updateSettings({ show_on_front: "page", page_on_front: home.id as number });

  // Primary nav menu (best effort — site still works without it).
  try {
    await runWpCli(siteId, `wp menu create "Primary"`);
    await runWpCli(siteId, `wp menu location assign primary primary`);
    for (const id of [home.id, about.id, servicesPage.id, contact.id]) {
      await runWpCli(siteId, `wp menu item add-post primary ${id}`);
    }
  } catch {
    // ignore menu failures
  }

  return { siteUrl, siteId, adminUser, adminPassword, appPassword };
}
