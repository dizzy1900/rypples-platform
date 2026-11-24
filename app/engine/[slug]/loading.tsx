export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-[1260px] flex-col gap-8 px-10 pb-16 pt-9 max-sm:px-5" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-48 skeleton-line" />
      <div className="flex flex-col gap-3">
        <div className="h-3 w-24 skeleton-line" />
        <div className="h-10 w-2/3 skeleton-line" />
        <div className="h-4 w-1/2 skeleton-line" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-3">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-4 w-full skeleton-line" />)}</div>
        <div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <div key={i} className="h-4 w-full skeleton-line" />)}</div>
      </div>
    </div>
  );
}
