/** Routes and window helpers for Bonnie's dedicated workspace (not inline module docks). */

export function resolveBonnieDashboardRoute(pathname?: string | null, role?: string | null): string {
  const onBusinessShell =
    role === 'tenant_admin' ||
    (pathname?.startsWith('/dashboard/business') ?? false);
  return onBusinessShell ? '/dashboard/business/bonnie' : '/dashboard/bonnie';
}

export function buildBonniePopoutUrl(contextPath?: string | null): string {
  const params = new URLSearchParams();
  if (contextPath) params.set('from', contextPath);
  const qs = params.toString();
  return qs ? `/bonnie/workspace?${qs}` : '/bonnie/workspace';
}

const POPOUT_FEATURES = 'popup=yes,width=1120,height=820,menubar=no,toolbar=no,location=no,status=no';

export function openBonniePopoutWindow(contextPath?: string | null): Window | null {
  if (typeof window === 'undefined') return null;
  const url = buildBonniePopoutUrl(contextPath);
  return window.open(url, 'bonnie-workspace', POPOUT_FEATURES);
}
