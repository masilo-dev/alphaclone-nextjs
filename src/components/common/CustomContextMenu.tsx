'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ContextMenuItem {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    destructive?: boolean;
    shortcut?: string;
}

interface CustomContextMenuProps {
    items: ContextMenuItem[];
    children: React.ReactNode;
    className?: string;
    as?: React.ElementType;
}

/**
 * CustomContextMenu component
 * Provides a desktop-native right-click menu with premium animations and styling.
 */
export default function CustomContextMenu({ items, children, className = '', as: Component = 'div' }: CustomContextMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const menuRef = useRef<HTMLDivElement>(null);

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();

        // Calculate position, ensuring it doesn't go off screen
        let x = e.clientX;
        let y = e.clientY;

        const menuWidth = 200;
        const menuHeight = items.length * 40 + 20;

        if (x + menuWidth > window.innerWidth) x -= menuWidth;
        if (y + menuHeight > window.innerHeight) y -= menuHeight;

        setPosition({ x, y });
        setIsOpen(true);
    }, [items.length]);

    const closeMenu = useCallback(() => {
        setIsOpen(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            window.addEventListener('click', closeMenu);
            window.addEventListener('scroll', closeMenu, true);
        }
        return () => {
            window.removeEventListener('click', closeMenu);
            window.removeEventListener('scroll', closeMenu, true);
        };
    }, [isOpen, closeMenu]);

    return (
        <Component onContextMenu={handleContextMenu} className={className}>
            {children}

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        ref={menuRef}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.1, ease: 'easeOut' }}
                        style={{
                            position: 'fixed',
                            top: position.y,
                            left: position.x,
                            zIndex: 10000,
                        }}
                        className="bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl py-1.5 min-w-[200px] overflow-hidden"
                    >
                        {items.map((item, idx) => (
                            <button
                                key={idx}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    item.onClick();
                                    closeMenu();
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-blue-600/20 group ${item.destructive ? 'text-red-400 hover:bg-red-500/10' : 'text-slate-200'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    {item.icon && <span className="opacity-70 group-hover:opacity-100">{item.icon}</span>}
                                    <span>{item.label}</span>
                                </div>
                                {item.shortcut && (
                                    <span className="text-xs text-slate-500 font-mono tracking-tighter">
                                        {item.shortcut}
                                    </span>
                                )}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </Component>
    );
}

