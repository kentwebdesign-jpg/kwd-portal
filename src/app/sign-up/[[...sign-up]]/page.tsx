import { SignUp } from "@clerk/nextjs";

// Where invited clients land to set their password (the invite ticket is read
// from the URL by the SignUp component).
export default function SignUpPage() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "60px 16px" }}>
      <SignUp />
    </div>
  );
}
