import { UserButton } from "@clerk/nextjs";
import { prisma } from "@/lib/prisma";

// Always read fresh from the database, never statically cache.
export const dynamic = "force-dynamic";

export default async function SubmissionsPage() {
  const submissions = await prisma.submission.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "48px 24px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 28, marginBottom: 4 }}>Onboarding briefs</h1>
        <UserButton />
      </div>
      <p style={{ color: "#666", marginTop: 0 }}>
        {submissions.length} {submissions.length === 1 ? "brief" : "briefs"} received.
      </p>

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
