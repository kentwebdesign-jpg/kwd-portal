import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Next 16 renamed `middleware` to `proxy`, but `middleware` is still supported
// for the edge runtime that Clerk uses. Revisit `proxy` once Clerk supports it.

// Everything except the home/landing page and Clerk routes requires sign-in.
// Admin-only authorisation (ADMIN_EMAILS) is enforced inside the /submissions
// pages themselves; here we just require a logged-in user.
const isProtected = createRouteMatcher([
  "/brief(.*)",
  "/dashboard(.*)",
  "/submissions(.*)",
  "/requests(.*)",
  "/api/submit",
  "/api/invite",
  "/api/upload-url",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ico|webp|woff2?|ttf|map)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
