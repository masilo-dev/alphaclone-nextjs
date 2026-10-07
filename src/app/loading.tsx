export default function GlobalLoading() {
  return (
    <main className="ac-route-loading min-h-screen bg-[var(--background-app)] text-[var(--text-primary)] flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--brand-blue-500)] border-t-transparent" />
        <p className="text-sm text-[var(--text-secondary)]">Loading page...</p>
      </div>
    </main>
  );
}
