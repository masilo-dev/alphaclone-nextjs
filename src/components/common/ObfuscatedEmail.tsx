'use client';

import React, { useState, useEffect } from 'react';
import { Mail } from 'lucide-react';

interface ObfuscatedEmailProps {
    email: string;
    showIcon?: boolean;
    className?: string;
    label?: string;
}

/**
 * Obfuscates email addresses from simple bots while remaining accessible and clickable for users.
 */
const ObfuscatedEmail: React.FC<ObfuscatedEmailProps> = ({ 
    email, 
    showIcon = false, 
    className = "", 
    label 
}) => {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    // Split email to avoid full string in source
    const [user, domain] = email.split('@');
    
    if (!isClient) {
        // Fallback for SSR/Bots: reversed or broken up string
        return (
            <span className={className}>
                {user} [at] {domain.replace('.', ' [dot] ')}
            </span>
        );
    }

    return (
        <a 
            href={`mailto:${email}`}
            className={`inline-flex items-center gap-2 transition-colors ${className}`}
        >
            {showIcon && <Mail className="w-4 h-4" />}
            <span>{label || email}</span>
        </a>
    );
};

export default ObfuscatedEmail;
