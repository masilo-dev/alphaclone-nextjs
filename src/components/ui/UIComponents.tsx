import { Button as CanonicalButton } from './button';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useBlurValidation } from '@/hooks/useBlurValidation';
import { X, ChevronDown, MoreVertical } from 'lucide-react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { WORKSPACE, Z_INDEX } from '@/constants/design';
import { useLanguage } from '@/contexts/LanguageContext';

// --- Button ---
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | 'primary'
    | 'secondary'
    | 'outline'
    | 'ghost'
    | 'danger'
    | 'destructive'
    | 'icon'
    | 'navigation'
    | 'cta'
    | 'default';
  size?: 'sm' | 'md' | 'lg' | 'icon' | 'default';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  children, variant = 'primary', size = 'md', ...props
}, ref) => {
  const { t } = useLanguage();
  return (
    <CanonicalButton ref={ref} variant={variant === 'default' ? 'primary' : variant} size={size} {...props}>
      {typeof children === 'string' ? t(children) : children}
    </CanonicalButton>
  );
});
Button.displayName = 'Button';

// --- Card ---
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  hoverEffect = false,
  onClick,
  onKeyDown,
  role,
  tabIndex,
  ...props
}) => {
  const isClickable = Boolean(onClick);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick?.(e as any);
    }
    onKeyDown?.(e);
  };

  return (
    <div
      role={role || (isClickable ? 'button' : undefined)}
      tabIndex={tabIndex ?? (isClickable ? 0 : undefined)}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-3.5 sm:p-4 md:p-4.5 ${
        hoverEffect || isClickable
          ? 'hover:bg-[var(--ws-hover)] transition-all duration-200 hover:border-[var(--ws-border-strong)]'
          : ''
      } ${isClickable ? 'cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring,var(--brand-blue-500))]' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};


// --- Badge ---
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'neutral' | 'error' | 'blue' | 'default' | 'secondary' | 'outline';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', className = '' }) => {
  const { t } = useLanguage();
  const renderedChildren = typeof children === 'string' ? t(children) : children;

  const variants: Record<string, string> = {
    success: "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)] border-[color-mix(in_srgb,var(--success)_28%,transparent)]",
    warning: "bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-[var(--warning)] border-[color-mix(in_srgb,var(--warning)_28%,transparent)]",
    neutral: "bg-[var(--ws-surface-secondary,var(--surface-secondary))] text-[var(--ws-text-secondary,var(--text-secondary))] border-[var(--ws-border,var(--border-default))]",
    error: "bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)] border-[color-mix(in_srgb,var(--danger)_28%,transparent)]",
    blue: "bg-[color-mix(in_srgb,var(--info)_12%,transparent)] text-[var(--info)] border-[color-mix(in_srgb,var(--info)_28%,transparent)]",
    default: "bg-[color-mix(in_srgb,var(--info)_12%,transparent)] text-[var(--info)] border-[color-mix(in_srgb,var(--info)_28%,transparent)]",
    secondary: "bg-[var(--ws-surface-secondary,var(--surface-secondary))] text-[var(--ws-text-secondary,var(--text-secondary))] border-[var(--ws-border,var(--border-default))]",
    outline: "bg-transparent text-[var(--ws-text-secondary,var(--text-secondary))] border-[var(--ws-border,var(--border-default))]",
  };

  const resolvedClass = variants[variant] || variants.neutral;

  return (
    <span className={`inline-flex items-center min-h-6 px-2.5 py-0.5 rounded-full type-caption font-semibold border whitespace-nowrap ${resolvedClass} ${className}`}>
      {renderedChildren}
    </span>
  );
};

// --- Input ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  textarea?: boolean;
  icon?: React.ReactNode;
  /** Runs on blur (debounced); sets error when validation fails */
  validate?: (value: string) => string | undefined;
}

