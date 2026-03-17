import { format, isValid } from 'date-fns';

/**
 * Safely format a date, returning a fallback string if the date is invalid.
 * Prevents "Invalid time value" crashes in React components.
 */
export const safeFormat = (
    date: Date | string | number | null | undefined,
    formatStr: string,
    fallback: string = 'N/A'
): string => {
    if (!date) return fallback;

    const d = new Date(date);
    if (!isValid(d)) return fallback;

    try {
        return format(d, formatStr);
    } catch (err) {
        console.error('[safeFormat] Error formatting date:', err);
        return fallback;
    }
};
