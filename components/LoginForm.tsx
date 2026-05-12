"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LockKeyhole, LogIn } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id.trim(), password }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "로그인 정보를 다시 확인해 주세요.");
        setIsLoading(false);
        return;
      }

      router.replace(searchParams.get("next") || "/");
      router.refresh();
    } catch {
      setError("로그인 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.");
      setIsLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-icon">
          <LockKeyhole className="size-7" />
        </div>
        <p className="prof-eyebrow">Private Test</p>
        <h1>3관점 논리 토론 로그인</h1>
        <p className="login-copy">지정된 3명만 사용하는 테스트 공간입니다. 받은 아이디와 비밀번호로 들어가 주세요.</p>

        <form onSubmit={submitLogin} className="login-form">
          <label>
            <span>아이디</span>
            <input
              value={id}
              onChange={(event) => setId(event.target.value)}
              autoComplete="username"
              placeholder="아이디"
            />
          </label>

          <label>
            <span>비밀번호</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder="비밀번호"
            />
          </label>

          {error ? <p className="login-error">{error}</p> : null}

          <button type="submit" disabled={isLoading}>
            <LogIn className="size-5" />
            {isLoading ? "확인 중..." : "로그인"}
          </button>
        </form>
      </section>
    </main>
  );
}