export const Input: React.FC<InputProps> = ({
  label,
  error: errorProp,
  hint,
  icon,
  className = '',
  textarea = false,
  validate,
  value,
  defaultValue,
  onBlur,
  onChange,
  id: idProp,
  ...props
}) => {
  const generatedId = React.useId();
  const fieldId = idProp || generatedId;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(String(defaultValue ?? ''));
  const fieldValue = isControlled ? String(value) : internalValue;
  const validateFn = useCallback(
    (v: string) => validate?.(v),
    [validate]
  );
  const blurValidation = useBlurValidation(fieldValue, validateFn);
  const error = errorProp ?? (validate ? blurValidation.error : undefined);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!isControlled) setInternalValue(e.target.value);
    onChange?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (validate) blurValidation.onBlur();
    onBlur?.(e);
  };

  const fieldProps = validate || isControlled
    ? { value: fieldValue, onChange: handleChange, onBlur: handleBlur }
    : { defaultValue, onBlur, onChange, ...props };

  const describedBy = [
    error ? errorId : null,
    !error && hint ? hintId : null,
  ].filter(Boolean).join(' ') || undefined;

  const baseInputClass = `w-full bg-[var(--ws-surface-primary,var(--surface-primary))] border ${
    error ? 'border-[var(--danger)]' : 'border-[var(--ws-border,var(--border-default))]'
  } rounded-[8px] px-3 py-1.5 sm:py-2 type-ui leading-normal text-[var(--ws-text-primary,var(--text-primary))] placeholder:text-[var(--ws-text-tertiary,var(--text-muted))] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--ac-accent)] transition-colors ${
    icon ? 'pl-9' : ''
  } ${className}`;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={fieldId} className="block type-caption font-medium text-[var(--ws-text-secondary,var(--text-secondary))] mb-1.5">{label}</label>
      )}
      <div className="relative group">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ws-text-muted,var(--text-muted))] group-focus-within:text-[var(--interactive-secondary)] transition-colors pointer-events-none" aria-hidden="true">
            {icon}
          </div>
        )}
        {textarea ? (
          <textarea
            id={fieldId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`${baseInputClass} min-h-[80px] resize-y`}
            {...(validate || isControlled
              ? { ...props, ...fieldProps }
              : fieldProps as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            id={fieldId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`${baseInputClass} min-h-11`}
            {...(validate || isControlled
              ? { ...props, ...fieldProps }
              : fieldProps as React.InputHTMLAttributes<HTMLInputElement>)}
          />
        )}
      </div>
      {error && <p id={errorId} role="alert" className="mt-1 type-card-description text-[var(--danger)]">{error}</p>}
      {!error && hint && (
        <p id={hintId} className="mt-1 type-card-description text-[var(--text-muted)]">{hint}</p>
      )}
    </div>
  );
};

// --- Modal ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  maxWidth?: string;
  containerClassName?: string;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  title,
  maxWidth = 'max-w-md',
  containerClassName = '',
  className = ''
}) => {
  const { t } = useLanguage();
  const renderedTitle = title ? t(title) : undefined;
  const titleId = React.useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const getFocusable = () => Array.from(panel?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    ) || []).filter((element) => element.getClientRects().length > 0);
    (getFocusable()[0] || panel)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = getFocusable();
      if (!items.length) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (!panel.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? lastEl : firstEl).focus();
      } else if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className={`fixed inset-0 ac-layer-modal flex items-end sm:items-center justify-center px-0 sm:px-4 pt-safe pb-safe ${containerClassName}`}>
      <div className="absolute inset-0 bg-[var(--ws-canvas)]/80 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : t('Dialog')}
        style={{ backgroundColor: 'var(--surface-primary, var(--ws-panel))' }}
        className={`relative ${WORKSPACE.panel.base} rounded-t-2xl sm:rounded-xl w-full ${maxWidth} shadow-none animate-fade-in overflow-hidden max-h-[92dvh] sm:max-h-[85vh] flex flex-col ${className}`}
      >
        <div className="flex items-center justify-between p-3 sm:p-3.5 border-b border-[var(--ws-border)] flex-shrink-0">
          <h3 id={titleId} className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">{renderedTitle}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close dialog')}
            className={`text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-2 min-h-11 min-w-11 hover:bg-[var(--surface-hover)] ${WORKSPACE.panel.radius}`}
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 p-3 sm:p-3.5 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

// --- Card Subcomponents ---
export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => (
  <div className={`p-3.5 pb-1.5 sm:p-4 sm:pb-2 ${className}`} {...props} />
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className = '', ...props }) => (
  <h3 className={`font-semibold leading-none tracking-tight text-[var(--text-primary)] ${className}`} {...props} />
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => (
  <div className={`p-3.5 pt-0 sm:p-4 sm:pt-0 ${className}`} {...props} />
);

// --- Avatar ---
export const Avatar: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => (
  <div className={`relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full ${className}`} {...props} />
);

export const AvatarImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = ({ className = '', src, alt, ...props }) => {
  const imageProps = props as Omit<React.ComponentProps<typeof Image>, 'src' | 'alt' | 'fill'>;
  const imageSrc = typeof src === 'string' ? src : undefined;

  return imageSrc ? (
    <Image
      {...imageProps}
      src={imageSrc}
      alt={alt || ''}
      fill
      className={`object-cover ${className}`}
    />
  ) : null;
};

export const AvatarFallback: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => (
  <div className={`flex h-full w-full items-center justify-center rounded-full bg-[var(--ws-surface-secondary)] text-[var(--ws-text-muted,var(--ws-text-muted))] border border-[var(--ws-border)] type-caption font-semibold ${className}`} {...props} />
);

// --- Table (enterprise: sticky header, alternating rows via ac-data-table) ---
export const Table: React.FC<React.HTMLAttributes<HTMLTableElement>> = ({ className = '', ...props }) => (
  <div className="relative w-full overflow-x-auto ac-scroll-full">
    <table className={`ac-data-table w-full caption-bottom type-ui text-left ${className}`} {...props} />
  </div>
);

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className = '', ...props }) => (
  <thead className={`[&_tr]:border-b [&_tr]:border-[var(--ws-border)] ${className}`} {...props} />
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className = '', ...props }) => (
  <tbody className={`[&_tr:last-child]:border-0 ${className}`} {...props} />
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ className = '', ...props }) => (
  <tr className={`border-b border-[var(--ws-border)] transition-colors hover:bg-[var(--ws-hover)] data-[state=selected]:bg-[var(--ws-active)] ${className}`} {...props} />
);

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ className = '', children, ...props }) => {
  const { t } = useLanguage();
  const renderedChildren = typeof children === 'string' ? t(children) : children;
  return (
    <th className={`h-11 px-4 text-left align-middle font-semibold type-caption tracking-wider uppercase text-[var(--ws-text-muted)] [&:has([role=checkbox])]:pr-0 ${className}`} {...props}>
      {renderedChildren}
    </th>
  );
};

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ className = '', ...props }) => (
  <td className={`px-4 py-3 align-middle type-table-cell text-[var(--ws-text-primary)] [&:has([role=checkbox])]:pr-0 ${className}`} {...props} />
);

