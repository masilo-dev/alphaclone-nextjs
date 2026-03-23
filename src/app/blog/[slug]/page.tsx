import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Calendar, Tag } from 'lucide-react';
import { getPublishedSeoArticleBySlug } from '@/services/seoServerService';
import { MarkdownRenderer } from '@/components/blog/MarkdownRenderer';

type PageProps = {
    params: { slug: string };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = params;
    const article = await getPublishedSeoArticleBySlug(slug);

    if (!article) {
        return {
            title: 'Article Not Found',
            robots: { index: false, follow: false },
        };
    }

    return {
        title: article.title,
        description: article.meta_description,
        keywords: article.meta_keywords,
        alternates: { canonical: `https://alphaclone.tech/blog/${article.slug}` },
        openGraph: {
            title: article.title,
            description: article.meta_description,
            type: 'article',
            url: `https://alphaclone.tech/blog/${article.slug}`,
            publishedTime: article.created_at,
            modifiedTime: article.updated_at,
        },
        twitter: {
            card: 'summary_large_image',
            title: article.title,
            description: article.meta_description,
        },
    };
}

export default async function BlogPost({ params }: PageProps) {
    const { slug } = params;
    const article = await getPublishedSeoArticleBySlug(slug);

    if (!article) notFound();

    const articleSchema = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.meta_description,
        datePublished: article.created_at,
        dateModified: article.updated_at,
        author: {
            '@type': 'Organization',
            name: 'AlphaClone Systems',
        },
        publisher: {
            '@type': 'Organization',
            name: 'AlphaClone Systems',
            logo: {
                '@type': 'ImageObject',
                url: 'https://alphaclone.tech/favicon.ico',
            },
        },
        mainEntityOfPage: `https://alphaclone.tech/blog/${article.slug}`,
    };

    return (
        <article className="min-h-screen bg-slate-950 text-white">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
            />

            <div className="relative pt-32 pb-16 overflow-hidden border-b border-white/5 bg-slate-900/50">
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
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-16">
                <div className="max-w-4xl mx-auto">
                    <div className="glass-panel rounded-2xl p-8 md:p-12 border border-white/5 bg-slate-900/30 shadow-2xl">
                        <MarkdownRenderer content={article.content} />
                    </div>

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

                    <div className="mt-16 bg-gradient-to-r from-teal-900/50 to-blue-900/50 rounded-2xl p-8 border border-teal-500/20 text-center relative overflow-hidden">
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
