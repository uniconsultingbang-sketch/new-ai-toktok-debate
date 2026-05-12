"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white"
    >
      PDF 저장
    </button>
  );
}
