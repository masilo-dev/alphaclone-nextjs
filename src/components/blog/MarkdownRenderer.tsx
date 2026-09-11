import React from 'react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
    return (
        <div className={`prose prose-invert prose-lg max-w-none ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    // Custom component overrides if needed
                    a: ({ node, ...props }) => (
                        <a {...props} className="text-teal-400 hover:text-teal-300 no-underline hover:underline transition-colors" target="_blank" rel="noopener noreferrer" />
                    ),
                    h1: ({ node, ...props }) => (
                        <h1 {...props} className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 mt-8 mb-4" />
                    ),
                    h2: ({ node, ...props }) => (
                        <h2 {...props} className="text-2xl md:text-3xl font-bold text-white mt-12 mb-6 border-b border-white/10 pb-2" />
                    ),
                    h3: ({ node, ...props }) => (
                        <h3 {...props} className="text-xl md:text-2xl font-semibold text-teal-100 mt-8 mb-4" />
                    ),
                    p: ({ node, ...props }) => (
                        <p {...props} className="text-slate-300 leading-relaxed mb-6" />
                    ),
                    ul: ({ node, ...props }) => (
                        <ul {...props} className="list-disc list-outside ml-6 space-y-2 mb-6 text-slate-300" />
                    ),
                    ol: ({ node, ...props }) => (
                        <ol {...props} className="list-decimal list-outside ml-6 space-y-2 mb-6 text-slate-300" />
                    ),
                    li: ({ node, ...props }) => (
                        <li {...props} className="pl-2" />
                    ),
                    blockquote: ({ node, ...props }) => (
                        <blockquote {...props} className="border-l-4 border-teal-500 pl-4 py-2 my-6 bg-teal-500/10 rounded-r-lg italic text-slate-200" />
                    ),
                    code: ({ node, className, ...props }) => {
                        return (
                            <code {...props} className={`${className} bg-slate-800 text-teal-300 rounded px-1.5 py-0.5 text-sm font-mono border border-white/10`} />
                        );
                    },
                    pre: ({ node, ...props }) => (
                        <pre {...props} className="bg-slate-900 border border-white/10 rounded-lg p-4 overflow-x-auto mb-6 custom-scrollbar" />
                    ),
                    img: ({ node, ...props }) => (
                        <div className="relative w-full h-[300px] md:h-[500px] my-8 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
                            <Image 
                                src={typeof props.src === 'string' ? props.src : ''} 
                                alt={updatedAlt(props.alt)}
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 100vw, 800px"
                            />
                        </div>
                    ),
                    table: ({ node, ...props }) => (
                        <div className="overflow-x-auto mb-8 rounded-lg border border-white/10 min-w-0">
                            <table {...props} className="w-full min-w-[480px] text-left text-sm text-slate-300" />
                        </div>
                    ),
                    th: ({ node, ...props }) => (
                        <th {...props} className="bg-slate-800/50 px-4 py-3 font-semibold text-white border-b border-white/10" />
                    ),
                    td: ({ node, ...props }) => (
                        <td {...props} className="px-4 py-3 border-b border-white/5" />
                    ),
                    hr: ({ node, ...props }) => (
                        <hr {...props} className="border-white/10 my-12" />
                    )
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};

// Helper utility for alt text
function updatedAlt(alt: string | undefined): string {
    return alt || 'Blog image';
}
