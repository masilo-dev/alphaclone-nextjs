'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Image as ImageIcon, Video, Send, Calendar, Clock, X, Plus, Hash,
    Upload, Loader2, CheckCircle2, Facebook, Globe, Trash2, Eye,
    RefreshCw, Link2, Sparkles, Play, Film, AlertTriangle, ExternalLink
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface MediaAsset {
    id: string;
    file_name: string;
    asset_type: string;
    public_url: string;
    file_size_bytes: number;
    width: number | null;
    height: number | null;
    duration_secs: number | null;
    created_at: string;
}

interface SocialPost {
    id: string;
    title: string | null;
    caption: string;
    platforms: string[];
    media_urls: string[];
    media_types: string[];
    hashtags: string[];
    status: string;
    scheduled_at: string | null;
    published_at: string | null;
    facebook_post_id: string | null;
    error_message: string | null;
    created_at: string;
}

interface FacebookPage {
    page_id: string;
    page_name: string;
}

const STATUS_STYLE: Record<string, string> = {
    draft:       'bg-slate-700/50 text-slate-400 border-slate-700',
    scheduled:   'bg-blue-500/15 text-blue-400 border-blue-500/30',
    publishing:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
    published:   'bg-green-500/15 text-green-400 border-green-500/30',
    failed:      'bg-red-500/15 text-red-400 border-red-500/30',
};

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
    facebook: <Facebook className="w-3.5 h-3.5" />,
    platform: <Globe className="w-3.5 h-3.5" />,
};

