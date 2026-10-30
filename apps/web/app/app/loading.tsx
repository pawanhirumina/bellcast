export default function AppLoading() {
  return (
    <div className="px-4 py-4 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="flex gap-3">
            <div className="h-9 w-9 shrink-0 animate-skeleton rounded bg-raised" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 w-32 animate-skeleton rounded bg-raised" />
              <div className="h-3 w-full max-w-lg animate-skeleton rounded bg-raised" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
