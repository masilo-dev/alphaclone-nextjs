/**
 * Launch promo window.
 *
 * During this window, usage-based feature gates that would otherwise show an
 * "upgrade / pay" prompt (e.g. video meeting caps) are waived so the product
 * is fully usable for free. After the window closes, normal plan limits apply
 * again and some features become paid.
 *
 * Launch: June 6, 2026. Free for the first 30 days.
 */
export const LAUNCH_FREE_UNTIL = new Date('2026-07-06T00:00:00Z');

/**
 * True while the free launch window is still open.
 */
export function isLaunchFreeWindow(now: Date = new Date()): boolean {
    return now.getTime() < LAUNCH_FREE_UNTIL.getTime();
}