export default function SocialMediaComposer() {
    const { currentTenant: tenant } = useTenant();
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [posts, setPosts] = useState<SocialPost[]>([]);
    const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
    const [fbPages, setFbPages] = useState<FacebookPage[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'compose' | 'posts' | 'media'>('compose');

    // Composer state
    const [caption, setCaption] = useState('');
    const [platforms, setPlatforms] = useState<string[]>(['facebook']);
    const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
    const [selectedMediaTypes, setSelectedMediaTypes] = useState<string[]>([]);
    const [hashtagInput, setHashtagInput] = useState('');
    const [hashtags, setHashtags] = useState<string[]>([]);
    const [linkUrl, setLinkUrl] = useState('');
    const [scheduledAt, setScheduledAt] = useState('');
    const [selectedPageId, setSelectedPageId] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showMediaPicker, setShowMediaPicker] = useState(false);

    // Upload state
    const [uploading, setUploading] = useState(false);

    const loadData = useCallback(async () => {
        if (!tenant?.id || !user) return;
        setLoading(true);
        const [postsRes, mediaRes, pagesRes] = await Promise.all([
            supabase.from('social_posts').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(50),
            supabase.from('media_assets').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }),
            supabase.from('facebook_integrations').select('page_id,page_name').eq('user_id', user.id).eq('is_active', true),
        ]);
        if (!postsRes.error) setPosts(postsRes.data || []);
        if (!mediaRes.error) setMediaAssets(mediaRes.data || []);
        if (!pagesRes.error) {
            setFbPages(pagesRes.data || []);
            if (pagesRes.data?.[0]) setSelectedPageId(pagesRes.data[0].page_id);
        }
        setLoading(false);
    }, [tenant?.id, user]);

    useEffect(() => { loadData(); }, [loadData]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (!files.length || !tenant?.id) return;
        setUploading(true);
        for (const file of files) {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('tenantId', tenant.id);
            const toastId = toast.loading(`Uploading ${file.name}...`);
            const res = await fetch('/api/social/media/upload', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.success) {
                toast.success('Uploaded!', { id: toastId });
                setMediaAssets(prev => [data.asset, ...prev]);
            } else {
                toast.error(data.error || 'Upload failed', { id: toastId });
            }
        }
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleAddHashtag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            const tag = hashtagInput.trim().replace(/^#/, '');
            if (tag && !hashtags.includes(tag)) {
                setHashtags(prev => [...prev, tag]);
            }
            setHashtagInput('');
            e.preventDefault();
        }
    };

    const togglePlatform = (p: string) => {
        setPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
    };

    const toggleMediaSelect = (asset: MediaAsset) => {
        if (selectedMedia.includes(asset.public_url)) {
            setSelectedMedia(prev => prev.filter(u => u !== asset.public_url));
            setSelectedMediaTypes(prev => prev.filter((_, i) => selectedMedia[i] !== asset.public_url));
        } else {
            setSelectedMedia(prev => [...prev, asset.public_url]);
            setSelectedMediaTypes(prev => [...prev, asset.asset_type]);
        }
    };

    const handleSubmit = async (publishNow = false) => {
        if (!caption.trim()) return toast.error('Caption is required');
        if (platforms.length === 0) return toast.error('Select at least one platform');
        if (!publishNow && !scheduledAt) return toast.error('Choose "Post Now" or set a schedule date');

        setSubmitting(true);
        const toastId = toast.loading(publishNow ? 'Publishing...' : 'Scheduling post...');

        const finalCaption = caption + (hashtags.length > 0 ? '\n\n' + hashtags.map(h => `#${h}`).join(' ') : '');

        const res = await fetch('/api/social/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tenantId: tenant?.id,
                caption: finalCaption,
                platforms,
                media_urls: selectedMedia,
                media_types: selectedMediaTypes,
                link_url: linkUrl || undefined,
                hashtags,
                scheduled_at: publishNow ? undefined : scheduledAt || undefined,
                facebook_page_id: platforms.includes('facebook') ? selectedPageId : undefined,
            }),
        });
        const data = await res.json();

        if (data.success) {
            toast.success(publishNow ? 'Post sent!' : 'Post scheduled!', { id: toastId });
            setCaption('');
            setHashtags([]);
            setHashtagInput('');
            setSelectedMedia([]);
            setSelectedMediaTypes([]);
            setLinkUrl('');
            setScheduledAt('');
            loadData();
            setActiveTab('posts');
        } else {
            toast.error(data.error || 'Failed', { id: toastId });
        }
        setSubmitting(false);
    };

    const handleDeletePost = async (id: string) => {
        if (!confirm('Delete this post?')) return;
        await supabase.from('social_posts').delete().eq('id', id);
        setPosts(prev => prev.filter(p => p.id !== id));
        toast.success('Deleted');
    };

    const handleDeleteMedia = async (asset: MediaAsset) => {
        if (!confirm('Delete this media asset?')) return;
        await supabase.from('media_assets').delete().eq('id', asset.id);
        setMediaAssets(prev => prev.filter(a => a.id !== asset.id));
        toast.success('Deleted');
    };

    const charCount = caption.length;
    const fbCharLimit = 63206;
    const charWarning = charCount > 2000;

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-teal-400" />
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">Social Media Composer</h2>
                    <p className="text-sm text-slate-400">Create, schedule and publish posts with images & video</p>
                </div>
                <button onClick={loadData} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-400 hover:text-white">
                    <RefreshCw className="w-3 h-3" /> Refresh
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-800/60 border border-slate-700 rounded-xl w-fit">
                {(['compose', 'posts', 'media'] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${activeTab === tab ? 'bg-teal-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                        {tab === 'compose' ? 'Composer' : tab === 'posts' ? `Posts (${posts.length})` : `Media (${mediaAssets.length})`}
                    </button>
                ))}
            </div>

            {/* COMPOSE TAB */}
            {activeTab === 'compose' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main composer */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Caption */}
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Caption *</label>
                            <textarea
                                value={caption}
                                onChange={e => setCaption(e.target.value)}
                                rows={6}
                                placeholder="Write your post caption here... Use {{business_name}} or your own variables."
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none text-sm"
                            />
                            <p className={`text-xs text-right mt-1 ${charWarning ? 'text-amber-400' : 'text-slate-600'}`}>
                                {charCount.toLocaleString()} chars
                            </p>
                        </div>

                        {/* Media selection */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Media (images / video)</label>
                                <div className="flex gap-2">
                                    <button onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded-lg transition-colors">
                                        {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                        Upload
                                    </button>
                                    <button onClick={() => setShowMediaPicker(!showMediaPicker)}
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded-lg transition-colors">
                                        <ImageIcon className="w-3 h-3" /> Library
                                    </button>
                                </div>
                            </div>
                            <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" onChange={handleFileUpload} className="hidden" />

                            {selectedMedia.length > 0 && (
                                <div className="flex gap-2 flex-wrap mb-3">
                                    {selectedMedia.map((url, i) => (
                                        <div key={url} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-slate-700">
                                            {selectedMediaTypes[i] === 'video' ? (
                                                <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                                                    <Film className="w-6 h-6 text-slate-400" />
                                                </div>
                                            ) : (
                                                <img src={url} alt="" className="w-full h-full object-cover" />
                                            )}
                                            <button onClick={() => toggleMediaSelect({ public_url: url } as MediaAsset)}
                                                className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <X className="w-3 h-3 text-white" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {showMediaPicker && (
                                <div className="border border-slate-700 rounded-xl p-3 bg-slate-900/50 max-h-60 overflow-y-auto">
                                    {mediaAssets.length === 0 ? (
                                        <p className="text-slate-500 text-xs text-center py-4">No media uploaded yet</p>
                                    ) : (
                                        <div className="grid grid-cols-4 gap-2">
                                            {mediaAssets.map(asset => (
                                                <button key={asset.id} onClick={() => toggleMediaSelect(asset)}
                                                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${selectedMedia.includes(asset.public_url) ? 'border-teal-500' : 'border-transparent hover:border-slate-600'}`}>
                                                    {asset.asset_type === 'video' ? (
                                                        <div className="w-full aspect-square bg-slate-800 flex items-center justify-center">
                                                            <Film className="w-5 h-5 text-slate-400" />
                                                        </div>
                                                    ) : (
                                                        <img src={asset.public_url} alt={asset.file_name} className="w-full aspect-square object-cover" />
                                                    )}
                                                    {selectedMedia.includes(asset.public_url) && (
                                                        <div className="absolute inset-0 bg-teal-500/20 flex items-center justify-center">
                                                            <CheckCircle2 className="w-5 h-5 text-teal-400" />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Hashtags */}
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Hashtags</label>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {hashtags.map(tag => (
                                    <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/15 border border-blue-500/30 text-blue-400 rounded-full text-xs">
                                        #{tag}
                                        <button onClick={() => setHashtags(prev => prev.filter(h => h !== tag))} className="hover:text-red-400">
                                            <X className="w-2.5 h-2.5" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <input
                                value={hashtagInput}
                                onChange={e => setHashtagInput(e.target.value)}
                                onKeyDown={handleAddHashtag}
                                placeholder="Type hashtag + Enter (no # needed)"
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm"
                            />
                        </div>

                        {/* Link */}
                        <div>
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Link (optional)</label>
                            <div className="relative">
                                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                                    placeholder="https://yourwebsite.com"
                                    className="w-full pl-9 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 text-sm" />
                            </div>
                        </div>

                        {/* Video editing note */}
                        <div className="flex gap-3 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                            <Film className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                            <div className="text-xs text-purple-300">
                                <p className="font-semibold mb-0.5">Video editing</p>
                                <p className="text-purple-400">Upload your video via the Upload button above. For trimming/editing, use your device editor before uploading, or integrate a cloud editor like Cloudinary or Mux (roadmap item).</p>
                            </div>
                        </div>
                    </div>

                    {/* Right panel — platforms + schedule */}
                    <div className="space-y-5">
                        {/* Preview */}
                        <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-4">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Preview</p>
                            <div className="bg-slate-800 rounded-xl p-3">
                                {selectedMedia[0] && (
                                    selectedMediaTypes[0] === 'video'
                                        ? <div className="w-full aspect-video bg-slate-900 rounded-lg flex items-center justify-center mb-3"><Film className="w-8 h-8 text-slate-600" /></div>
                                        : <img src={selectedMedia[0]} alt="" className="w-full rounded-lg mb-3 object-cover max-h-48" />
                                )}
                                <p className="text-sm text-white whitespace-pre-line line-clamp-4">{caption || <span className="text-slate-600 italic">Your caption will appear here...</span>}</p>
                                {hashtags.length > 0 && (
                                    <p className="text-xs text-blue-400 mt-2">{hashtags.map(h => `#${h}`).join(' ')}</p>
                                )}
                            </div>
                        </div>

                        {/* Platforms */}
                        <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-4">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Platforms</p>
                            {[
                                { id: 'facebook', label: 'Facebook Page', icon: <Facebook className="w-4 h-4 text-blue-400" /> },
                                { id: 'platform', label: 'AlphaClone Platform', icon: <Globe className="w-4 h-4 text-teal-400" /> },
                            ].map(p => (
                                <label key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 cursor-pointer mb-1">
                                    <input type="checkbox" checked={platforms.includes(p.id)} onChange={() => togglePlatform(p.id)}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-teal-500 focus:ring-teal-500 focus:ring-offset-0" />
                                    {p.icon}
                                    <span className="text-sm text-slate-300">{p.label}</span>
                                </label>
                            ))}

                            {platforms.includes('facebook') && fbPages.length > 0 && (
                                <div className="mt-3">
                                    <label className="text-xs text-slate-500 mb-1 block">Page</label>
                                    <select value={selectedPageId} onChange={e => setSelectedPageId(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500">
                                        {fbPages.map(p => <option key={p.page_id} value={p.page_id}>{p.page_name}</option>)}
                                    </select>
                                </div>
                            )}

                            {platforms.includes('facebook') && fbPages.length === 0 && (
                                <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> Connect Facebook first
                                </p>
                            )}
                        </div>

                        {/* Schedule */}
                        <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-4">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Schedule</p>
                            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-teal-500 text-sm mb-3" />

                            <div className="flex flex-col gap-2">
                                <button onClick={() => handleSubmit(true)} disabled={submitting}
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition-colors">
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    Post Now
                                </button>
                                <button onClick={() => handleSubmit(false)} disabled={submitting || !scheduledAt}
                                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600/30 hover:bg-blue-600/50 disabled:opacity-40 border border-blue-500/30 text-blue-400 rounded-xl font-semibold text-sm transition-colors">
                                    <Calendar className="w-4 h-4" />
                                    Schedule Post
                                </button>
                                <button onClick={async () => {
                                    if (!caption.trim()) return toast.error('Caption required');
                                    const res = await fetch('/api/social/schedule', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ tenantId: tenant?.id, caption, platforms: [], media_urls: selectedMedia, media_types: selectedMediaTypes, hashtags, link_url: linkUrl || undefined, status: 'draft' }),
                                    });
                                    const d = await res.json();
                                    if (d.success) { toast.success('Saved as draft'); loadData(); setActiveTab('posts'); }
                                }} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-300 rounded-xl text-sm transition-colors">
                                    Save as Draft
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* POSTS TAB */}
            {activeTab === 'posts' && (
                <div className="space-y-3">
                    {posts.length === 0 ? (
                        <div className="text-center py-16 border border-dashed border-slate-700 rounded-2xl">
                            <Send className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-400 font-semibold">No posts yet</p>
                            <button onClick={() => setActiveTab('compose')} className="mt-3 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-sm font-semibold">Compose your first post</button>
                        </div>
                    ) : posts.map(post => (
                        <div key={post.id} className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[post.status] || STATUS_STYLE.draft}`}>
                                            {post.status}
                                        </span>
                                        {post.platforms.map(p => (
                                            <span key={p} className="flex items-center gap-1 text-xs px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-full text-slate-400">
                                                {PLATFORM_ICONS[p]}{p}
                                            </span>
                                        ))}
                                        {post.scheduled_at && (
                                            <span className="text-xs text-blue-400 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />{new Date(post.scheduled_at).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-300 line-clamp-3 whitespace-pre-line">{post.caption}</p>
                                    {post.media_urls?.length > 0 && (
                                        <div className="flex gap-2 mt-2">
                                            {post.media_urls.slice(0, 3).map((url, i) => (
                                                post.media_types?.[i] === 'video'
                                                    ? <div key={url} className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center"><Film className="w-4 h-4 text-slate-500" /></div>
                                                    : <img key={url} src={url} alt="" className="w-12 h-12 object-cover rounded-lg" />
                                            ))}
                                            {post.media_urls.length > 3 && <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center text-xs text-slate-400">+{post.media_urls.length - 3}</div>}
                                        </div>
                                    )}
                                    {post.error_message && (
                                        <p className="text-xs text-red-400 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{post.error_message}</p>
                                    )}
                                    {post.facebook_post_id && (
                                        <a href={`https://facebook.com/${post.facebook_post_id}`} target="_blank" rel="noopener noreferrer"
                                            className="text-xs text-blue-400 hover:underline mt-1 flex items-center gap-1">
                                            <ExternalLink className="w-3 h-3" /> View on Facebook
                                        </a>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <button onClick={() => handleDeletePost(post.id)}
                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* MEDIA LIBRARY TAB */}
            {activeTab === 'media' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-slate-400">{mediaAssets.length} assets in library</p>
                        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
                            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white rounded-xl font-semibold text-sm">
                            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            Upload
                        </button>
                    </div>
                    <input ref={fileInputRef} type="file" multiple accept="image/*,video/*" onChange={handleFileUpload} className="hidden" />

                    {mediaAssets.length === 0 ? (
                        <div className="text-center py-16 border border-dashed border-slate-700 rounded-2xl">
                            <ImageIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-400 font-semibold">No media yet</p>
                            <p className="text-slate-600 text-sm mt-1">Upload images and videos to use in your posts.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                            {mediaAssets.map(asset => (
                                <div key={asset.id} className="group relative rounded-xl overflow-hidden border border-slate-800 hover:border-slate-600 transition-colors bg-slate-900">
                                    {asset.asset_type === 'video' ? (
                                        <div className="aspect-square bg-slate-800 flex flex-col items-center justify-center gap-1">
                                            <Film className="w-8 h-8 text-slate-500" />
                                            <span className="text-xs text-slate-600">{asset.duration_secs ? `${Math.round(asset.duration_secs)}s` : 'Video'}</span>
                                        </div>
                                    ) : (
                                        <img src={asset.public_url} alt={asset.file_name} className="w-full aspect-square object-cover" />
                                    )}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                        <a href={asset.public_url} target="_blank" rel="noopener noreferrer"
                                            className="p-1.5 bg-slate-700 rounded-lg hover:bg-slate-600 transition-colors">
                                            <Eye className="w-3.5 h-3.5 text-white" />
                                        </a>
                                        <button onClick={() => handleDeleteMedia(asset)}
                                            className="p-1.5 bg-red-500/20 rounded-lg hover:bg-red-500/40 transition-colors">
                                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                        </button>
                                    </div>
                                    <div className="p-2">
                                        <p className="text-xs text-slate-500 truncate">{asset.file_name}</p>
                                        <p className="text-xs text-slate-700">{(asset.file_size_bytes / 1024).toFixed(0)} KB</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
