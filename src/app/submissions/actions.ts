"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";

// Admin-only: invite a client by email. Clerk emails them a link to set a
// password and join the portal.
export async function inviteClient(formData: FormData) {
  const { isAdmin } = await getViewer();
  if (!isAdmin) throw new Error("Not authorised.");

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return;

  const client = await clerkClient();
  await client.invitations.createInvitation({
    emailAddress: email,
    ignoreExisting: true,
  });

  revalidatePath("/submissions");
}
