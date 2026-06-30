import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createChangeRequest } from "./actions";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Done",
};

export default async function Dashboard() {
  const { user, isAdmin } = await getViewer();
  if (!user) redirect("/");
  if (isAdmin) redirect("/submissions");

  const brief = await prisma.submission.findUnique({ where: { userId: user.id } });
  const requests = await prisma.changeRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  const done = !!brief;
  const firstName = user.firstName ?? "there";

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ textTransform: "uppercase", letterSpacing: ".08em", fontSize: 12, color: "#0e7c7b", fontWeight: 600, margin: 0 }}>
          Kent Web Design
        </p>
        <UserButton />
      </div>

      <h1 style={{ fontSize: 30, margin: "10px 0 6px" }}>Hi {firstName} 👋</h1>
      <p style={{ color: "#555", marginTop: 0 }}>Welcome to your project portal.</p>

      {/* Onboarding card */}
      <section
        style={{
          marginTop: 28,
          border: "1px solid #e8e8e8",
          borderRadius: 12,
          padding: 24,
          background: done ? "#f3fbfa" : "#fff",
        }}
      >
        <h2 style={{ fontSize: 18, margin: "0 0 6px" }}>Your onboarding brief</h2>
        {done ? (
          <>
            <p style={{ color: "#137e6d", margin: "0 0 16px", fontWeight: 600 }}>
              ✓ Submitted — thank you! We have everything we need to get started.
            </p>
            <a href="/brief" style={{ color: "#0e7c7b", fontWeight: 600, textDecoration: "none" }}>
              Update your answers →
            </a>
          </>
        ) : (
          <>
            <p style={{ color: "#555", margin: "0 0 16px" }}>
              Tell us about your business so we can build your website. Takes about 10–15 minutes,
              and your answers save as you go.
            </p>
            <a
              href="/brief"
              style={{
                display: "inline-block",
                background: "#0e7c7b",
                color: "#fff",
                padding: "12px 20px",
                borderRadius: 8,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Complete your onboarding
            </a>
          </>
        )}
      </section>

      {/* Change requests */}
      <section style={{ marginTop: 20, border: "1px solid #e8e8e8", borderRadius: 12, padding: 24 }}>
        <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>Change requests</h2>
        <p style={{ color: "#666", marginTop: 0, fontSize: 14 }}>
          Need something changed on your site? Send us the details and we&apos;ll take care of it.
        </p>

        <form action={createChangeRequest} style={{ display: "grid", gap: 10, marginTop: 8 }}>
          <input
            name="title"
            required
            placeholder="Short summary (e.g. Update opening hours)"
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}
          />
          <textarea
            name="details"
            required
            rows={3}
            placeholder="What would you like changed?"
            style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, resize: "vertical" }}
          />
          <div>
            <button
              type="submit"
              style={{ background: "#0e7c7b", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 600, cursor: "pointer" }}
            >
              Submit request
            </button>
          </div>
        </form>

        {requests.length > 0 && (
          <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 0", display: "grid", gap: 10 }}>
            {requests.map((r) => (
              <li key={r.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <strong style={{ fontSize: 14 }}>{r.title}</strong>
                  <span style={{ fontSize: 12, color: "#0e7c7b", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "#555", whiteSpace: "pre-wrap" }}>{r.details}</p>
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "#aaa" }}>{r.createdAt.toLocaleDateString("en-GB")}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
