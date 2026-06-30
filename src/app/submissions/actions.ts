"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getViewer } from "@/lib/auth";

// Admin-only: invite a client by email. Clerk emails them a link to set a
// password and join the portal.
export async function inviteClient(formData: FormData) {
  const { isAdmin } = await getViewer();
  if (!isAdmin) throw new Error("Not authorised.");

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return;

  const h = await headers();
  const host = h.get("host");
  const origin = host ? `https://${host}` : undefined;

  const client = await clerkClient();
  await client.invitations.createInvitation({
    emailAddress: email,
    ignoreExisting: true,
    // Land them on our in-app sign-up so they set a password on our domain.
    redirectUrl: origin ? `${origin}/sign-up` : undefined,
  });

  revalidatePath("/submissions");
}
