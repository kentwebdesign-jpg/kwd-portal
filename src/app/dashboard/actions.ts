"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// A signed-in client raises a change request for their live site.
export async function createChangeRequest(formData: FormData) {
  const { user, email } = await getViewer();
  if (!user) throw new Error("Please sign in.");

  const title = String(formData.get("title") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  if (!title || !details) return;

  await prisma.changeRequest.create({
    data: { userId: user.id, clientEmail: email, title, details },
  });

  revalidatePath("/dashboard");
}
