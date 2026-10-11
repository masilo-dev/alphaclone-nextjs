'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface PanelConstraints {
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
}

export interface MultiPanelWorkspaceOptions {
  namespace: string;
  panel1Constraints?: Partial<PanelConstraints>;
  panel3Constraints?: Partial<PanelConstraints>;
  defaultPanel1Collapsed?: boolean;
  defaultPanel3Collapsed?: boolean;
  minPrimaryWidth?: number;
}

export type ActiveMobilePanel = 'nav' | 'primary' | 'context';

export interface MultiPanelWorkspaceState {
  // Widths (in pixels)
  panel1Width: number;
  panel3Width: number;
  // Collapse state
  panel1Collapsed: boolean;
  panel3Collapsed: boolean;
  // Dragging state
  activeResizingPanel: 1 | 3 | null;
  // Responsive mode
  containerWidth: number;
  isMobile: boolean;       // < 768px
  isTablet: boolean;       // 768px - 1023px
  isLaptop: boolean;       // 1024px - 1439px
  isDesktop: boolean;      // >= 1440px
  // Mobile active panel
  activeMobilePanel: ActiveMobilePanel;
  setActiveMobilePanel: (panel: ActiveMobilePanel) => void;
  // Actions
  setPanel1Width: (width: number) => void;
  setPanel3Width: (width: number) => void;
  togglePanel1: () => void;
  togglePanel3: () => void;
  setPanel1Collapsed: (collapsed: boolean) => void;
  setPanel3Collapsed: (collapsed: boolean) => void;
  resetPanel1Width: () => void;
  resetPanel3Width: () => void;
  // Splitter drag binders
  getSplitterProps: (panelIndex: 1 | 3) => {
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onDoubleClick: () => void;
    role: 'separator';
    'aria-orientation': 'vertical';
    'aria-valuenow': number;
    'aria-valuemin': number;
    'aria-valuemax': number;
    'aria-label': string;
    tabIndex: number;
  };
  // Container ref
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const DEFAULT_PANEL1_CONSTRAINTS: PanelConstraints = {
  defaultWidth: 280,
  minWidth: 200,
  maxWidth: 440,
};

const DEFAULT_PANEL3_CONSTRAINTS: PanelConstraints = {
  defaultWidth: 340,
  minWidth: 260,
  maxWidth: 540,
};

export function useMultiPanelWorkspace(
  options: MultiPanelWorkspaceOptions
): MultiPanelWorkspaceState {
  const {
    namespace,
    defaultPanel1Collapsed = false,
    defaultPanel3Collapsed = false,
    minPrimaryWidth = 360,
  } = options;

  const panel1Rules: PanelConstraints = {
    ...DEFAULT_PANEL1_CONSTRAINTS,
    ...options.panel1Constraints,
  };

  const panel3Rules: PanelConstraints = {
    ...DEFAULT_PANEL3_CONSTRAINTS,
    ...options.panel3Constraints,
  };

  const storageKey = `ac-workspace-panels-${namespace}`;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1440
  );

