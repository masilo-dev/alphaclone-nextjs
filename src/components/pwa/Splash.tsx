import React from 'react';

export default function Splash() {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050B1E] text-white">
            <div className="flex flex-col items-center animate-pulse">
                {/* Replace with your actual logo component if available, or an image */}
                <img src="/logo.png" alt="AlphaClone" className="w-24 h-24 mb-4" />
                <h1 className="text-xl font-bold tracking-widest text-[#14b8a6]">ALPHACLONE</h1>
            </div>
        </div>
    );
}
