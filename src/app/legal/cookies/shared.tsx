'use client';

export function CookiePolicyContent() {
  const openPrefs = () => window.dispatchEvent(new Event('ac:open-cookie-preferences'));

  return (
    <>
      <section id="what-are-cookies" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">What cookies are</h2>
        <p className="text-sm leading-7 text-slate-300">Cookies are small files stored in your browser that help websites remember your session and preferences.</p>
      </section>

      <section id="cookies-we-use" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Cookies we use</h2>
        <ul className="space-y-2 text-sm leading-7 text-slate-300">
          <li>Essential: Supabase auth sessions and CSRF tokens.</li>
          <li>Functional: layout, language, and dashboard preferences.</li>
          <li>Analytics: anonymous usage metrics that can be opted out of.</li>
          <li>Third-party: Google, Microsoft, Meta, LinkedIn, and Stripe session cookies when you use those integrations.</li>
          <li>We do not use advertising cookies for ad targeting.</li>
        </ul>
      </section>

      <section id="controls" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">How to control them</h2>
        <p className="text-sm leading-7 text-slate-300">Use your browser settings or our preference controls. Essential cookies cannot be disabled.</p>
        <button
          type="button"
          onClick={openPrefs}
          className="inline-flex items-center rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400"
        >
          Manage Cookie Preferences
        </button>
      </section>

      <section id="table" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Cookie table</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead className="bg-slate-900/60 text-slate-300">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Purpose</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Opt-out?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-950">
              {[
                ['sb-auth-token', 'Essential', 'Supabase auth', 'Session', 'No'],
                ['csrf_token', 'Essential', 'Security', 'Session', 'No'],
                ['user_prefs', 'Functional', 'UI preferences', '1 year', 'Yes'],
                ['_ga', 'Analytics', 'Usage stats', '2 years', 'Yes'],
              ].map(([name, type, purpose, duration, optOut]) => (
                <tr key={name}>
                  <td className="px-4 py-3 font-mono text-teal-300">{name}</td>
                  <td className="px-4 py-3">{type}</td>
                  <td className="px-4 py-3">{purpose}</td>
                  <td className="px-4 py-3">{duration}</td>
                  <td className="px-4 py-3">{optOut}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="contact" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-semibold text-white">Contact</h2>
        <p className="text-sm leading-7 text-slate-300">Questions about cookies can be sent to legal@alphaclonesystems.com.</p>
      </section>
    </>
  );
}
