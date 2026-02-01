'use client';

import React from 'react';
import { InlineWidget } from 'react-calendly';

interface CalendlyEmbedProps {
    url: string;
    prefill?: {
        name?: string;
        email?: string;
        customAnswers?: Record<string, string>;
    };
    branding?: {
        primaryColor?: string;
        textColor?: string;
        backgroundColor?: string;
    };
}

const CalendlyEmbed: React.FC<CalendlyEmbedProps> = ({ url, prefill, branding }) => {
    // Convert hex to naked hex (no #) if needed, though react-calendly handles it
    const primaryColor = branding?.primaryColor?.replace('#', '') || '2dd4bf';
    const textColor = branding?.textColor?.replace('#', '') || 'ffffff';
    const backgroundColor = branding?.backgroundColor?.replace('#', '') || '0f172a';

    return (
        <div className="w-full h-full min-h-[700px]">
            <InlineWidget
                url={url}
                styles={{
                    height: '100%',
                    width: '100%'
                }}
                pageSettings={{
                    backgroundColor: backgroundColor,
                    hideEventTypeDetails: false,
                    hideLandingPageDetails: false,
                    primaryColor: primaryColor,
                    textColor: textColor
                }}
                prefill={prefill}
            />
        </div>
    );
};

export default CalendlyEmbed;
