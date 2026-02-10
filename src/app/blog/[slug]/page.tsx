'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Calendar, User, Tag, Share2, Clock } from 'lucide-react';
import { seoService, SeoArticle } from '../../../services/seoService';
import { MarkdownRenderer } from '../../../components/blog/MarkdownRenderer';
import { CardSkeleton } from '../../../components/ui/Skeleton';

export default function BlogPost() {
    const params = useParams();
    const router = useRouter();
    const slug = params.slug as string;

    const [article, setArticle] = useState<SeoArticle | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!slug) return;

        const fetchArticle = async () => {
            try {
                const { article, error } = await seoService.getArticleBySlug(slug);
                if (error || !article) {
                    setError('Article not found');
                    // Optionally redirect to 404
                } else {
                    setArticle(article);
                    // Update document title for SEO (client-side fallback)
                    document.title = `${article.title} | AlphaClone Systems`;
                }
            } catch (err) {
                setError('Failed to load article');
            } finally {
                setLoading(false);
            }
        };

        fetchArticle();
    }, [slug]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 pt-32 pb-20 container mx-auto px-4">
                <div className="max-w-4xl mx-auto space-y-8 animate-pulse">
                    <div className="h-8 w-32 bg-slate-800 rounded mb-8" />
                    <div className="h-16 w-3/4 bg-slate-800 rounded mb-6" />
                    <div className="h-6 w-1/2 bg-slate-800 rounded mb-12" />
                    <div className="space-y-4">
                        <div className="h-4 w-full bg-slate-800 rounded" />
                        <div className="h-4 w-full bg-slate-800 rounded" />
                        <div className="h-4 w-2/3 bg-slate-800 rounded" />
                    </div>
                </div>
            </div>
        );
    }

    if (error || !article) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center px-4">
                <h1 className="text-4xl font-bold text-white mb-4">Article Not Found</h1>
                <p className="text-slate-400 mb-8">The article you are looking for does not exist or has been moved.</p>
                <Link href="/blog" className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-3 rounded-lg font-bold transition-colors">
                    Back to Blog
                </Link>
            </div>
        );
    }

    return (
        <article className="min-h-screen bg-slate-950 text-white">
            {/* Hero Section */}
            <div className="relative pt-32 pb-16 overflow-hidden border-b border-white/5 bg-slate-900/50">
                <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
                <div className="container mx-auto px-4 relative z-10">
                    <div className="max-w-4xl mx-auto">
                        <Link href="/blog" className="inline-flex items-center text-teal-400 hover:text-teal-300 mb-8 transition-colors text-sm font-medium">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Articles
                        </Link>

                        <div className="flex items-center gap-4 mb-6">
                            <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-teal-500/20 text-teal-400 rounded-full border border-teal-500/30">
                                {article.category}
                            </span>
                            <span className="text-slate-400 text-sm flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {new Date(article.created_at).toLocaleDateString(undefined, {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </span>
                        </div>

                        <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                            {article.title}
                        </h1>

                        <p className="text-xl text-slate-400 leading-relaxed max-w-3xl border-l-4 border-teal-500 pl-6 my-8 italic">
                            {article.meta_description}
                        </p>

                        <div className="flex items-center justify-between border-t border-white/10 pt-6 mt-8">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm">
                                    AS
                                </div>
                                <div>
                                    <p className="text-white font-semibold text-sm">AlphaClone Systems</p>
                                    <p className="text-slate-500 text-xs">Editorial Team</p>
                                </div>
                            </div>

                            <button className="text-slate-400 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5" onClick={() => {
                                navigator.clipboard.writeText(window.location.href);
                                // Optional toast
                            }}>
                                <Share2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="container mx-auto px-4 py-16">
                <div className="max-w-4xl mx-auto">
                    <div className="glass-panel rounded-2xl p-8 md:p-12 border border-white/5 bg-slate-900/30 shadow-2xl">
                        <MarkdownRenderer content={article.content} />
                    </div>

                    {/* Tags */}
                    {article.tags && article.tags.length > 0 && (
                        <div className="mt-12 flex flex-wrap gap-2">
                            {article.tags.map((tag) => (
                                <span key={tag} className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-sm flex items-center gap-2 border border-white/5">
                                    <Tag className="w-3 h-3" />
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* CTA */}
                    <div className="mt-16 bg-gradient-to-r from-teal-900/50 to-blue-900/50 rounded-2xl p-8 border border-teal-500/20 text-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-grid-pattern opacity-10" />
                        <div className="relative z-10">
                            <h3 className="text-2xl font-bold text-white mb-4">Ready to Transform Your Business?</h3>
                            <p className="text-slate-300 mb-8 max-w-xl mx-auto">
                                Join thousands of businesses using AlphaClone Systems to automate and scale operations.
                            </p>
                            <Link href="/register" className="inline-flex items-center px-8 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-full font-bold transition-all transform hover:scale-105 shadow-lg shadow-teal-500/20">
                                Start Free Trial <ArrowRight className="w-4 h-4 ml-2" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
}
