import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Receives a completed onboarding brief from the form and stores it.
// The form posts the full `collectText()` object as JSON.
export async function POST(request: Request) {
  let data: Record<string, unknown>;

  try {
    data = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON." }, { status: 400 });
  }

  if (!data || typeof data !== "object") {
    return NextResponse.json({ success: false, message: "No brief data received." }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  try {
    const submission = await prisma.submission.create({
      data: {
        businessName: str(data.business_name),
        contactName: str(data.contact_name),
        contactEmail: str(data.contact_filling_email) ?? str(data.public_email),
        data: data as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ success: true, id: submission.id });
  } catch (err) {
    console.error("Failed to save submission:", err);
    return NextResponse.json(
      { success: false, message: "Could not save your brief. Please try again." },
      { status: 500 },
    );
  }
}
