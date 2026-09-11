/**
 * Bonnie deep-link helpers — parse and build dashboard URLs with record focus.
 */

export type BonnieDeepLinkTarget = {
  route: string;
  label?: string;
  tab?: string;
  focus?: string;
  recordId?: string;
  workflowId?: string;
  filter?: string;
  reason?: string;
};

export function buildBonnieDeepLink(target: BonnieDeepLinkTarget): string {
  const base = target.route.split('?')[0];
  const params = new URLSearchParams();
  if (target.tab) params.set('tab', target.tab);
  if (target.focus) params.set('focus', target.focus);
  if (target.recordId) params.set('id', target.recordId);
  if (target.workflowId) params.set('workflow', target.workflowId);
  if (target.filter) params.set('filter', target.filter);
  if (target.reason) params.set('bonnieReason', target.reason.slice(0, 240));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function parseBonnieDeepLink(path: unknown): BonnieDeepLinkTarget | null {
  if (!path) return null;

  if (typeof path === 'string') {
    try {
      const url = path.startsWith('http')
        ? new URL(path)
        : new URL(path, 'https://app.local');
      return {
        route: `${url.pathname}${url.search}`,
        tab: url.searchParams.get('tab') || undefined,
        focus: url.searchParams.get('focus') || undefined,
        recordId: url.searchParams.get('id') || undefined,
        workflowId: url.searchParams.get('workflow') || undefined,
        filter: url.searchParams.get('filter') || undefined,
        reason: url.searchParams.get('bonnieReason') || undefined,
      };
    } catch {
      return { route: path };
    }
  }

  if (typeof path === 'object' && path !== null && 'route' in path) {
    const obj = path as BonnieDeepLinkTarget;
    return {
      route: buildBonnieDeepLink(obj),
      label: obj.label,
      tab: obj.tab,
      focus: obj.focus,
      recordId: obj.recordId,
      workflowId: obj.workflowId,
      filter: obj.filter,
      reason: obj.reason,
    };
  }

  return null;
}

export function normalizeBonnieNavPath(path: unknown): string | null {
  const parsed = parseBonnieDeepLink(path);
  if (!parsed?.route) return null;
  return parsed.route.startsWith('/dashboard') ? parsed.route : null;
}
