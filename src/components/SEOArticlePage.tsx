import React, { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { Helmet } from 'react-helmet-async';
import DOMPurify from 'dompurify';

interface Article {
    id: string;
    title: string;
    slug: string;
    meta_description: string;
    meta_keywords: string[];
    content: string;
    category: string;
    tags: string[];
    views: number;
    created_at: string;
}

const SEOArticlePage: React.FC = () => {
    const params = useParams();
    const slug = params?.slug as string;
    const [article, setArticle] = React.useState<Article | null>(null);
    const [loading, setLoading] = React.useState(true);

    useEffect(() => {
        loadArticle();
    }, [slug]);

    const loadArticle = async () => {
        if (!slug) return;

        // Fetch article
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

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

    if (!article) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-white mb-4">Article Not Found</h1>
                    <p className="text-slate-400">The article you're looking for doesn't exist.</p>
                    <a href="/" className="mt-6 inline-block px-6 py-3 bg-teal-500 text-white rounded-lg hover:bg-teal-600">
                        Go Home
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

                {/* Open Graph */}
                <meta property="og:title" content={article.title} />
                <meta property="og:description" content={article.meta_description} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={`https://yoursite.com/blog/${article.slug}`} />

                {/* Twitter Card */}
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content={article.title} />
                <meta name="twitter:description" content={article.meta_description} />

                {/* Article Schema */}
                <script type="application/ld+json">
                    {JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "Article",
                        "headline": article.title,
                        "description": article.meta_description,
                        "author": {
                            "@type": "Organization",
                            "name": "AlphaClone Systems"
                        },
                        "publisher": {
                            "@type": "Organization",
                            "name": "AlphaClone Systems"
                        },
                        "datePublished": article.created_at,
                        "keywords": article.meta_keywords.join(', ')
                    })}
                </script>
            </Helmet>

            {/* Article Content */}
            <div className="min-h-screen bg-slate-950">
                <article className="max-w-4xl mx-auto px-6 py-16">
                    {/* Breadcrumb */}
                    <nav className="text-sm text-slate-400 mb-8">
                        <a href="/" className="hover:text-teal-400">Home</a>
                        <span className="mx-2">/</span>
                        <a href="/blog" className="hover:text-teal-400">Blog</a>
                        <span className="mx-2">/</span>
                        <span className="text-white">{article.category}</span>
                    </nav>

                    {/* Article Header */}
                    <header className="mb-12">
                        <div className="flex gap-2 mb-4">
                            <span className="px-3 py-1 bg-teal-500/20 text-teal-400 text-sm rounded-full">
                                {article.category}
                            </span>
                            {article.tags.map(tag => (
                                <span key={tag} className="px-3 py-1 bg-slate-800 text-slate-300 text-sm rounded-full">
                                    {tag}
                                </span>
                            ))}
                        </div>

                        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                            {article.title}
                        </h1>

                        <div className="flex items-center gap-4 text-slate-400 text-sm">
                            <span>{new Date(article.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}</span>
                            <span>•</span>
                            <span>{article.views} views</span>
                        </div>
                    </header>

                    {/* Article Content (Markdown rendered as HTML) */}
                    <div className="prose prose-invert prose-lg max-w-none">
                        <div
                            className="text-slate-300 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(article.content.replace(/\n/g, '<br />')) }}
                        />
                    </div>

                    {/* CTA Section */}
                    <div className="mt-16 p-8 bg-gradient-to-r from-teal-500/10 to-blue-500/10 border border-teal-500/20 rounded-xl">
                        <h3 className="text-2xl font-bold text-white mb-4">
                            Ready to Start Your Project?
                        </h3>
                        <p className="text-slate-300 mb-6">
                            Contact AlphaClone Systems today for a free consultation on your custom software development needs.
                        </p>
                        <a
                            href="/contact"
                            className="inline-block px-8 py-3 bg-teal-500 text-white font-semibold rounded-lg hover:bg-teal-600 transition-colors"
                        >
                            Get Started
                        </a>
                    </div>
                </article>
            </div>
        </>
    );
};

export default SEOArticlePage;
