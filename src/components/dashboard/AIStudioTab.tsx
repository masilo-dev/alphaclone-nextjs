import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Modal } from '../ui/UIComponents';
import { User } from '../../types';
import { aiGenerationService } from '../../services/aiGenerationService';
import { rateLimitService } from '../../services/rateLimitService';
import { Sparkles, Image as ImageIcon, FileText, Loader2, Download, Trash2, Eye, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface AIStudioTabProps {
    user: User;
}

type GenerationType = 'logo' | 'image' | 'content';

interface GeneratedAsset {
    id: string;
    asset_type: GenerationType;
    prompt: string;
    url?: string;
    metadata: any;
    created_at: string;
}

/**
 * AI Studio Component with:
 * - Logo generation (DALL-E 3)
 * - Image generation (DALL-E 3)
 * - Content generation (Claude API)
 * - Rate limiting (3/day for clients, unlimited for admin)
 * - Generation history
 */
const AIStudioTab: React.FC<AIStudioTabProps> = ({ user }) => {
    const [activeTab, setActiveTab] = useState<GenerationType>('logo');
    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState<'modern' | 'minimalist' | 'vintage' | 'abstract'>('modern');
    const [imageSize, setImageSize] = useState<'1024x1024' | '1792x1024' | '1024x1792'>('1024x1024');
    const [contentType, setContentType] = useState<'blog' | 'email' | 'social' | 'general'>('general');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedResult, setGeneratedResult] = useState<string | null>(null);
    const [remainingGenerations, setRemainingGenerations] = useState<Record<GenerationType, number>>({
        logo: 3,
        image: 3,
        content: 3
    });
    const [history, setHistory] = useState<GeneratedAsset[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [previewModal, setPreviewModal] = useState<{ isOpen: boolean; url?: string; content?: string }>({
        isOpen: false
    });

    useEffect(() => {
        loadRemainingGenerations();
        loadHistory();
    }, []);

    const loadRemainingGenerations = async () => {
        const types: GenerationType[] = ['logo', 'image', 'content'];
        const remaining: Record<GenerationType, number> = { logo: 0, image: 0, content: 0 };

        for (const type of types) {
            const count = await rateLimitService.getRemainingGenerations(user.id, user.role, type);
            remaining[type] = count;
        }

        setRemainingGenerations(remaining);
    };

    const loadHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const { assets } = await aiGenerationService.getGenerationHistory(user.id, 20);
            setHistory(assets || []);
        } catch (err) {
            console.error('Failed to load history:', err);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            toast.error('Please enter a prompt');
            return;
        }

        if (user.role !== 'admin' && remainingGenerations[activeTab] <= 0) {
            toast.error('Daily generation limit reached. Resets at midnight.');
            return;
        }

        setIsGenerating(true);
        setGeneratedResult(null);

        try {
            let result;

            switch (activeTab) {
                case 'logo':
                    result = await aiGenerationService.generateLogo(user.id, user.role, prompt, style);
                    break;
                case 'image':
                    result = await aiGenerationService.generateImage(user.id, user.role, prompt, imageSize);
                    break;
                case 'content':
                    result = await aiGenerationService.generateContent(user.id, user.role, prompt, contentType);
                    break;
            }

            if (result.success) {
                if (result.url) {
                    setGeneratedResult(result.url);
                    toast.success('Generated successfully!');
                } else if (result.content) {
                    setGeneratedResult(result.content);
                    toast.success('Content generated successfully!');
                }

                // Update remaining count
                if (result.remaining !== undefined) {
                    setRemainingGenerations(prev => ({
                        ...prev,
                        [activeTab]: result.remaining!
                    }));
                }

                // Reload history
                loadHistory();
                setPrompt('');
            } else {
                toast.error(result.error || 'Generation failed');
            }
        } catch (err) {
            console.error('Generation error:', err);
            toast.error('Failed to generate. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDeleteAsset = async (assetId: string) => {
        if (!confirm('Delete this generated asset?')) return;

        try {
            const { success } = await aiGenerationService.deleteAsset(assetId, user.id);
            if (success) {
                toast.success('Asset deleted');
                loadHistory();
            } else {
                toast.error('Failed to delete asset');
            }
        } catch (err) {
            toast.error('Failed to delete asset');
        }
    };

    const handlePreview = (asset: GeneratedAsset) => {
        if (asset.asset_type === 'content') {
            setPreviewModal({
                isOpen: true,
                content: asset.metadata?.content
            });
        } else {
            setPreviewModal({
                isOpen: true,
                url: asset.url
            });
        }
    };

    const getRemainingDisplay = (type: GenerationType) => {
        const remaining = remainingGenerations[type];
        if (user.role === 'admin') {
            return <span className="text-teal-400 font-semibold">Unlimited</span>;
        }
        return (
            <span className={`font-semibold ${remaining > 0 ? 'text-teal-400' : 'text-red-400'}`}>
                {remaining}/3 remaining today
            </span>
        );
    };

    const tabs: Array<{ id: GenerationType; label: string; icon: any; color: string }> = [
        { id: 'logo', label: 'Logo Generator', icon: Sparkles, color: 'text-purple-400' },
        { id: 'image', label: 'Image Generator', icon: ImageIcon, color: 'text-blue-400' },
        { id: 'content', label: 'Content Writer', icon: FileText, color: 'text-green-400' },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-teal-400" />
                    AI Studio
                </h2>
                <p className="text-slate-400 mt-1">
                    Create logos, images, and content with AI
                    {user.role !== 'admin' && ' • 3 generations per day'}
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all whitespace-nowrap ${
                            activeTab === tab.id
                                ? 'bg-slate-800 text-white border-b-2 border-teal-500'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                        }`}
                    >
                        <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? tab.color : ''}`} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Generation Form */}
            <Card className="p-6">
                <div className="space-y-6">
                    {/* Rate Limit Display */}
                    <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-teal-400" />
                            <span className="text-slate-300">Daily Usage</span>
                        </div>
                        {getRemainingDisplay(activeTab)}
                    </div>

                    {/* Prompt Input */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            {activeTab === 'content' ? 'What do you want to write?' : 'Describe what you want to generate'}
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
                            rows={4}
                            placeholder={
                                activeTab === 'logo' ? 'e.g., A modern tech startup logo with blue and green colors' :
                                activeTab === 'image' ? 'e.g., A futuristic city skyline at sunset with flying cars' :
                                'e.g., Write a blog post about the future of AI in business'
                            }
                        />
                    </div>

                    {/* Options */}
                    {activeTab === 'logo' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Style</label>
                            <select
                                value={style}
                                onChange={(e) => setStyle(e.target.value as any)}
                                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                            >
                                <option value="modern">Modern</option>
                                <option value="minimalist">Minimalist</option>
                                <option value="vintage">Vintage</option>
                                <option value="abstract">Abstract</option>
                            </select>
                        </div>
                    )}

                    {activeTab === 'image' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Size</label>
                            <select
                                value={imageSize}
                                onChange={(e) => setImageSize(e.target.value as any)}
                                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                            >
                                <option value="1024x1024">Square (1024x1024)</option>
                                <option value="1792x1024">Landscape (1792x1024)</option>
                                <option value="1024x1792">Portrait (1024x1792)</option>
                            </select>
                        </div>
                    )}

                    {activeTab === 'content' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Content Type</label>
                            <select
                                value={contentType}
                                onChange={(e) => setContentType(e.target.value as any)}
                                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                            >
                                <option value="general">General</option>
                                <option value="blog">Blog Post</option>
                                <option value="email">Email</option>
                                <option value="social">Social Media</option>
                            </select>
                        </div>
                    )}

                    {/* Generate Button */}
                    <Button
                        onClick={handleGenerate}
                        disabled={isGenerating || (!prompt.trim()) || (user.role !== 'admin' && remainingGenerations[activeTab] <= 0)}
                        className="w-full bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-500"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5 mr-2" />
                                Generate {activeTab === 'logo' ? 'Logo' : activeTab === 'image' ? 'Image' : 'Content'}
                            </>
                        )}
                    </Button>

                    {/* Result Display */}
                    {generatedResult && (
                        <div className="p-6 bg-slate-800/50 rounded-lg border border-teal-500/30">
                            <div className="text-sm font-semibold text-teal-400 mb-4">Generated Result</div>
                            {activeTab === 'content' ? (
                                <div className="prose prose-invert max-w-none">
                                    <pre className="whitespace-pre-wrap text-slate-300 text-sm leading-relaxed bg-slate-900/50 p-4 rounded-lg">
                                        {generatedResult}
                                    </pre>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <img
                                        src={generatedResult}
                                        alt="Generated"
                                        className="w-full rounded-lg border border-slate-700"
                                    />
                                    <Button
                                        onClick={() => window.open(generatedResult, '_blank')}
                                        variant="outline"
                                        className="w-full"
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        Download
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </Card>

            {/* Generation History */}
            <div>
                <h3 className="text-xl font-bold text-white mb-4">Recent Generations</h3>
                {isLoadingHistory ? (
                    <div className="flex justify-center p-12">
                        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                    </div>
                ) : history.length === 0 ? (
                    <Card className="p-12 text-center">
                        <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-400">No generations yet. Start creating!</p>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {history.map(asset => (
                            <Card key={asset.id} className="p-4 hover:border-teal-500/50 transition-all group">
                                {/* Asset Preview */}
                                <div className="relative mb-3">
                                    {asset.asset_type === 'content' ? (
                                        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700 h-40 flex items-center justify-center">
                                            <FileText className="w-12 h-12 text-slate-600" />
                                        </div>
                                    ) : (
                                        <img
                                            src={asset.url}
                                            alt={asset.prompt}
                                            className="w-full h-40 object-cover rounded-lg border border-slate-700"
                                        />
                                    )}
                                    {/* Overlay Actions */}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                                        <button
                                            onClick={() => handlePreview(asset)}
                                            className="p-2 bg-teal-600 rounded-lg hover:bg-teal-500 transition-colors"
                                            title="Preview"
                                        >
                                            <Eye className="w-4 h-4 text-white" />
                                        </button>
                                        {asset.url && (
                                            <button
                                                onClick={() => window.open(asset.url, '_blank')}
                                                className="p-2 bg-blue-600 rounded-lg hover:bg-blue-500 transition-colors"
                                                title="Download"
                                            >
                                                <Download className="w-4 h-4 text-white" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeleteAsset(asset.id)}
                                            className="p-2 bg-red-600 rounded-lg hover:bg-red-500 transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4 text-white" />
                                        </button>
                                    </div>
                                </div>

                                {/* Asset Info */}
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                            asset.asset_type === 'logo' ? 'bg-purple-500/10 text-purple-400' :
                                            asset.asset_type === 'image' ? 'bg-blue-500/10 text-blue-400' :
                                            'bg-green-500/10 text-green-400'
                                        }`}>
                                            {asset.asset_type}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-400 line-clamp-2 mb-2">{asset.prompt}</p>
                                    <p className="text-xs text-slate-500">
                                        {new Date(asset.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Preview Modal */}
            {previewModal.isOpen && (
                <Modal
                    isOpen={previewModal.isOpen}
                    onClose={() => setPreviewModal({ isOpen: false })}
                    title="Preview"
                >
                    {previewModal.url ? (
                        <img
                            src={previewModal.url}
                            alt="Preview"
                            className="w-full rounded-lg"
                        />
                    ) : (
                        <div className="prose prose-invert max-w-none">
                            <pre className="whitespace-pre-wrap text-slate-300 text-sm leading-relaxed bg-slate-900/50 p-4 rounded-lg max-h-[60vh] overflow-y-auto">
                                {previewModal.content}
                            </pre>
                        </div>
                    )}
                    <div className="mt-6">
                        <Button
                            onClick={() => setPreviewModal({ isOpen: false })}
                            variant="outline"
                            className="w-full"
                        >
                            Close
                        </Button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default AIStudioTab;
