import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <section className="not-found-card">
        <p className="not-found-eyebrow">AI Talk Talk</p>
        <h1>페이지를 찾을 수 없어요.</h1>
        <p>주소가 바뀌었거나, 이전 토론 기록이 브라우저에서 사라졌을 수 있습니다.</p>
        <Link href="/" className="not-found-link">
          홈으로 돌아가기
        </Link>
      </section>
    </main>
  );
}