// --- Dropdown ---
interface DropdownItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

interface DropdownProps {
  trigger: React.ReactElement<React.ButtonHTMLAttributes<HTMLButtonElement> & { ref?: React.Ref<HTMLButtonElement> }>;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({ trigger, items, align = 'right', className = '' }) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusedMenuRef = useRef(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const updateMenuPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 192;
    const margin = 8;
    const left = align === 'right'
      ? Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin))
      : Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));
    const menuHeight = Math.min(items.length * 40 + 8, 320);
    const top = rect.bottom + menuHeight + margin <= window.innerHeight
      ? rect.bottom + margin
      : Math.max(margin, rect.top - menuHeight - margin);
    setMenuPosition({ top, left });
  }, [align, items.length]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toggle = () => setIsOpen((prev) => !prev);

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus());
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) focusedMenuRef.current = false;
    if (isOpen && menuPosition && !focusedMenuRef.current) {
      focusedMenuRef.current = true;
      menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }
  }, [isOpen, menuPosition]);

  // A portaled menu must sit above the dialog or sheet that owns its trigger.
  const menuHost = dropdownRef.current?.closest<HTMLElement>(
    '.ac-layer-panel, .ac-layer-modal, .ac-layer-command, .ac-layer-confirm'
  );
  const hostLayer = menuHost ? Number.parseInt(getComputedStyle(menuHost).zIndex, 10) : 0;
  const menuLayer = Math.max(Z_INDEX.dropdown, Number.isFinite(hostLayer) ? hostLayer + 1 : 0);

  const menu = isOpen && menuPosition ? (
    <div
      ref={menuRef}
      aria-label="Actions"
      style={{
        position: 'fixed', top: menuPosition.top, left: menuPosition.left, width: 192,
        maxHeight: 'min(20rem, calc(100vh - 1rem))', zIndex: menuLayer,
        // The menu is portaled to body; copy inherited workspace tokens from
        // its trigger so it retains an opaque surface in both color schemes.
        ...Object.fromEntries(Object.entries({
          '--ws-panel': 'var(--ws-panel)',
          '--ws-border': 'var(--ws-surface-tertiary)',
          '--ws-text-primary': 'var(--marketing-bg-secondary)',
          '--ws-hover': 'var(--ws-panel-hover)',
          '--state-danger': 'var(--error-500)',
        }).map(([token, fallback]) => [
          token,
          typeof window !== 'undefined' && dropdownRef.current
            ? getComputedStyle(dropdownRef.current).getPropertyValue(token).trim() || fallback
            : fallback,
        ])),
      } as React.CSSProperties}
      className={`overflow-y-auto border border-[var(--ws-border)] bg-[var(--ws-panel,var(--ws-panel))] ${WORKSPACE.panel.radius} shadow-xl animate-in fade-in slide-in-from-top-1 duration-150`}
      data-layer="dropdown"
      data-z-index={menuLayer}
    >
      <div className="p-1 space-y-0.5">
        {items.map((item, index) => (
          <button
            key={`${item.label}-${index}`}
            type="button"
            onClick={() => {
              item.onClick();
              setIsOpen(false);
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 sm:py-2 min-h-11 sm:min-h-9 type-ui font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
              item.variant === 'danger'
                ? 'text-[var(--state-danger,var(--error-500))] hover:bg-[color-mix(in_srgb,var(--state-danger,var(--error-500))_10%,transparent)]'
                : 'text-[var(--ws-text-primary)] hover:bg-[var(--ws-hover)]'
            }`}
          >
            {item.icon && <span className="shrink-0">{item.icon}</span>}
            {t(item.label)}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {React.cloneElement(trigger, {
        ref: triggerRef,
        'aria-expanded': isOpen,
        'aria-label': trigger.props['aria-label'] || 'More actions',
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => { trigger.props.onClick?.(event); toggle(); },
        onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => { trigger.props.onKeyDown?.(event); handleTriggerKeyDown(event); },
      })}

      {typeof document !== 'undefined' && menu ? createPortal(menu, document.body) : null}
    </div>
  );
};
