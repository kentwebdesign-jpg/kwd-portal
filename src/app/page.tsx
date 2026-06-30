export default function Home() {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: "0 auto",
        padding: "80px 24px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <p style={{ textTransform: "uppercase", letterSpacing: ".08em", fontSize: 12, color: "#0e7c7b", fontWeight: 600 }}>
        Kent Web Design
      </p>
      <h1 style={{ fontSize: 34, margin: "8px 0 12px" }}>Client portal</h1>
      <p style={{ color: "#555", fontSize: 16, lineHeight: 1.6, marginTop: 0 }}>
        The home of client onboarding. This is an early build — login and the
        client dashboard come next.
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}>
        <a
          href="/brief"
          style={{
            background: "#0e7c7b",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Open the onboarding form
        </a>
        <a
          href="/submissions"
          style={{
            border: "1px solid #ddd",
            color: "#222",
            padding: "12px 20px",
            borderRadius: 8,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          View submitted briefs
        </a>
      </div>
    </main>
  );
}
