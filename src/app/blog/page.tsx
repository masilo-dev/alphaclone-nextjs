'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, Calendar, ArrowRight, Search } from 'lucide-react';
import { seoService, SeoArticle } from '../../services/seoService';
import { CardSkeleton } from '../../components/ui/Skeleton';

export default function BlogPage() {
    const [articles, setArticles] = useState<SeoArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchArticles = async () => {
            try {
                const { articles } = await seoService.getPublishedArticles();
                setArticles(articles);
            } catch (error) {
                console.error('Failed to load articles', error);
            } finally {
                setLoading(false);
            }
        };

        fetchArticles();
    }, []);

    const filteredArticles = articles.filter(article =>
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <div className="relative pt-32 pb-20 overflow-hidden">
                <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[400px] bg-teal-500/10 blur-[100px] rounded-full pointer-events-none" />

                <div className="container mx-auto px-4 relative z-10">
                    <div className="max-w-4xl mx-auto text-center">
                        <Link href="/" className="inline-flex items-center text-slate-400 hover:text-white mb-8 transition-colors">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Home
                        </Link>

                        <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-teal-100 to-slate-400">
                            Knowledge Hub
                        </h1>
                        <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
                            Insights, guides, and updates on custom software, business automation, and enterprise scaling.
                        </p>

                        <div className="relative max-w-xl mx-auto">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Search className="h-5 w-5 text-slate-500" />
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-12 pr-4 py-4 bg-slate-900/50 border border-white/10 rounded-full text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all backdrop-blur-sm"
                                placeholder="Search articles..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Articles Grid */}
            <div className="container mx-auto px-4 pb-32">
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="bg-slate-900/50 rounded-2xl h-[400px] animate-pulse border border-white/5" />
                        ))}
                    </div>
                ) : filteredArticles.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredArticles.map((article) => (
                            <Link href={`/blog/${article.slug}`} key={article.id} className="group">
                                <article className="glass-card h-full rounded-2xl p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-teal-500/20 flex flex-col">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="px-3 py-1 text-xs font-semibold bg-teal-500/10 text-teal-400 rounded-full border border-teal-500/20">
                                            {article.category}
                                        </span>
                                        <span className="text-xs text-slate-500 flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {new Date(article.created_at).toLocaleDateString()}
                                        </span>
                                    </div>

                                    <h2 className="text-xl font-bold text-white mb-3 group-hover:text-teal-300 transition-colors line-clamp-2">
                                        {article.title}
                                    </h2>

                                    <p className="text-slate-400 text-sm mb-6 line-clamp-3 flex-grow">
                                        {article.meta_description}
                                    </p>

                                    <div className="flex items-center text-teal-400 text-sm font-medium mt-auto group-hover:translate-x-1 transition-transform">
                                        Read Article <ArrowRight className="w-4 h-4 ml-2" />
                                    </div>
                                </article>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20">
                        <p className="text-slate-400 text-lg">No articles found matching your search.</p>
                        <button
                            onClick={() => setSearchQuery('')}
                            className="mt-4 text-teal-400 hover:text-teal-300 underline"
                        >
                            Clear search
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
