import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Helmet } from 'react-helmet-async';
import { supabase } from '../lib/supabase';
import { Clock, Calendar, Tag, ArrowLeft } from 'lucide-react';
import DOMPurify from 'dompurify';

interface Article {
    id: string;
    title: string;
    slug: string;
    meta_description: string;
    meta_keywords: string[];
    content: string;
    author: string;
    category: string;
    tags: string[];
    reading_time: number;
    created_at: string;
    published_at: string;
}

const SEOArticle: React.FC = () => {
    const params = useParams();
    const slug = params?.slug as string;
    const [article, setArticle] = useState<Article | null>(null);
    const [loading, setLoading] = useState(true);

    const loadArticle = async () => {
        if (!slug) return;

        const { data, error } = await supabase
            .from('seo_articles')
            .select('*')
            .eq('slug', slug)
            .eq('published', true)
            .single();

        if (!error && data) {
            setArticle(data);

            // Increment view count
            await supabase
                .from('seo_articles')
                .update({ views: (data.views || 0) + 1 })
                .eq('id', data.id);
        }

        setLoading(false);
    };

    useEffect(() => {
        loadArticle();
    }, [slug]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-teal-400 text-xl">Loading...</div>
            </div>
        );
    }

    if (!article) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-white mb-4">Article Not Found</h1>
                    <a href="/" className="text-teal-400 hover:text-teal-300">
                        Return to Home
                    </a>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* SEO Meta Tags */}
            <Helmet>
                <title>{article.title} | AlphaClone Systems</title>
                <meta name="description" content={article.meta_description} />
                <meta name="keywords" content={article.meta_keywords.join(', ')} />
                <meta name="author" content={article.author} />

                {/* Open Graph */}
                <meta property="og:title" content={article.title} />
                <meta property="og:description" content={article.meta_description} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={`https://alphaclone.tech/blog/${article.slug}`} />

                {/* Twitter */}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={article.title} />
                <meta name="twitter:description" content={article.meta_description} />

                {/* Article specific */}
                <meta property="article:published_time" content={article.published_at} />
                <meta property="article:author" content={article.author} />
                <meta property="article:section" content={article.category} />
                {article.tags.map(tag => (
                    <meta key={tag} property="article:tag" content={tag} />
                ))}
            </Helmet>

            {/* Article Content */}
            <div className="min-h-screen bg-slate-950 py-20 px-4">
                <article className="max-w-4xl mx-auto">
                    {/* Back Button */}
                    <a
                        href="/"
                        className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 mb-8 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Home
                    </a>

                    {/* Article Header */}
                    <header className="mb-12">
                        {/* Category Badge */}
                        <span className="inline-block px-4 py-2 bg-teal-500/10 text-teal-400 text-sm font-semibold rounded-full mb-4">
                            {article.category}
                        </span>

                        {/* Title */}
                        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
                            {article.title}
                        </h1>

                        {/* Meta Info */}
                        <div className="flex flex-wrap gap-6 text-slate-400 text-sm">
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                {new Date(article.published_at).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                {article.reading_time} min read
                            </div>
                            <div className="flex items-center gap-2">
                                <span>By {article.author}</span>
                            </div>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-2 mt-6">
                            {article.tags.map(tag => (
                                <span
                                    key={tag}
                                    className="inline-flex items-center gap-1 px-3 py-1 bg-slate-800 text-slate-300 text-xs rounded-full"
                                >
                                    <Tag className="w-3 h-3" />
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </header>

                    {/* Article Content */}
                    <div
                        className="prose prose-invert prose-lg max-w-none
              prose-headings:text-white prose-headings:font-bold
              prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-6
              prose-h3:text-2xl prose-h3:mt-8 prose-h3:mb-4
              prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-6
              prose-a:text-teal-400 prose-a:no-underline hover:prose-a:text-teal-300
              prose-strong:text-white prose-strong:font-semibold
              prose-ul:text-slate-300 prose-ul:my-6
              prose-ol:text-slate-300 prose-ol:my-6
              prose-li:my-2
              prose-code:text-teal-400 prose-code:bg-slate-800 prose-code:px-2 prose-code:py-1 prose-code:rounded
              prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-700
              prose-blockquote:border-l-4 prose-blockquote:border-teal-500 prose-blockquote:pl-6 prose-blockquote:italic"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content.replace(/\n/g, '<br />')) }}
                    />

                    {/* CTA Section */}
                    <div className="mt-16 p-8 bg-gradient-to-r from-teal-500/10 to-violet-500/10 border border-teal-500/20 rounded-2xl">
                        <h3 className="text-2xl font-bold text-white mb-4">
                            Ready to Get Started?
                        </h3>
                        <p className="text-slate-300 mb-6">
                            Contact AlphaClone Systems today for a free consultation. Let's discuss how we can help transform your business.
                        </p>
                        <a
                            href="/#contact"
                            className="inline-block px-8 py-4 bg-gradient-to-r from-teal-500 to-violet-500 text-white font-bold rounded-full hover:shadow-lg hover:shadow-teal-500/50 transition-all"
                        >
                            Get in Touch
                        </a>
                    </div>
                </article>
            </div>
        </>
    );
};

export default SEOArticle;
