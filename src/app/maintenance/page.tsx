export default function MaintenancePage() {
    return (
        <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6">
            <section className="max-w-xl w-full text-center border border-slate-800 rounded-2xl bg-slate-900/70 p-8">
                <h1 className="text-3xl font-bold mb-4">Scheduled Maintenance</h1>
                <p className="text-slate-300 mb-3">
                    The platform is temporarily unavailable while critical updates are applied.
                </p>
                <p className="text-slate-500 text-sm">
                    Please try again shortly.
                </p>
            </section>
        </main>
    );
}
