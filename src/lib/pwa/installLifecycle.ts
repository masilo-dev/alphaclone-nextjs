export type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
type InstallOwner = { event: InstallPromptEvent | null; installed: boolean; prompting: boolean; dispose(): void };
type InstallWindow = Window & { __acInstallOwner?: InstallOwner; deferredPrompt?: InstallPromptEvent | null };

/** One page-lifetime owner, also used by the early head bootstrap. No external closures. */
export function installEventOwner(target: InstallWindow): InstallOwner {
  if (target.__acInstallOwner) return target.__acInstallOwner;
  const installed = target.matchMedia('(display-mode: standalone)').matches ||
    (target.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const notify = () => target.dispatchEvent(new Event('ac:install-state'));
  const owner: InstallOwner = { event: null, installed, prompting: false, dispose: () => {
    target.removeEventListener('beforeinstallprompt', onPrompt);
    target.removeEventListener('appinstalled', onInstalled);
    owner.event = null; target.deferredPrompt = null;
    delete target.__acInstallOwner;
  } };
  const onPrompt = (event: Event) => {
    if (owner.installed || owner.prompting) return;
    event.preventDefault();
    owner.event = event as InstallPromptEvent;
    target.deferredPrompt = owner.event;
    notify();
  };
  const onInstalled = () => {
    owner.installed = true; owner.event = null; owner.prompting = false;
    target.deferredPrompt = null; notify();
  };
  target.__acInstallOwner = owner;
  target.addEventListener('beforeinstallprompt', onPrompt);
  target.addEventListener('appinstalled', onInstalled);
  return owner;
}
export function buildInstallBootstrapScript(): string {
  return `(${installEventOwner.toString()})(window);`;
}
export async function promptCapturedInstall(target: InstallWindow): Promise<{ success: boolean; outcome: string }> {
  const owner = installEventOwner(target);
  if (owner.installed || owner.prompting || !owner.event) return { success: false, outcome: 'unavailable' };
  const event = owner.event;
  // Consume before awaiting: concurrent clicks cannot reuse the browser event.
  owner.event = null; target.deferredPrompt = null; owner.prompting = true;
  target.dispatchEvent(new Event('ac:install-state'));
  try {
    await event.prompt(); // Called directly from the existing user click handler.
    const choice = await event.userChoice;
    return { success: choice.outcome === 'accepted', outcome: choice.outcome };
  } catch {
    return { success: false, outcome: 'unavailable' };
  } finally {
    owner.prompting = false;
    target.dispatchEvent(new Event('ac:install-state'));
  }
}
