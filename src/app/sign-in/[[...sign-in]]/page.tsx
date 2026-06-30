import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "60px 16px" }}>
      <SignIn />
    </div>
  );
}
