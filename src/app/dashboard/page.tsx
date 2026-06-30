import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { getViewer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { user, isAdmin } = await getViewer();
  if (!user) redirect("/");
  if (isAdmin) redirect("/submissions");

  const brief = await prisma.submission.findUnique({ where: { userId: user.id } });
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

      {/* Future: change requests */}
      <section style={{ marginTop: 20, border: "1px dashed #ddd", borderRadius: 12, padding: 24, color: "#999" }}>
        <h2 style={{ fontSize: 18, margin: "0 0 6px", color: "#777" }}>Change requests</h2>
        <p style={{ margin: 0 }}>Once your site is live, you&apos;ll be able to request changes here.</p>
      </section>
    </main>
  );
}
