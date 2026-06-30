import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Next 16 renamed `middleware` to `proxy`, but `middleware` is still supported
// for the edge runtime that Clerk uses. Revisit `proxy` once Clerk supports it.

// Only the admin area is locked. The onboarding form (/brief), the submit
// endpoint, and the home page stay public so clients can fill in their brief.
const isAdminRoute = createRouteMatcher(["/submissions(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req)) {
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
