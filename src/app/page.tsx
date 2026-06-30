import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { getViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { userId } = await auth();

  // Signed in → send to the right place.
  if (userId) {
    const { isAdmin } = await getViewer();
    redirect(isAdmin ? "/submissions" : "/dashboard");
  }

  // Signed out → a simple landing with sign-in.
  return (
    <main
      style={{
        maxWidth: 520,
        margin: "0 auto",
        padding: "100px 24px",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
      }}
    >
      <p style={{ textTransform: "uppercase", letterSpacing: ".08em", fontSize: 12, color: "#0e7c7b", fontWeight: 600 }}>
        Kent Web Design
      </p>
      <h1 style={{ fontSize: 34, margin: "10px 0 12px" }}>Client portal</h1>
      <p style={{ color: "#555", fontSize: 16, lineHeight: 1.6, marginTop: 0 }}>
        Sign in to complete your onboarding and manage your website project.
      </p>

      <div style={{ marginTop: 28 }}>
        <SignInButton mode="redirect" forceRedirectUrl="/" signUpForceRedirectUrl="/">
          <button
            style={{
              background: "#0e7c7b",
              color: "#fff",
              padding: "12px 28px",
              borderRadius: 8,
              border: "none",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Sign in
          </button>
        </SignInButton>
      </div>

      <p style={{ color: "#999", fontSize: 13, marginTop: 20 }}>
        Access is by invitation. If you&apos;re expecting an invite and can&apos;t get in, contact us.
      </p>
    </main>
  );
}
