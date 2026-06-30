import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateRequestStatus } from "./actions";

export const dynamic = "force-dynamic";

const STATUSES = ["open", "in_progress", "done"];

export default async function RequestsPage() {
  const { isAdmin } = await getViewer();
  if (!isAdmin) redirect("/dashboard");

  const requests = await prisma.changeRequest.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "48px 24px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 28, marginBottom: 4 }}>Change requests</h1>
        <UserButton />
      </div>
      <nav style={{ margin: "4px 0 8px", fontSize: 14 }}>
        <a href="/submissions" style={{ color: "#0e7c7b", textDecoration: "none" }}>Briefs</a>
        <span style={{ color: "#ccc", margin: "0 8px" }}>·</span>
        <span style={{ color: "#444", fontWeight: 600 }}>Change requests</span>
      </nav>

      {requests.length === 0 ? (
        <p style={{ marginTop: 24, color: "#888" }}>No change requests yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0", display: "grid", gap: 12 }}>
          {requests.map((r) => (
            <li key={r.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div>
                  <strong style={{ fontSize: 15 }}>{r.title}</strong>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#999" }}>
                    {r.clientEmail ?? "unknown client"} · {r.createdAt.toLocaleString("en-GB")}
                  </p>
                </div>
                <form action={updateRequestStatus} style={{ display: "flex", gap: 6 }}>
                  <input type="hidden" name="id" value={r.id} />
                  <select
                    name="status"
                    defaultValue={r.status}
                    style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 13 }}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    style={{ background: "#0e7c7b", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                  >
                    Save
                  </button>
                </form>
              </div>
              <p style={{ margin: "10px 0 0", fontSize: 14, color: "#444", whiteSpace: "pre-wrap" }}>{r.details}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
