import { createSite, runWpCli, lastLine } from "./instawp";
import { wpClient } from "./wp";

// Turns a submitted brief into a built-out WordPress site: provision via
// InstaWP, install the KWD theme, and create real pages from the brief.

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

function services(data: Brief): { a?: string; b?: string }[] {
  const s = data.__services;
  return Array.isArray(s) ? (s as { a?: string; b?: string }[]).filter((r) => r && (r.a || r.b)) : [];
}

function homeHtml(data: Brief) {
  const name = esc(txt(data.business_name) || "Your business");
  const tagline = esc(txt(data.tagline) || txt(data.what_you_do));
  const svc = services(data);
  let html = `<section class="hero"><div class="container"><h1>${name}</h1>`;
  if (tagline) html += `<p>${tagline}</p>`;
  html += `<a class="btn" href="/contact/">Get in touch</a></div></section><div class="container">`;
  if (txt(data.what_you_do)) html += `<h2>What we do</h2>${para(data.what_you_do)}`;
  if (svc.length) {
    html += `<h2>Our services</h2><div class="cards">`;
    svc.forEach((r) => {
      html += `<div class="card"><h3>${esc(r.a ?? "")}</h3>${r.b ? `<p>${esc(r.b)}</p>` : ""}</div>`;
    });
    html += `</div>`;
  }
  html += `</div>`;
  return html;
}

function aboutHtml(data: Brief) {
  const story = txt(data.about_story);
  return story ? para(story) : `<p>About ${esc(txt(data.business_name) || "us")}.</p>`;
}

function servicesHtml(data: Brief) {
  const svc = services(data);
  if (!svc.length) return `<p>Our services.</p>`;
  let html = `<div class="cards">`;
  svc.forEach((r) => {
    html += `<div class="card"><h3>${esc(r.a ?? "")}</h3>${r.b ? `<p>${esc(r.b)}</p>` : ""}</div>`;
  });
  return html + `</div>`;
}

function contactHtml(data: Brief) {
  const rows: string[] = [];
  if (txt(data.phone)) rows.push(`<li><strong>Phone:</strong> ${esc(txt(data.phone))}</li>`);
  if (txt(data.public_email)) rows.push(`<li><strong>Email:</strong> ${esc(txt(data.public_email))}</li>`);
  if (txt(data.address)) rows.push(`<li><strong>Address:</strong> ${esc(txt(data.address))}</li>`);
  if (txt(data.opening_hours)) rows.push(`<li><strong>Hours:</strong> ${esc(txt(data.opening_hours))}</li>`);
  let html = rows.length ? `<ul class="contact-list">${rows.join("")}</ul>` : `<p>Get in touch.</p>`;
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

  // Site identity + pages via REST.
  const wp = wpClient(siteUrl, adminUser, appPassword);
  await wp.updateSettings({
    title: txt(data.business_name) || "New site",
    description: txt(data.tagline),
  });

  const home = await wp.createPage({ title: "Home", slug: "home", content: homeHtml(data) });
  const about = await wp.createPage({ title: "About", slug: "about", content: aboutHtml(data) });
  const servicesPage = await wp.createPage({ title: "Services", slug: "services", content: servicesHtml(data) });
  const contact = await wp.createPage({ title: "Contact", slug: "contact", content: contactHtml(data) });

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
