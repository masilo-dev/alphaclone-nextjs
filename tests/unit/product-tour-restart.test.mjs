/**
 * Regression: pressing "Platform tour" did nothing.
 *
 * Two causes, both guarded here:
 *  1. When no tour anchor was visible the tour set run=false but never told the
 *     parent, so `isOpen` stayed true and every later `setShowProductTour(true)`
 *     was a no-op. The tour must now hand control back (`onUnavailable`) and
 *     explain itself, and parents must remount it (key) on every press.
 *  2. Only the first step had `disableBeacon`, so after "Next" the following
 *     steps rendered a tiny beacon instead of a tooltip.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.resolve(here, rel), 'utf8');

const tour = read('../../src/components/onboarding/ProductTour.tsx');
const parents = {
  'BusinessDashboard.tsx': read('../../src/components/dashboard/business/BusinessDashboard.tsx'),
  'Dashboard.tsx': read('../../src/components/Dashboard.tsx'),
};

describe('ProductTour can always be (re)started', () => {
  it('hands control back to the parent when no anchor is on screen', () => {
    assert.match(tour, /onUnavailable\?: \(\) => void/);
    assert.match(tour, /\(onUnavailable \?\? onComplete\)\(\)/, 'must never leave isOpen stuck true');
    assert.match(tour, /toast\(t\('The tour is not available on this screen/, 'must explain why nothing opened');
  });

  it('shows every step tooltip immediately (no beacon-only steps)', () => {
    const matches = tour.match(/disableBeacon: true/g) ?? [];
    assert.match(tour, /\{ \.\.\.step, target, placement, disableBeacon: true \}/);
    assert.ok(matches.length >= 2, 'mounted steps must force disableBeacon');
  });

  it('never scrolls the window (the app shell scrolls internally; window scroll blanks the page)', () => {
    // Verified live on alphaclonesystems.com: with scrollToFirstStep Joyride
    // scrolled <html> to 1912px and the whole dashboard vanished above the fold.
    assert.doesNotMatch(tour, /scrollToFirstStep/);
    assert.match(tour, /\n\s+disableScrolling\n/);
    assert.match(tour, /function resetWindowScroll\(\)/);
    assert.match(tour, /window\.addEventListener\('scroll', resetWindowScroll/);
    const resets = tour.match(/resetWindowScroll\(\);/g) ?? [];
    assert.ok(resets.length >= 3, 'must reset scroll on complete, unavailable and unmount');
  });

  it('turns whole-page anchors into centred cards instead of pointing below the fold', () => {
    assert.match(tour, /function isOversizedAnchor\(element: HTMLElement\)/);
    assert.match(tour, /rect\.height > window\.innerHeight \|\| rect\.width > window\.innerWidth/);
    assert.match(tour, /isOversizedAnchor\(target\) \? 'center' : step\.placement/);
  });

  for (const [name, source] of Object.entries(parents)) {
    it(`${name} remounts the tour on every explicit press and resets when unavailable`, () => {
      assert.match(source, /const \[tourRunId, setTourRunId\] = useState\(0\)/);
      assert.match(source, /setTourRunId\(\(id\) => id \+ 1\);\s*setShowProductTour\(true\);/);
      assert.match(source, /onStartTour=\{requestProductTour\}/, 'sidebar button must use requestProductTour');
      assert.match(source, /addEventListener\(PLATFORM_TOUR_EVENT, requestProductTour\)/);
      assert.match(source, /<ProductTour\s+key=\{tourRunId\}/);
      assert.match(source, /onUnavailable=\{dismissUnavailableTour\}/);
      assert.doesNotMatch(source, /onStartTour=\{\(\) => setShowProductTour\(true\)\}/);
    });
  }
});
