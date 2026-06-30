import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { presignUpload } from "@/lib/r2";

// Returns a short-lived URL the signed-in client can upload one file to,
// directly into R2, plus the storage key to record against their brief.
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  let body: { filename?: string; type?: string; field?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const field = String(body.field ?? "file").replace(/[^a-z_]/gi, "");
  const contentType = body.type || "application/octet-stream";
  const safeName = String(body.filename ?? "file").replace(/[^a-zA-Z0-9._-]/g, "_");
  const rand = Math.random().toString(36).slice(2, 8);
  const key = `briefs/${userId}/${field}/${Date.now()}-${rand}-${safeName}`;

  const url = await presignUpload(key, contentType);
  return NextResponse.json({ url, key });
}
