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
        toast.success(message, {
            duration: 4000,
            position: 'top-right',
            style: {
                background: '#0f172a',
                color: '#fff',
                border: '1px solid #14b8a6',
            },
        });
    };

    const error = (message: string) => {
        toast.error(message, {
            duration: 5000,
            position: 'top-right',
            style: {
                background: '#0f172a',
                color: '#fff',
                border: '1px solid #ef4444',
            },
        });
    };

    const info = (message: string) => {
        toast(message, {
            duration: 4000,
            position: 'top-right',
            icon: 'ℹ️',
            style: {
                background: '#0f172a',
                color: '#fff',
                border: '1px solid #3b82f6',
            },
        });
    };

    const loading = (message: string) => {
        return toast.loading(message, {
            position: 'top-right',
            style: {
                background: '#0f172a',
                color: '#fff',
                border: '1px solid #64748b',
            },
        });
    };

    const dismiss = (toastId?: string) => {
        toast.dismiss(toastId);
    };

    return (
        <ToastContext.Provider value={{ success, error, info, loading, dismiss }}>
            {children}
            <Toaster />
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
