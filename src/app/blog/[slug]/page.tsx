import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Calendar, Tag } from 'lucide-react';
import { getPublishedSeoArticleBySlug } from '@/services/seoServerService';
import { MarkdownRenderer } from '@/components/blog/MarkdownRenderer';
import { SITE_URL } from '@/lib/siteUrl';

type PageProps = {
    params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
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
        alternates: { canonical: `${SITE_URL}/blog/${article.slug}` },
        openGraph: {
            title: article.title,
            description: article.meta_description,
            type: 'article',
            url: `${SITE_URL}/blog/${article.slug}`,
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
    const { slug } = await params;
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
                url: `${SITE_URL}/favicon.ico`,
            },
        },
        mainEntityOfPage: `${SITE_URL}/blog/${article.slug}`,
    };

    return (
        <article className="min-h-screen bg-white text-slate-950">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
            />

            <div className="relative py-8 pb-16 overflow-hidden border-b border-slate-200 bg-slate-50">
                <div className="container mx-auto px-4 relative z-10">
                    <div className="max-w-4xl mx-auto">
                        <Link href="/blog" className="inline-flex items-center text-blue-700 hover:text-blue-900 mb-8 transition-colors type-ui font-semibold">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Articles
                        </Link>

                        <div className="flex items-center gap-4 mb-6">
                            <span className="px-3 py-1 type-caption font-bold uppercase tracking-wider bg-blue-50 text-blue-800 rounded-full border border-blue-200">
                                {article.category}
                            </span>
                            <span className="text-slate-700 type-ui flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {new Date(article.created_at).toLocaleDateString(undefined, {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </span>
                        </div>

                        <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight text-slate-950">
                            {article.title}
                        </h1>

                        <p className="text-xl text-slate-700 leading-relaxed max-w-3xl border-l-4 border-blue-600 pl-6 my-8">
                            {article.meta_description}
                        </p>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-16">
                <div className="max-w-4xl mx-auto">
                    <div className="rounded-2xl p-6 md:p-12 border border-slate-200 bg-white shadow-lg">
                        <MarkdownRenderer content={article.content} />
                    </div>

                    {article.tags && article.tags.length > 0 && (
                        <div className="mt-12 flex flex-wrap gap-2">
                            {article.tags.map((tag) => (
                                <span key={tag} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg type-ui flex items-center gap-2 border border-slate-200">
                                    <Tag className="w-3 h-3" />
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="mt-16 bg-slate-950 rounded-2xl p-8 border border-slate-800 text-center relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-2xl font-bold text-white mb-4">See AlphaClone on a real workflow.</h3>
                            <p className="text-slate-300 mb-8 max-w-xl mx-auto">
                                Book a free 30-minute walkthrough tailored to your business. No commitment.
                            </p>
                            <Link href="/book-demo" className="inline-flex items-center px-8 py-3 bg-teal-500 hover:bg-teal-600 text-white rounded-full font-bold transition-all transform hover:scale-105 shadow-lg shadow-teal-500/20">
                                Book a demo <ArrowRight className="w-4 h-4 ml-2" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
}
