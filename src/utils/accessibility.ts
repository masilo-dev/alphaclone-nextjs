/**
 * Accessibility Utilities
 * WCAG 2.1 AA compliance helpers
 */

/**
 * Check color contrast ratio
 * WCAG AA requires 4.5:1 for normal text, 3:1 for large text
 */
export function getContrastRatio(color1: string, color2: string): number {
    const getLuminance = (color: string): number => {
        const rgb = hexToRgb(color);
        if (!rgb) return 0;

        const values = [rgb.r, rgb.g, rgb.b].map((val) => {
            if (val === undefined) return 0;
            const normalized = val / 255;
            return normalized <= 0.03928 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
        });

        const r = values[0] ?? 0;
        const g = values[1] ?? 0;
        const b = values[2] ?? 0;

        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const l1 = getLuminance(color1);
    const l2 = getLuminance(color2);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if color combination meets WCAG AA
 */
export function meetsWCAGAA(
    foreground: string,
    background: string,
    isLargeText: boolean = false
): boolean {
    const ratio = getContrastRatio(foreground, background);
    return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Convert hex to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return null;
    const r = result[1];
    const g = result[2];
    const b = result[3];
    if (!r || !g || !b) return null;
    return {
        r: parseInt(r, 16),
        g: parseInt(g, 16),
        b: parseInt(b, 16),
    };
}

/**
 * Generate accessible focus styles
 */
export function getFocusStyles(): string {
    return `
        focus:outline-none
        focus:ring-2
        focus:ring-teal-500
        focus:ring-offset-2
        focus:ring-offset-slate-950
    `;
}

/**
 * ARIA label generator
 */
export function generateAriaLabel(
    action: string,
    target?: string,
    context?: string
): string {
    let label = action;
    if (target) label += ` ${target}`;
    if (context) label += ` ${context}`;
    return label;
}

/**
 * Keyboard navigation helpers
 */
export const keyboardNavigation = {
    /**
     * Handle Enter key
     */
    onEnter(callback: () => void) {
        return {
            onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    callback();
                }
            },
        };
    },

    /**
     * Handle Escape key
     */
    onEscape(callback: () => void) {
        return {
            onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    callback();
                }
            },
        };
    },

    /**
     * Handle Arrow keys for navigation
     */
    onArrowKeys(
        onUp?: () => void,
        onDown?: () => void,
        onLeft?: () => void,
        onRight?: () => void
    ) {
        return {
            onKeyDown: (e: React.KeyboardEvent) => {
                switch (e.key) {
                    case 'ArrowUp':
                        if (onUp) {
                            e.preventDefault();
                            onUp();
                        }
                        break;
                    case 'ArrowDown':
                        if (onDown) {
                            e.preventDefault();
                            onDown();
                        }
                        break;
                    case 'ArrowLeft':
                        if (onLeft) {
                            e.preventDefault();
                            onLeft();
                        }
                        break;
                    case 'ArrowRight':
                        if (onRight) {
                            e.preventDefault();
                            onRight();
                        }
                        break;
                }
            },
        };
    },
};

/**
 * Screen reader announcements
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;

    document.body.appendChild(announcement);

    setTimeout(() => {
        document.body.removeChild(announcement);
    }, 1000);
}