  // Load initial state from localStorage if available
  const [panel1Width, setPanel1WidthState] = useState<number>(() => {
    if (typeof window === 'undefined') return panel1Rules.defaultWidth;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.panel1Width === 'number') {
          return Math.max(panel1Rules.minWidth, Math.min(panel1Rules.maxWidth, parsed.panel1Width));
        }
      }
    } catch {
      /* ignore */
    }
    return panel1Rules.defaultWidth;
  });

  const [panel3Width, setPanel3WidthState] = useState<number>(() => {
    if (typeof window === 'undefined') return panel3Rules.defaultWidth;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.panel3Width === 'number') {
          return Math.max(panel3Rules.minWidth, Math.min(panel3Rules.maxWidth, parsed.panel3Width));
        }
      }
    } catch {
      /* ignore */
    }
    return panel3Rules.defaultWidth;
  });

  const [panel1Collapsed, setPanel1CollapsedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultPanel1Collapsed;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.panel1Collapsed === 'boolean') return parsed.panel1Collapsed;
      }
    } catch {
      /* ignore */
    }
    return defaultPanel1Collapsed;
  });

  const [panel3Collapsed, setPanel3CollapsedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultPanel3Collapsed;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.panel3Collapsed === 'boolean') return parsed.panel3Collapsed;
      }
    } catch {
      /* ignore */
    }
    return defaultPanel3Collapsed;
  });

  const [activeMobilePanel, setActiveMobilePanel] = useState<ActiveMobilePanel>('primary');
  const [activeResizingPanel, setActiveResizingPanel] = useState<1 | 3 | null>(null);

  // ResizeObserver on container to track real available width
  useEffect(() => {
    const el = containerRef.current || (typeof document !== 'undefined' ? document.body : null);
    if (!el || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect && entry.contentRect.width > 0) {
          setContainerWidth(Math.round(entry.contentRect.width));
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Save to localStorage (debounced)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const persistState = useCallback(
    (nextState: {
      panel1Width: number;
      panel3Width: number;
      panel1Collapsed: boolean;
      panel3Collapsed: boolean;
    }) => {
      if (typeof window === 'undefined') return;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(nextState));
        } catch {
          /* ignore */
        }
      }, 300);
    },
    [storageKey]
  );

  const setPanel1Width = useCallback(
    (w: number) => {
      const clamped = Math.max(panel1Rules.minWidth, Math.min(panel1Rules.maxWidth, w));
      setPanel1WidthState(clamped);
      persistState({
        panel1Width: clamped,
        panel3Width,
        panel1Collapsed,
        panel3Collapsed,
      });
    },
    [panel1Rules, panel3Width, panel1Collapsed, panel3Collapsed, persistState]
  );

  const setPanel3Width = useCallback(
    (w: number) => {
      const clamped = Math.max(panel3Rules.minWidth, Math.min(panel3Rules.maxWidth, w));
      setPanel3WidthState(clamped);
      persistState({
        panel1Width,
        panel3Width: clamped,
        panel1Collapsed,
        panel3Collapsed,
      });
    },
    [panel3Rules, panel1Width, panel1Collapsed, panel3Collapsed, persistState]
  );

  const setPanel1Collapsed = useCallback(
    (collapsed: boolean) => {
      setPanel1CollapsedState(collapsed);
      persistState({
        panel1Width,
        panel3Width,
        panel1Collapsed: collapsed,
        panel3Collapsed,
      });
    },
    [panel1Width, panel3Width, panel3Collapsed, persistState]
  );

  const setPanel3Collapsed = useCallback(
    (collapsed: boolean) => {
      setPanel3CollapsedState(collapsed);
      persistState({
        panel1Width,
        panel3Width,
        panel1Collapsed,
        panel3Collapsed: collapsed,
      });
    },
    [panel1Width, panel3Width, panel1Collapsed, persistState]
  );

  const togglePanel1 = useCallback(() => {
    setPanel1Collapsed(!panel1Collapsed);
  }, [panel1Collapsed, setPanel1Collapsed]);

  const togglePanel3 = useCallback(() => {
    setPanel3Collapsed(!panel3Collapsed);
  }, [panel3Collapsed, setPanel3Collapsed]);

  const resetPanel1Width = useCallback(() => {
    setPanel1Width(panel1Rules.defaultWidth);
  }, [panel1Rules.defaultWidth, setPanel1Width]);

  const resetPanel3Width = useCallback(() => {
    setPanel3Width(panel3Rules.defaultWidth);
  }, [panel3Rules.defaultWidth, setPanel3Width]);

  // Mouse & Touch Dragging
  const startDrag = useCallback(
    (panelIndex: 1 | 3, clientX: number) => {
      setActiveResizingPanel(panelIndex);
      const startX = clientX;
      const initialPanel1 = panel1Width;
      const initialPanel3 = panel3Width;
      const totalWidth = containerRef.current?.getBoundingClientRect().width || window.innerWidth;

      const handleMove = (currentX: number) => {
        const delta = currentX - startX;
        if (panelIndex === 1) {
          const nextWidth = Math.max(
            panel1Rules.minWidth,
            Math.min(
              panel1Rules.maxWidth,
              Math.min(
                initialPanel1 + delta,
                totalWidth - (panel3Collapsed ? 0 : panel3Width) - minPrimaryWidth
              )
            )
          );
          setPanel1WidthState(nextWidth);
        } else {
          // Panel 3 is resized from the left of Panel 3, so dragging left (negative delta) increases its width
          const nextWidth = Math.max(
            panel3Rules.minWidth,
            Math.min(
              panel3Rules.maxWidth,
              Math.min(
                initialPanel3 - delta,
                totalWidth - (panel1Collapsed ? 0 : panel1Width) - minPrimaryWidth
              )
            )
          );
          setPanel3WidthState(nextWidth);
        }
      };

      const onMouseMove = (e: MouseEvent) => {
        e.preventDefault();
        handleMove(e.clientX);
      };

      const onTouchMove = (e: TouchEvent) => {
        if (e.touches[0]) {
          handleMove(e.touches[0].clientX);
        }
      };

      const onEnd = () => {
        setActiveResizingPanel(null);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onEnd);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onEnd);
        document.removeEventListener('touchcancel', onEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onEnd);
      document.addEventListener('touchmove', onTouchMove, { passive: true });
      document.addEventListener('touchend', onEnd);
      document.addEventListener('touchcancel', onEnd);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [
      panel1Width,
      panel3Width,
      panel1Rules,
      panel3Rules,
      panel1Collapsed,
      panel3Collapsed,
      minPrimaryWidth,
    ]
  );

  const getSplitterProps = useCallback(
    (panelIndex: 1 | 3) => {
      const isPanel1 = panelIndex === 1;
      const currentWidth = isPanel1 ? panel1Width : panel3Width;
      const rules = isPanel1 ? panel1Rules : panel3Rules;

      return {
        onMouseDown: (e: React.MouseEvent) => {
          e.preventDefault();
          startDrag(panelIndex, e.clientX);
        },
        onTouchStart: (e: React.TouchEvent) => {
          if (e.touches[0]) {
            startDrag(panelIndex, e.touches[0].clientX);
          }
        },
        onKeyDown: (e: React.KeyboardEvent) => {
          const step = e.shiftKey ? 25 : 10;
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (isPanel1) {
              setPanel1Width(panel1Width - step);
            } else {
              setPanel3Width(panel3Width + step);
            }
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (isPanel1) {
              setPanel1Width(panel1Width + step);
            } else {
              setPanel3Width(panel3Width - step);
            }
          } else if (e.key === 'Home') {
            e.preventDefault();
            if (isPanel1) setPanel1Width(rules.minWidth);
            else setPanel3Width(rules.minWidth);
          } else if (e.key === 'End') {
            e.preventDefault();
            if (isPanel1) setPanel1Width(rules.maxWidth);
            else setPanel3Width(rules.maxWidth);
          }
        },
        onDoubleClick: () => {
          if (isPanel1) resetPanel1Width();
          else resetPanel3Width();
        },
        role: 'separator' as const,
        'aria-orientation': 'vertical' as const,
        'aria-valuenow': currentWidth,
        'aria-valuemin': rules.minWidth,
        'aria-valuemax': rules.maxWidth,
        'aria-label': isPanel1 ? 'Resize Navigation Panel' : 'Resize Context Details Panel',
        tabIndex: 0,
      };
    },
    [
      panel1Width,
      panel3Width,
      panel1Rules,
      panel3Rules,
      startDrag,
      setPanel1Width,
      setPanel3Width,
      resetPanel1Width,
      resetPanel3Width,
    ]
  );

  const isMobile = containerWidth < 768;
  const isTablet = containerWidth >= 768 && containerWidth < 1024;
  const isLaptop = containerWidth >= 1024 && containerWidth < 1440;
  const isDesktop = containerWidth >= 1440;

  return {
    panel1Width,
    panel3Width,
    panel1Collapsed,
    panel3Collapsed,
    activeResizingPanel,
    containerWidth,
    isMobile,
    isTablet,
    isLaptop,
    isDesktop,
    activeMobilePanel,
    setActiveMobilePanel,
    setPanel1Width,
    setPanel3Width,
    togglePanel1,
    togglePanel3,
    setPanel1Collapsed,
    setPanel3Collapsed,
    resetPanel1Width,
    resetPanel3Width,
    getSplitterProps,
    containerRef,
  };
}

export default useMultiPanelWorkspace;
