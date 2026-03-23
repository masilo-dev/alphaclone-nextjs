import Link from 'next/link';
import { ArrowLeft, ArrowRight, Calendar } from 'lucide-react';
import { getPublishedSeoArticles, type SeoArticleRecord } from '@/services/seoServerService';

export default async function BlogPage() {
    let articles: SeoArticleRecord[] = [];
    try {
        articles = await getPublishedSeoArticles();
    } catch (error) {
        console.error('Failed to load articles', error);
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            <div className="relative pt-32 pb-20 overflow-hidden">
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
                            Insights and practical guidance on running a unified business operating platform at scale.
                        </p>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 pb-32">
                {articles.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {articles.map((article) => (
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
                        <p className="text-slate-400 text-lg">No published articles yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
