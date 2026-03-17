import { TYPOGRAPHY, SPACING, COLORS } from '../constants/design';

/**
 * Utility function to get consistent spacing classes
 */
export function spacing(size: keyof typeof SPACING): string {
    return SPACING[size];
}

/**
 * Utility function to get typography classes
 */
export function typography(variant: keyof typeof TYPOGRAPHY): string {
    return TYPOGRAPHY[variant];
}

/**
 * Utility function to get color values
 */
export function color(path: string): string {
    const parts = path.split('.');
    let value: any = COLORS;

    for (const part of parts) {
        value = value?.[part];
    }

    return value || '';
}

/**
 * Utility to combine class names
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
    return classes.filter(Boolean).join(' ');
}
