import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
    title?: string;
    description?: string;
    keywords?: string[];
    image?: string;
    url?: string;
    type?: 'website' | 'article';
    publishedTime?: string;
    author?: string;
}

const SEO: React.FC<SEOProps> = ({
    title = 'AlphaClone Systems | AI-Powered Enterprise OS & Custom Software',
    description = 'Premier custom software development firm specialized in AI integration, enterprise CRM architectures, and high-performance web applications. The all-in-one business operating system for modern firms.',
    keywords = ['AI automation', 'enterprise CRM', 'custom software development', 'business operating system', 'Next.js development', 'scalable architecture', 'AlphaClone', 'SaaS platform'],
    image = 'https://alphaclone.tech/logo.svg',
    url = 'https://alphaclone.tech',
    type = 'website',
    publishedTime,
    author = 'AlphaClone Systems'
}) => {
    return (
        <Helmet>
            {/* Basic Meta Tags */}
            <title>{title}</title>
            <meta name="description" content={description} />
            <meta name="keywords" content={keywords.join(', ')} />
            <meta name="author" content={author} />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content={type} />
            <meta property="og:url" content={url} />
            <meta property="og:title" content={title} />
            <meta property="og:description" content={description} />
            <meta property="og:image" content={image} />
            <meta property="og:site_name" content="AlphaClone Systems" />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:url" content={url} />
            <meta name="twitter:title" content={title} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />
            <meta name="twitter:creator" content="@alphaclone" />

            {/* Article Specific */}
            {type === 'article' && publishedTime && (
                <>
                    <meta property="article:published_time" content={publishedTime} />
                    <meta property="article:author" content={author} />
                </>
            )}

            {/* Canonical URL */}
            <link rel="canonical" href={url} />

            {/* Additional SEO */}
            <meta name="robots" content="index, follow" />
            <meta name="googlebot" content="index, follow" />
            <meta name="language" content="English" />
            <meta name="revisit-after" content="7 days" />
        </Helmet>
    );
};

export default SEO;
