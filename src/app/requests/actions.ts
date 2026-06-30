"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Admin-only: move a change request along its workflow.
export async function updateRequestStatus(formData: FormData) {
  const { isAdmin } = await getViewer();
  if (!isAdmin) throw new Error("Not authorised.");

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["open", "in_progress", "done"].includes(status)) return;

  await prisma.changeRequest.update({ where: { id }, data: { status } });
  revalidatePath("/requests");
}
