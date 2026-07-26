# Route health report

Static inventory:

- 588 page/handler routes considered by the route auditor.
- 762 statically detectable internal links.
- 0 customer-facing links pointing directly to localhost.
- 451 potential broken static links requiring runtime classification; this count includes dynamic routes and redirects and is not itself proof of a 404.

Required next evidence is a Playwright crawl against a controlled environment for anonymous, member, workspace-admin, and platform-admin roles.
