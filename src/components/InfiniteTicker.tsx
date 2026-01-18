import React from 'react';

const InfiniteTicker: React.FC = () => {
    const items = [
        "50+ Projects Delivered",
        "20+ Different Countries",
        "Enterprise Grade Security",
        "AI-Powered Solutions",
        "Scalable Architecture",
        "24/7 Global Support"
    ];

    return (
        <div className="w-full bg-teal-500 overflow-hidden py-3 relative z-50">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,transparent,rgba(0,0,0,0.1)_50%,transparent)]" />

            <div className="flex animate-scroll-text whitespace-nowrap">
                {/* First set of items */}
                <div className="flex shrink-0 gap-16 px-8 items-center">
                    {items.map((item, i) => (
                        <span key={i} className="text-slate-900 font-bold text-sm tracking-widest uppercase flex items-center gap-4">
                            {item}
                            <span className="w-2 h-2 bg-slate-900 rounded-full" />
                        </span>
                    ))}
                </div>

                {/* Duplicate set for seamless loop */}
                <div className="flex shrink-0 gap-16 px-8 items-center">
                    {items.map((item, i) => (
                        <span key={`dup-${i}`} className="text-slate-900 font-bold text-sm tracking-widest uppercase flex items-center gap-4">
                            {item}
                            <span className="w-2 h-2 bg-slate-900 rounded-full" />
                        </span>
                    ))}
                </div>

                {/* Third set just in case of wide screens */}
                <div className="flex shrink-0 gap-16 px-8 items-center">
                    {items.map((item, i) => (
                        <span key={`dup2-${i}`} className="text-slate-900 font-bold text-sm tracking-widest uppercase flex items-center gap-4">
                            {item}
                            <span className="w-2 h-2 bg-slate-900 rounded-full" />
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default InfiniteTicker;
