import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";
import { getViewer } from "@/lib/auth";
import { inviteClient } from "./actions";

// Always read fresh from the database, never statically cache.
export const dynamic = "force-dynamic";

export default async function SubmissionsPage() {
  const { isAdmin } = await getViewer();
  if (!isAdmin) redirect("/dashboard");

  const submissions = await prisma.submission.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "48px 24px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 28, marginBottom: 4 }}>Onboarding briefs</h1>
        <UserButton />
      </div>
      <nav style={{ margin: "4px 0 8px", fontSize: 14 }}>
        <span style={{ color: "#444", fontWeight: 600 }}>Briefs</span>
        <span style={{ color: "#ccc", margin: "0 8px" }}>·</span>
        <a href="/requests" style={{ color: "#0e7c7b", textDecoration: "none" }}>Change requests</a>
      </nav>
      <p style={{ color: "#666", marginTop: 0 }}>
        {submissions.length} {submissions.length === 1 ? "brief" : "briefs"} received.
      </p>

      {/* Invite a client */}
      <form
        action={inviteClient}
        style={{ display: "flex", gap: 8, marginTop: 20, padding: 16, background: "#f7f7f7", borderRadius: 10 }}
      >
        <input
          type="email"
          name="email"
          required
          placeholder="client@theirbusiness.co.uk"
          style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}
        />
        <button
          type="submit"
          style={{ background: "#0e7c7b", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 600, cursor: "pointer" }}
        >
          Invite client
        </button>
      </form>

      {submissions.length === 0 ? (
        <p style={{ marginTop: 32, color: "#888" }}>
          No briefs yet. Fill in <a href="/brief">the form</a> to test it.
        </p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 24, fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #eee" }}>
              <th style={{ padding: "10px 8px" }}>Business</th>
              <th style={{ padding: "10px 8px" }}>Contact</th>
              <th style={{ padding: "10px 8px" }}>Email</th>
              <th style={{ padding: "10px 8px" }}>Status</th>
              <th style={{ padding: "10px 8px" }}>Received</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: "10px 8px" }}>
                  <a href={`/submissions/${s.id}`} style={{ color: "#0e7c7b", textDecoration: "none", fontWeight: 600 }}>
                    {s.businessName ?? "Untitled brief"}
                  </a>
                </td>
                <td style={{ padding: "10px 8px" }}>{s.contactName ?? "—"}</td>
                <td style={{ padding: "10px 8px" }}>{s.contactEmail ?? "—"}</td>
                <td style={{ padding: "10px 8px" }}>{s.status}</td>
                <td style={{ padding: "10px 8px", color: "#888" }}>
                  {s.createdAt.toLocaleString("en-GB")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
