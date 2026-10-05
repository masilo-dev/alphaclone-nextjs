export default function MaintenancePage() {
    return (
        <main className="min-h-screen bg-[var(--ws-canvas)] text-[var(--ws-text-primary)] flex items-center justify-center px-6">
            <section className="max-w-xl w-full text-center border border-[var(--ws-border)] rounded-2xl bg-[var(--ws-panel)]/70 p-8">
                <h1 className="text-3xl font-bold mb-4">Scheduled Maintenance</h1>
                <p className="text-[var(--ws-text-secondary)] mb-3">
                    The platform is temporarily unavailable while critical updates are applied.
                </p>
                <p className="text-[var(--ws-text-muted)] type-card-description">
                    Please try again shortly.
                </p>
            </section>
        </main>
    );
}
