import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useBlurValidation } from '@/hooks/useBlurValidation';
import { Loader2, X, ChevronDown, MoreVertical } from 'lucide-react';
import Image from 'next/image';
import { WORKSPACE } from '@/constants/design';

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
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  icon,
  type = 'button',
  ...props
}, ref) => {
  const isActuallyDisabled = Boolean(disabled || isLoading);

  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all select-none touch-manipulation ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring,#356AF4)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background-app,#0C1220)] ' +
    'disabled:cursor-[var(--interactive-disabled-cursor,not-allowed)] disabled:opacity-[var(--interactive-disabled-opacity,0.5)] ' +
    '[&:not(:disabled)]:cursor-[var(--interactive-cursor,pointer)] [&:not(:disabled)]:pointer-events-auto';

  const variants: Record<string, string> = {
    primary: `${WORKSPACE.action.primary} border-0 active:scale-[0.98]`,
    default: `${WORKSPACE.action.primary} border-0 active:scale-[0.98]`,
    secondary: "bg-[var(--interactive-secondary,#4199A4)] text-white hover:bg-[var(--interactive-secondary-hover,#388A94)] active:scale-[0.98]",
    outline: "border border-[var(--border-default,#282F45)] bg-[var(--surface-primary,#121A2A)] text-[var(--text-primary,#F4F7FC)] hover:bg-[var(--surface-hover,#172133)] active:scale-[0.98]",
    ghost: "text-[var(--text-secondary,#8491A6)] hover:bg-[var(--surface-hover,#172133)] hover:text-[var(--text-primary,#F4F7FC)]",
    danger: "bg-[var(--danger,#EF4444)] text-white hover:brightness-95 active:scale-[0.98]",
    destructive: "bg-[var(--danger,#EF4444)] text-white hover:brightness-95 active:scale-[0.98]",
    icon: "bg-transparent hover:bg-[var(--surface-hover,#172133)] text-[var(--text-secondary,#8491A6)] hover:text-[var(--text-primary,#F4F7FC)]",
    navigation: `${WORKSPACE.nav.item} justify-start`,
    cta: "bg-gradient-to-r from-[#5f8fff] to-[#356af4] text-white shadow-lg hover:brightness-110 active:scale-[0.98]",
  };

  const sizes: Record<string, string> = {
    sm: "h-8 px-3 type-caption min-h-9 min-w-9 rounded-[8px]",
    md: "h-10 px-4 py-2 type-ui min-h-11 min-w-11 rounded-[10px]",
    lg: "h-12 px-6 text-base min-h-12 min-w-12 rounded-[12px]",
    default: "h-10 px-4 py-2 type-ui min-h-11 min-w-11 rounded-[10px]",
    icon: "h-10 w-10 p-0 min-h-10 min-w-10 rounded-[10px]",
  };

  return (
    <button
      ref={ref}
      type={type}
      className={`${baseStyles} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      disabled={isActuallyDisabled}
      aria-busy={isLoading || undefined}
      aria-disabled={isActuallyDisabled || undefined}
      {...props}
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
      {!isLoading && icon && <span className="mr-2 flex items-center" aria-hidden="true">{icon}</span>}
      {children}
    </button>
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
      className={`${WORKSPACE.panel.base} ${WORKSPACE.panel.radius} p-6 ${
        hoverEffect || isClickable
          ? 'hover:bg-[var(--ws-hover)] transition-all duration-200 hover:border-[var(--ws-border-strong)]'
          : ''
      } ${isClickable ? 'cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring,#356AF4)]' : ''} ${className}`}
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
  const variants: Record<string, string> = {
    success: "bg-[color-mix(in_srgb,var(--success)_12%,transparent)] text-[var(--success)] border-[color-mix(in_srgb,var(--success)_28%,transparent)]",
    warning: "bg-[color-mix(in_srgb,var(--warning)_12%,transparent)] text-[var(--warning)] border-[color-mix(in_srgb,var(--warning)_28%,transparent)]",
    neutral: "bg-[var(--surface-secondary)] text-[var(--text-secondary)] border-[var(--border-default)]",
    error: "bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)] border-[color-mix(in_srgb,var(--danger)_28%,transparent)]",
    blue: "bg-[color-mix(in_srgb,var(--info)_12%,transparent)] text-[var(--info)] border-[color-mix(in_srgb,var(--info)_28%,transparent)]",
    default: "bg-[color-mix(in_srgb,var(--info)_12%,transparent)] text-[var(--info)] border-[color-mix(in_srgb,var(--info)_28%,transparent)]",
    secondary: "bg-[var(--surface-secondary)] text-[var(--text-secondary)] border-[var(--border-default)]",
    outline: "bg-transparent text-[var(--text-secondary)] border-[var(--border-default)]",
  };

  const resolvedClass = variants[variant] || variants.neutral;

  return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full type-ui font-medium border whitespace-nowrap ${resolvedClass} ${className}`}>
      {children}
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

  const sharedClass = `w-full bg-[var(--surface-primary)] border ${error ? 'border-[var(--danger)]' : 'border-[var(--border-default)]'} rounded-[10px] px-3 py-2 type-caption leading-normal text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--interactive-secondary)] transition-colors ${icon ? 'pl-10' : ''} ${className}`;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={fieldId} className="block type-caption font-medium text-[var(--text-secondary)] mb-1">{label}</label>
      )}
      <div className="relative group">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-[var(--interactive-secondary)] transition-colors" aria-hidden="true">
            {icon}
          </div>
        )}
        {textarea ? (
          <textarea
            id={fieldId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={`${sharedClass} min-h-[80px] resize-y`}
            {...(validate || isControlled
              ? { ...props, ...fieldProps }
              : fieldProps as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            id={fieldId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={sharedClass}
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
  const titleId = React.useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable?.[0];
    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel || !focusable?.length) return;
      const items = Array.from(focusable);
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
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
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[1100] flex items-end sm:items-center justify-center px-0 sm:px-4 pt-safe pb-safe ${containerClassName}`}>
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        className={`relative ${WORKSPACE.panel.base} rounded-t-2xl sm:rounded-xl w-full ${maxWidth} shadow-none animate-fade-in overflow-hidden max-h-[92dvh] sm:max-h-[85vh] flex flex-col ${className}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--ws-border)] flex-shrink-0">
          <h3 id={titleId} className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className={`text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-2 min-h-11 min-w-11 hover:bg-[var(--surface-hover)] ${WORKSPACE.panel.radius}`}
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Card Subcomponents ---
export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => (
  <div className={`p-6 pb-2 ${className}`} {...props} />
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className = '', ...props }) => (
  <h3 className={`font-semibold leading-none tracking-tight text-[var(--text-primary)] ${className}`} {...props} />
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => (
  <div className={`p-6 pt-0 ${className}`} {...props} />
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
  <div className={`flex h-full w-full items-center justify-center rounded-full bg-[var(--ws-surface-secondary,#1B1E2B)] text-[var(--ws-text-muted,#a8b0c2)] border border-[var(--ws-border)] type-caption font-semibold ${className}`} {...props} />
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

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ className = '', ...props }) => (
  <th className={`h-11 px-4 text-left align-middle font-semibold type-caption tracking-wider uppercase text-[var(--ws-text-muted)] [&:has([role=checkbox])]:pr-0 ${className}`} {...props} />
);

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
  trigger: React.ReactNode;
  items: DropdownItem[];
  align?: 'left' | 'right';
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({ trigger, items, align = 'right', className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
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

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={toggle}
        onKeyDown={handleTriggerKeyDown}
        className="cursor-pointer inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring,#356AF4)] rounded-lg touch-manipulation select-none"
      >
        {trigger}
      </div>

      {isOpen && (
        <div
          role="menu"
          className={`absolute z-[1000] mt-2 w-48 rounded-xl bg-[var(--ws-panel,#171A26)] border border-[var(--ws-border)] shadow-xl animate-in fade-in slide-in-from-top-1 duration-150 ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          <div className="p-1 space-y-0.5">
            {items.map((item, index) => (
              <button
                key={index}
                type="button"
                role="menuitem"
                onClick={() => {
                  item.onClick();
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 type-ui font-medium rounded-lg transition-all duration-150 select-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring,#356AF4)] ${
                  item.variant === 'danger'
                    ? 'text-red-400 hover:bg-red-500/10'
                    : 'text-[var(--ws-text-secondary)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-text-primary)]'
                }`}
              >
                {item.icon && <span className="shrink-0" aria-hidden="true">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

