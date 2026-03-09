import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Eye, EyeOff, Save, X, Loader2 } from 'lucide-react';
import { TabSkeleton } from '../ui/TabSkeleton';
import { articleService, Article } from '../../services/articleService';
import toast from 'react-hot-toast';

const ArticleEditor: React.FC = () => {
    const [articles, setArticles] = useState<Article[]>([]);
    const [editing, setEditing] = useState<Article | null>(null);
    const [isNew, setIsNew] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const emptyArticle: Partial<Article> = {
        title: '',
        slug: '',
        meta_description: '',
        meta_keywords: [],
        content: '',
        category: '',
        tags: [],
        published: false
    };

    const loadArticles = useCallback(async () => {
        setLoading(true);
        const { articles: data, error } = await articleService.getArticles();
        if (error) {
            toast.error(`Failed to load articles: ${error}`);
        } else {
            setArticles(data);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        loadArticles();
    }, [loadArticles]);

    const handleSave = useCallback(async () => {
        if (!editing) return;
        if (!editing.title.trim()) {
            toast.error('Title is required');
            return;
        }

        setIsSaving(true);
        const { error } = await articleService.saveArticle(editing, isNew);

        if (error) {
            toast.error(`Error saving: ${error}`);
        } else {
            toast.success(isNew ? 'Article created!' : 'Article updated!');
            loadArticles();
            setEditing(null);
            setIsNew(false);
        }
        setIsSaving(false);
    }, [editing, isNew, loadArticles]);

    const handleDelete = useCallback(async (id: string) => {
        if (!confirm('Are you sure you want to delete this article?')) return;

        const { error } = await articleService.deleteArticle(id);

        if (error) {
            toast.error(`Error deleting: ${error}`);
        } else {
            toast.success('Article deleted');
            loadArticles();
        }
    }, [loadArticles]);

    const togglePublished = useCallback(async (article: Article) => {
        const { error } = await articleService.togglePublished(article.id, !article.published);

        if (error) {
            toast.error(`Error toggling status: ${error}`);
        } else {
            loadArticles();
        }
    }, [loadArticles]);

    if (loading) {
        return <TabSkeleton rows={4} showStats={false} />;
    }

    if (editing) {
        return (
            <div className="bg-slate-800 rounded-lg p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">
                        {isNew ? 'New Article' : 'Edit Article'}
                    </h2>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSave}
                            disabled={isSaving || !editing.title.trim()}
                            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    Save
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => {
                                setEditing(null);
                                setIsNew(false);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600"
                        >
                            <X className="w-4 h-4" />
                            Cancel
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Title *
                        </label>
                        <input
                            type="text"
                            value={editing.title}
                            onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-teal-500 focus:outline-none"
                            placeholder="Article title"
                        />
                    </div>

                    {/* Slug */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            URL Slug *
                        </label>
                        <input
                            type="text"
                            value={editing.slug}
                            onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-teal-500 focus:outline-none"
                            placeholder="article-url-slug"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                            URL: /blog/{editing.slug || 'article-url-slug'}
                        </p>
                    </div>

                    {/* Meta Description */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Meta Description * (150-160 characters)
                        </label>
                        <textarea
                            value={editing.meta_description}
                            onChange={(e) => setEditing({ ...editing, meta_description: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-teal-500 focus:outline-none"
                            rows={2}
                            placeholder="Brief description for search engines"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                            {editing.meta_description.length} / 160 characters
                        </p>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Category *
                        </label>
                        <input
                            type="text"
                            value={editing.category}
                            onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-teal-500 focus:outline-none"
                            placeholder="e.g., Web Development, AI, Software"
                        />
                    </div>

                    {/* Keywords */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Keywords (comma-separated)
                        </label>
                        <input
                            type="text"
                            value={editing.meta_keywords?.join(', ')}
                            onChange={(e) => setEditing({
                                ...editing,
                                meta_keywords: e.target.value.split(',').map(k => k.trim())
                            })}
                            className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-teal-500 focus:outline-none"
                            placeholder="keyword1, keyword2, keyword3"
                        />
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Tags (comma-separated)
                        </label>
                        <input
                            type="text"
                            value={editing.tags?.join(', ')}
                            onChange={(e) => setEditing({
                                ...editing,
                                tags: e.target.value.split(',').map(t => t.trim())
                            })}
                            className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-teal-500 focus:outline-none"
                            placeholder="tag1, tag2, tag3"
                        />
                    </div>

                    {/* Content */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Content * (Markdown supported)
                        </label>
                        <textarea
                            value={editing.content}
                            onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-700 text-white rounded border border-slate-600 focus:border-teal-500 focus:outline-none font-mono text-sm"
                            rows={20}
                            placeholder="Write your article content here... Use markdown for formatting."
                        />
                        <p className="text-xs text-slate-400 mt-1">
                            {editing.content.split(/\s+/).length} words
                        </p>
                    </div>

                    {/* Published */}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={editing.published}
                            onChange={(e) => setEditing({ ...editing, published: e.target.checked })}
                            className="w-4 h-4"
                        />
                        <label className="text-sm text-slate-300">
                            Publish article (make visible to search engines)
                        </label>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">SEO Articles</h2>
                    <p className="text-slate-400">Manage your SEO content</p>
                </div>
                <button
                    onClick={() => {
                        setEditing(emptyArticle as Article);
                        setIsNew(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600"
                >
                    <Plus className="w-4 h-4" />
                    New Article
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-800 rounded-lg p-4">
                    <div className="text-2xl font-bold text-white">{articles.length}</div>
                    <div className="text-sm text-slate-400">Total Articles</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-4">
                    <div className="text-2xl font-bold text-teal-400">
                        {articles.filter(a => a.published).length}
                    </div>
                    <div className="text-sm text-slate-400">Published</div>
                </div>
                <div className="bg-slate-800 rounded-lg p-4">
                    <div className="text-2xl font-bold text-violet-400">
                        {articles.reduce((sum: number, a: Article) => sum + (a.views || 0), 0)}
                    </div>
                    <div className="text-sm text-slate-400">Total Views</div>
                </div>
            </div>

            {/* Articles List */}
            <div className="bg-slate-800 rounded-lg overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-700">
                        <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Title</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Category</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Views</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Status</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-slate-300">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700">
                        {articles.map((article) => (
                            <tr key={article.id} className="hover:bg-slate-700/50">
                                <td className="px-4 py-3">
                                    <div className="text-white font-medium">{article.title}</div>
                                    <div className="text-xs text-slate-400">/blog/{article.slug}</div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded">
                                        {article.category}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-slate-300">{article.views || 0}</td>
                                <td className="px-4 py-3">
                                    {article.published ? (
                                        <span className="px-2 py-1 bg-teal-500/20 text-teal-400 text-xs rounded">
                                            Published
                                        </span>
                                    ) : (
                                        <span className="px-2 py-1 bg-slate-700 text-slate-400 text-xs rounded">
                                            Draft
                                        </span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => togglePublished(article)}
                                            className="p-2 text-slate-400 hover:text-teal-400"
                                            title={article.published ? 'Unpublish' : 'Publish'}
                                        >
                                            {article.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => setEditing(article)}
                                            className="p-2 text-slate-400 hover:text-violet-400"
                                            title="Edit"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(article.id)}
                                            className="p-2 text-slate-400 hover:text-red-400"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ArticleEditor;
