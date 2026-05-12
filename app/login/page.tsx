import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="login-page" />}>
      <LoginForm />
    </Suspense>
  );
}
