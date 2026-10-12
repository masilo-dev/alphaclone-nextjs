/** Bound retained screens to avoid retaining the entire app on mobile devices. */
export function rememberVisitedRoute(routes: string[], route: string, limit = 5): string[] {
  const next = routes.filter(value => value !== route);
  next.push(route);
  return next.slice(-limit);
}
