import { currentUser } from "@clerk/nextjs/server";

// A signed-in user is an admin if their email is listed in the ADMIN_EMAILS
// env var (comma-separated). Everyone else is a client.
export async function getViewer() {
  const user = await currentUser();
  if (!user) return { user: null, email: null, isAdmin: false };

  const email = user.emailAddresses[0]?.emailAddress?.toLowerCase() ?? null;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return { user, email, isAdmin: !!email && admins.includes(email) };
}
