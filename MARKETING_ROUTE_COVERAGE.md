# Marketing Route Coverage

The shared atmosphere is mounted by `MarketingShell`, which is used by the home page and the indexable landing-page shell. Current adopters include CRM, leads, projects, AI agents, ecosystem, pricing, about, contact, docs, guide, FAQ, blog, results, security, status, compliance, marketing feature pages, and solution pages. Legal pages use the same shell through `LegalMarketingShell`.

Header and footer destinations are checked against physical App Router pages by `tests/unit/marketing-atmosphere.test.mjs`; the test now fails when a target is absent instead of silently filtering it out. Dynamic transactional routes and focused application/auth screens intentionally retain their own shells.

Unknown paths retain `src/app/not-found.tsx` and now render inside the shared marketing shell with working home, product, and contact actions. No wildcard homepage redirect was introduced. Hash links remain native links, and browser history, deep links, new-tab behavior, prefetching, and scroll restoration are unchanged.
