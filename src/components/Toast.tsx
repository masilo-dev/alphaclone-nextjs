'use client';

import React, { createContext, useContext } from 'react';
import toast, { Toaster } from 'react-hot-toast';

interface ToastContextType {
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
    loading: (message: string) => string;
    dismiss: (toastId?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const success = (message: string) => {
        toast.success(message, { duration: 4000, position: 'top-right' });
    };

    const error = (message: string) => {
        toast.error(message, { duration: 5000, position: 'top-right' });
    };

    const info = (message: string) => {
        toast(message, { duration: 4000, position: 'top-right' });
    };

    const loading = (message: string) => {
        return toast.loading(message, { position: 'top-right' });
    };

    const dismiss = (toastId?: string) => {
        toast.dismiss(toastId);
    };

    return (
        <ToastContext.Provider value={{ success, error, info, loading, dismiss }}>
            {children}
            <Toaster
                toastOptions={{
                    className: 'ac-toast',
                    style: {
                        background: 'var(--surface-elevated)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-default)',
                        borderRadius: '14px',
                        padding: '12px 14px',
                    },
                    success: {
                        style: {
                            border: '1px solid color-mix(in_srgb,var(--success)_40%,var(--border-default))',
                        },
                    },
                    error: {
                        style: {
                            border: '1px solid color-mix(in_srgb,var(--danger)_45%,var(--border-default))',
                        },
                    },
                }}
            />
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};
