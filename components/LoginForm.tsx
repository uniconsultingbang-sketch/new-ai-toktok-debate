"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import styles from "./AdminLogin.module.css";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showLoginHeroImage, setShowLoginHeroImage] = useState(true);
  const nextPath = searchParams.get("next") || "/";
  const isAdminLogin = nextPath === "/admin" || nextPath.startsWith("/admin?");
  const adminUserId = "demo03";
  const sessionNotice =
    !error && searchParams.get("reason") === "session-replaced"
      ? "다른 기기에서 같은 계정으로 새 로그인이 발생했거나 로그인 시간이 만료되었습니다. 다시 로그인하면 현재 기기로 접속이 전환됩니다."
      : "";

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    setError("");
    setIsLoading(true);

    if (isAdminLogin && id.trim() !== adminUserId) {
      setError("관리자 계정만 로그인할 수 있습니다.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id.trim(), password, adminOnly: isAdminLogin }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "로그인 정보를 다시 확인해 주세요.");
        setIsLoading(false);
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("로그인 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.");
      setIsLoading(false);
    }
  }

  if (isAdminLogin) {
    return (
      <main className={styles.page}>
        <div className={styles.leftDots} aria-hidden="true" />
        <div className={styles.rightDots} aria-hidden="true" />
        <div className={styles.leftCurve} aria-hidden="true" />
        <div className={styles.rightCurve} aria-hidden="true" />

        <section className={styles.card} aria-labelledby="admin-login-title">
          <img className={styles.brandLogo} src="/images/ai-talk-talk-logo-beta.png" alt="AI Talk Talk Beta" />
          <h1 id="admin-login-title" className={styles.srOnly}>
            AI Talk Talk
          </h1>
          <img
            className={styles.characterHero}
            src="/images/ai-talk-talk-admin-characters.png"
            alt="Claude, GPT, Gemini 캐릭터"
          />
          <p className={styles.subtitle}>Admin Console</p>
          <div className={styles.divider} />
          <p className={styles.description}>관리자 계정으로 로그인하세요.</p>

          <form onSubmit={submitLogin} className={styles.form}>
            <label>
              <span>아이디</span>
              <div className={styles.inputWrap}>
                <UserRound size={20} aria-hidden="true" />
                <input
                  value={id}
                  onChange={(event) => setId(event.target.value)}
                  autoComplete="username"
                  placeholder="아이디를 입력하세요"
                />
              </div>
            </label>

            <label>
              <span>비밀번호</span>
              <div className={styles.inputWrap}>
                <LockKeyhole size={19} aria-hidden="true" />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="비밀번호를 입력하세요"
                />
                <button
                  className={styles.visibilityButton}
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </label>

            {sessionNotice ? <p className={styles.notice}>{sessionNotice}</p> : null}
            {error ? <p className={styles.error}>{error}</p> : null}

            <button className={styles.submitButton} type="submit" disabled={isLoading}>
              {isLoading ? "확인 중..." : "로그인"}
            </button>
          </form>
        </section>

        <p className={styles.footer}>2026 AI Talk Talk. All rights reserved.</p>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand-block">
          <div className="login-brand-title">
            <img
              src="/images/ai-talk-login-logo.png"
              alt="AI Talk Talk Beta"
              className="login-brand-logo"
              draggable={false}
            />
          </div>
          <p>AI와 함께 자유롭게 이야기해보세요.</p>
        </div>

        <div className="login-hero-card" aria-hidden="true">
          {showLoginHeroImage ? (
            <img
              src="/images/ai-talk-login-robots.png"
              alt=""
              className="login-hero-image"
              draggable={false}
              onError={() => setShowLoginHeroImage(false)}
            />
          ) : (
            <div className="login-bot-stage">
              <div className="mobile-bot mobile-bot-claude">
                <span className="mobile-bot-bubble">AI</span>
                <span className="mobile-bot-face" />
                <strong>Claude</strong>
              </div>
              <div className="mobile-bot mobile-bot-gpt">
                <span className="mobile-bot-bubble">...</span>
                <span className="mobile-bot-face" />
                <strong>GPT</strong>
              </div>
              <div className="mobile-bot mobile-bot-gemini">
                <span className="mobile-bot-bubble">OK</span>
                <span className="mobile-bot-face" />
                <strong>Gemini</strong>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={submitLogin} className="login-form">
          <label>
            <div className="login-input-shell">
              <UserRound size={22} aria-hidden="true" />
              <input
                value={id}
                onChange={(event) => setId(event.target.value)}
                aria-label="아이디"
                autoComplete="username"
                placeholder="아이디를 입력하세요"
              />
            </div>
          </label>

          <label>
            <div className="login-input-shell">
              <LockKeyhole size={22} aria-hidden="true" />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-label="비밀번호"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="비밀번호를 입력하세요"
              />
              <button
                type="button"
                className="login-password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              >
                {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
              </button>
            </div>
          </label>

          {sessionNotice ? <p className="login-notice">{sessionNotice}</p> : null}
          {error ? <p className="login-error">{error}</p> : null}

          <button type="submit" disabled={isLoading}>
            {isLoading ? "확인 중..." : "로그인"}
          </button>
        </form>

        <div className="login-beta-note">
          <span>
            <LockKeyhole className="size-5" />
          </span>
          <p>
            <strong>AI Talk Talk Beta 서비스</strong>
            지정된 3명만 사용하는 테스트 공간입니다.
          </p>
        </div>

        <p
          className="login-footer"
          style={{
            width: "100%",
            margin: "8px auto 0",
            color: "rgba(105, 113, 134, 0.48)",
            textAlign: "center",
            fontSize: 9,
            fontWeight: 500,
            lineHeight: 1.35,
            letterSpacing: 0,
          }}
        >
          © 2026 DA Information. All rights reserved.
        </p>
      </section>
    </main>
  );
}
