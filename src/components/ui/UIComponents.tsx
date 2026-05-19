import React, { useState, useRef, useEffect } from 'react';
import { Loader2, X, ChevronDown, MoreVertical } from 'lucide-react';
import Image from 'next/image';

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  isLoading,
  disabled,
  icon,
  ...props
}) => {
  const baseStyles = "inline-flex items-center justify-center rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:pointer-events-none active:scale-95";

  const variants = {
    primary: "bg-teal-600 text-white hover:bg-teal-500 shadow-lg shadow-teal-900/20",
    secondary: "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20",
    outline: "border border-slate-600 text-white hover:bg-slate-800",
    ghost: "text-white hover:text-teal-400 hover:bg-slate-800/50",
    danger: "bg-red-600 text-white hover:bg-red-500",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs", // 32px - Ultra Compact
    md: "h-10 px-4 py-2 text-sm", // 40px - Space Efficient
    lg: "h-12 px-6 text-base", // 48px - Standard
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {!isLoading && icon && <span className="mr-2 flex items-center">{icon}</span>}
      {children}
    </button>
  );
};

// --- Card ---
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', hoverEffect = false, ...props }) => {
  return (
    <div
      className={`bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 ${hoverEffect ? 'hover:bg-slate-800/80 transition-all duration-300 hover:border-teal-500/30 hover:shadow-lg hover:shadow-teal-900/10' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

// --- Badge ---
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'neutral' | 'error' | 'blue';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', className = '' }) => {
  const variants = {
    success: "bg-teal-500/10 text-teal-400 border-teal-500/20",
    warning: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
    neutral: "bg-slate-500/10 text-slate-300 border-slate-500/20",
    error: "bg-red-500/10 text-red-300 border-red-500/20",
    blue: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variants[variant]} ${className}`}>
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
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  icon,
  className = '',
  textarea = false,
  ...props
}) => {
  return (
    <div className="w-full">
      {label && <label className="block text-xs font-semibold text-slate-400 mb-1">{label}</label>}
      <div className="relative group">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-500 transition-colors">
            {icon}
          </div>
        )}
        {textarea ? (
          <textarea
            className={`w-full bg-slate-950 border ${error ? 'border-red-500' : 'border-slate-800'} rounded-lg px-3 py-2 text-md text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500/50 focus:border-teal-500 transition-all min-h-[80px] resize-y ${icon ? 'pl-10' : ''} ${className}`}
            {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            className={`w-full bg-slate-950 border ${error ? 'border-red-500' : 'border-slate-800'} rounded-lg px-3 py-2 text-md text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500/50 focus:border-teal-500 transition-all ${icon ? 'pl-10' : ''} ${className}`}
            {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
          />
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      {!error && hint && (
        <p className="mt-1 text-xs text-slate-500 italic">{hint}</p>
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
  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center px-4 pt-safe pb-safe ${containerClassName}`}>
      <div className={`absolute inset-0 bg-slate-950/80 backdrop-blur-sm`} onClick={onClose} />
      <div className={`relative bg-slate-900 border border-slate-700 rounded-3xl w-full ${maxWidth} shadow-2xl animate-fade-in overflow-hidden max-h-[85vh] flex flex-col ${className}`}>
        <div className="flex items-center justify-between p-4 border-b border-slate-800 flex-shrink-0">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg">
            <X className="w-5 h-5" />
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
  <h3 className={`font-semibold leading-none tracking-tight text-white ${className}`} {...props} />
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

  return src ? (
    <Image
      {...imageProps}
      src={src}
      alt={alt || ''}
      fill
      className={`object-cover ${className}`}
    />
  ) : null;
};

export const AvatarFallback: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', ...props }) => (
  <div className={`flex h-full w-full items-center justify-center rounded-full bg-slate-800 text-slate-400 ${className}`} {...props} />
);

// --- Table ---
export const Table: React.FC<React.HTMLAttributes<HTMLTableElement>> = ({ className = '', ...props }) => (
  <div className="relative w-full overflow-auto">
    <table className={`w-full caption-bottom text-sm text-left ${className}`} {...props} />
  </div>
);

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className = '', ...props }) => (
  <thead className={`[&_tr]:border-b [&_tr]:border-slate-800 ${className}`} {...props} />
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className = '', ...props }) => (
  <tbody className={`[&_tr:last-child]:border-0 ${className}`} {...props} />
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ className = '', ...props }) => (
  <tr className={`border-b border-slate-800 transition-colors hover:bg-slate-800/50 data-[state=selected]:bg-slate-800 ${className}`} {...props} />
);

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ className = '', ...props }) => (
  <th className={`h-12 px-4 text-left align-middle font-medium text-slate-400 [&:has([role=checkbox])]:pr-0 ${className}`} {...props} />
);

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ className = '', ...props }) => (
  <td className={`p-4 align-middle [&:has([role=checkbox])]:pr-0 ${className}`} {...props} />
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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div className={`absolute z-[110] mt-2 w-48 rounded-lg bg-slate-900 border border-slate-700 shadow-lg animate-in fade-in slide-in-from-top-1 duration-150 ${align === 'right' ? 'right-0' : 'left-0'}`}>
          <div className="p-1 space-y-0.5">
            {items.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  item.onClick();
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all duration-150 ${
                  item.variant === 'danger'
                    ? 'text-red-400 hover:bg-red-500/10'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.icon && <span className="shrink-0">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

