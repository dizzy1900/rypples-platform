"use client";
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-[1260px] flex-col items-start gap-4 px-10 py-16 max-sm:px-5">
      <h1 className="h1">Something went wrong loading this page</h1>
      <span className="h1-rule" />
      <button type="button" onClick={reset} className="mt-4 rounded-btn border border-lime-30 bg-surface px-4 py-2 text-[13px] font-medium text-ink">
        Try again
      </button>
    </div>
  );
}
