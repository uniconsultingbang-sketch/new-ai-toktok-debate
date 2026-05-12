"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const SESSION_DISMISSED_KEY = "aiToktokInstallPromptDismissed";
const INSTALLED_KEY = "aiToktokInstalled";

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(platform);
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const installed = window.localStorage.getItem(INSTALLED_KEY) === "1";
    const dismissed = window.sessionStorage.getItem(SESSION_DISMISSED_KEY) === "1";
    const standalone = isStandaloneDisplay();
    const ios = isIosDevice();

    setIsIos(ios);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    if (standalone || installed || dismissed) return;

    if (ios) {
      const timer = window.setTimeout(() => setShowPrompt(true), 900);
      return () => window.clearTimeout(timer);
    }

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    const handleInstalled = () => {
      window.localStorage.setItem(INSTALLED_KEY, "1");
      setShowPrompt(false);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  function closePrompt() {
    window.sessionStorage.setItem(SESSION_DISMISSED_KEY, "1");
    setShowPrompt(false);
  }

  async function installApp() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;

    if (choice.outcome === "accepted") {
      window.localStorage.setItem(INSTALLED_KEY, "1");
    } else {
      window.sessionStorage.setItem(SESSION_DISMISSED_KEY, "1");
    }

    setShowPrompt(false);
    setInstallEvent(null);
  }

  if (!showPrompt || (!installEvent && !isIos)) return null;

  return (
    <div className="pwa-install-backdrop" role="dialog" aria-modal="true" aria-labelledby="pwa-install-title">
      <section className="pwa-install-card">
        <button type="button" className="pwa-install-close" onClick={closePrompt} aria-label="설치 안내 닫기">
          <X className="size-4" />
        </button>
        <img src="/images/ai-toktok-icon-192.png" alt="" className="pwa-install-icon" draggable={false} />
        <p className="pwa-install-eyebrow">앱처럼 바로 열기</p>
        <h2 id="pwa-install-title">AI 톡톡을 홈 화면에 추가할까요?</h2>
        <p className="pwa-install-copy">주소창 없이 바로 열 수 있어요. 시연할 때도 훨씬 앱처럼 보입니다.</p>

        {isIos ? (
          <div className="pwa-ios-guide">
            <span>
              <Share className="size-4" />
              공유 버튼
            </span>
            <span>홈 화면에 추가</span>
          </div>
        ) : (
          <button type="button" className="pwa-install-action" onClick={installApp}>
            <Download className="size-4" />
            홈 화면에 설치
          </button>
        )}
      </section>
    </div>
  );
}
