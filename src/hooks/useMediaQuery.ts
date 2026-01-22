import { useState, useEffect } from 'react';

/**
 * Custom hook for responsive design media queries
 * @param query CSS media query string (e.g. '(max-width: 768px)')
 * @returns boolean indicating if query matches
 */
export function useMediaQuery(query: string): boolean {
    // Initialize with false on server, check window on client
    const [matches, setMatches] = useState<boolean>(false);

    useEffect(() => {
        // Safe check for SSR
        if (typeof window === 'undefined') return;

        const media = window.matchMedia(query);

        // Set initial value
        setMatches(media.matches);

        // Define listener
        const listener = (event: MediaQueryListEvent) => {
            setMatches(event.matches);
        };

        // Add listener
        media.addEventListener('change', listener);

        // Cleanup
        return () => {
            media.removeEventListener('change', listener);
        };
    }, [query]);

    return matches;
}
