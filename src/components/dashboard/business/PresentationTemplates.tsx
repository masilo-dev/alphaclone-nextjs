'use client';

import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { Download, Eye, Palette, Layout, Type, Image as ImageIcon, Sliders, Copy, Share2, FileText, Presentation, Zap, Sparkles, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../../ui/UIComponents';
import { cn } from '@/lib/utils';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface PresentationTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    thumbnail: string;
    colors: string[];
    fonts: string[];
    slideCount: number;
    tags: string[];
    premium: boolean;
}

interface SlideContent {
    title: string;
    subtitle?: string;
    content: string[];
    image?: string;
    layout: 'title' | 'content' | 'image-left' | 'image-right' | 'two-column' | 'three-column';
}

const PRESENTATION_TEMPLATES: PresentationTemplate[] = [
    {
        id: 'alphaclone-corporate',
        name: 'AlphaClone Corporate',
        description: 'Professional corporate presentation with modern design',
        category: 'Corporate',
        thumbnail: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=500&q=80',
        colors: ['#1e40af', '#3b82f6', '#60a5fa', '#93c5fd'],
        fonts: ['Inter', 'Roboto', 'Arial'],
        slideCount: 12,
        tags: ['corporate', 'professional', 'business'],
        premium: false
    },
    {
        id: 'tech-innovation',
        name: 'Tech Innovation',
        description: 'Cutting-edge technology presentation with dynamic elements',
        category: 'Technology',
        thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=500&q=80',
        colors: ['#7c3aed', '#a855f7', '#c084fc', '#ddd6fe'],
        fonts: ['Space Grotesk', 'Inter', 'Arial'],
        slideCount: 15,
        tags: ['technology', 'innovation', 'startup'],
        premium: false
    },
    {
        id: 'creative-studio',
        name: 'Creative Studio',
        description: 'Bold and creative design for creative agencies',
        category: 'Creative',
        thumbnail: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=500&q=80',
        colors: ['#dc2626', '#ef4444', '#f87171', '#fca5a5'],
        fonts: ['Poppins', 'Montserrat', 'Arial'],
        slideCount: 10,
        tags: ['creative', 'design', 'agency'],
        premium: true
    },
    {
        id: 'minimal-clean',
        name: 'Minimal Clean',
        description: 'Clean and minimal design for maximum impact',
        category: 'Minimal',
        thumbnail: '🤍',
        colors: ['#1f2937', '#374151', '#6b7280', '#9ca3af'],
        fonts: ['Helvetica', 'Arial', 'Inter'],
        slideCount: 8,
        tags: ['minimal', 'clean', 'modern'],
        premium: false
    },
    {
        id: 'startup-pitch',
        name: 'Startup Pitch',
        description: 'Perfect for startup pitches and investor presentations',
        category: 'Startup',
        thumbnail: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=500&q=80',
        colors: ['#059669', '#10b981', '#34d399', '#6ee7b7'],
        fonts: ['Inter', 'Roboto', 'Arial'],
        slideCount: 20,
        tags: ['startup', 'pitch', 'investor'],
        premium: false
    },
    {
        id: 'luxury-premium',
        name: 'Luxury Premium',
        description: 'High-end luxury presentation for premium brands',
        category: 'Luxury',
        thumbnail: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=500&q=80',
        colors: ['#1e293b', '#334155', '#475569', '#64748b'],
        fonts: ['Playfair Display', 'Cormorant Garamond', 'Georgia'],
        slideCount: 14,
        tags: ['luxury', 'premium', 'high-end'],
        premium: true
    }
];

const DEFAULT_SLIDES: SlideContent[] = [
    {
        title: 'Welcome to AlphaClone',
        subtitle: 'Innovation Meets Excellence',
        content: [
            'Transform your business with cutting-edge technology',
            'Streamlined workflows and enhanced productivity',
            'Data-driven insights for better decision making'
        ],
        layout: 'title'
    },
    {
        title: 'Our Mission',
        content: [
            'To empower businesses with intelligent automation',
            'To create seamless digital experiences',
            'To drive innovation through technology'
        ],
        layout: 'content'
    },
    {
        title: 'Key Features',
        content: [
            'Advanced AI-powered analytics',
            'Real-time collaboration tools',
            'Comprehensive business intelligence',
            'Scalable cloud infrastructure'
        ],
        layout: 'two-column'
    },
    {
        title: 'Thank You',
        subtitle: 'Questions & Discussion',
        content: [
            'Contact us: hello@alphaclone.com',
            'Website: www.alphaclone.com',
            'Follow us: @AlphaCloneSystems'
        ],
        layout: 'title'
    }
];

export default function PresentationTemplates() {
    const [selectedTemplate, setSelectedTemplate] = useState<PresentationTemplate | null>(null);
    const [slides, setSlides] = useState<SlideContent[]>(DEFAULT_SLIDES);
    const [selectedColor, setSelectedColor] = useState(0);
    const [selectedFont, setSelectedFont] = useState(0);
    const [previewMode, setPreviewMode] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isExporting, setIsExporting] = useState(false);
    const [exportFormat, setExportFormat] = useState<'pdf'>('pdf');

    const slideRef = useRef<HTMLDivElement>(null);

    const handleTemplateSelect = (template: PresentationTemplate) => {
        setSelectedTemplate(template);
        setSelectedColor(0);
        setSelectedFont(0);
    };

    const handleSlideEdit = (index: number, field: keyof SlideContent, value: any) => {
        const newSlides = [...slides];
        newSlides[index] = { ...newSlides[index], [field]: value };
        setSlides(newSlides);
    };

    const addSlide = () => {
        const newSlide: SlideContent = {
            title: 'New Slide',
            content: ['Add your content here'],
            layout: 'content'
        };
        setSlides([...slides, newSlide]);
    };

    const deleteSlide = (index: number) => {
        if (slides.length > 1) {
            setSlides(slides.filter((_, i) => i !== index));
            if (currentSlide >= slides.length - 1) {
                setCurrentSlide(Math.max(0, slides.length - 2));
            }
        }
    };

    const exportToPDF = async () => {
        setIsExporting(true);
        try {
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'px',
                format: [1920, 1080]
            });

            for (let i = 0; i < slides.length; i++) {
                if (i > 0) pdf.addPage();
                setCurrentSlide(i);

                // Wait for React to render
                await new Promise(resolve => setTimeout(resolve, 100));

                if (slideRef.current) {
                    const canvas = await html2canvas(slideRef.current, {
                        scale: 2,
                        useCORS: true,
                        backgroundColor: null
                    });

                    const imgData = canvas.toDataURL('image/png');
                    pdf.addImage(imgData, 'PNG', 0, 0, 1920, 1080);
                }
            }

            pdf.save(`AlphaClone-Presentation-${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('Error exporting to PDF:', error);
        } finally {
            setIsExporting(false);
        }
    };


    const renderSlideContent = (slide: SlideContent, index: number) => {
        const primaryColor = selectedTemplate?.colors[selectedColor] || '#1e40af';
        const fontFamily = selectedTemplate?.fonts[selectedFont] || 'Inter';

        return (
            <div
                key={index}
                className="w-full h-full bg-gradient-to-br from-white to-gray-50 rounded-lg shadow-2xl p-12 flex flex-col justify-center"
                style={{
                    background: `linear-gradient(135deg, ${primaryColor} 0%, ${selectedTemplate?.colors[selectedColor + 1] || primaryColor} 100%)`,
                    fontFamily
                }}
            >
                {slide.layout === 'title' && (
                    <div className="text-center text-white">
                        <h1 className="text-6xl font-bold mb-4">{slide.title}</h1>
                        {slide.subtitle && <h2 className="text-3xl font-light">{slide.subtitle}</h2>}
                        <div className="mt-8 space-y-2">
                            {slide.content.map((item, i) => (
                                <p key={i} className="text-xl opacity-90">{item}</p>
                            ))}
                        </div>
                    </div>
                )}

                {slide.layout === 'content' && (
                    <div className="text-white">
                        <h1 className="text-5xl font-bold mb-8">{slide.title}</h1>
                        <div className="space-y-4">
                            {slide.content.map((item, i) => (
                                <div key={i} className="flex items-start gap-4">
                                    <div className="w-2 h-2 bg-white rounded-full mt-3 flex-shrink-0"></div>
                                    <p className="text-2xl opacity-90">{item}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {slide.layout === 'two-column' && (
                    <div className="grid grid-cols-2 gap-12 text-white h-full">
                        <div className="flex flex-col justify-center">
                            <h1 className="text-5xl font-bold mb-8">{slide.title}</h1>
                            {slide.subtitle && <h2 className="text-2xl font-light mb-4">{slide.subtitle}</h2>}
                        </div>
                        <div className="flex flex-col justify-center space-y-4">
                            {slide.content.map((item, i) => (
                                <div key={i} className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                                    <p className="text-xl">{item}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    if (previewMode && selectedTemplate) {
        return (
            <div className="fixed inset-0 bg-black z-50 flex flex-col">
                <div className="bg-gray-900 p-4 flex items-center justify-between">
                    <div className="text-white">
                        <span className="text-sm opacity-75">Slide {currentSlide + 1} of {slides.length}</span>
                        <h3 className="font-semibold">{slides[currentSlide].title}</h3>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentSlide(Math.max(0, currentSlide - 1))}
                            disabled={currentSlide === 0}
                            className="px-4 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setCurrentSlide(Math.min(slides.length - 1, currentSlide + 1))}
                            disabled={currentSlide === slides.length - 1}
                            className="px-4 py-2 bg-gray-700 text-white rounded-lg disabled:opacity-50"
                        >
                            Next
                        </button>
                        <button
                            onClick={() => setPreviewMode(false)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg"
                        >
                            Exit Preview
                        </button>
                    </div>
                </div>
                <div className="flex-1 p-8 bg-gray-800">
                    <div className="w-full h-full max-w-6xl mx-auto" ref={slideRef}>
                        {renderSlideContent(slides[currentSlide], currentSlide)}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-4 flex items-center justify-center gap-3">
                        <Presentation className="w-10 h-10 text-teal-400" />
                        AlphaClone Presentation Templates
                    </h1>
                    <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                        Create stunning presentations with our professionally designed templates.
                        Perfect for pitches, reports, and business presentations.
                    </p>
                </div>

                {/* Template Selection */}
                {!selectedTemplate && (
                    <div className="mb-12">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-white">Choose Your Template</h2>
                            <div className="flex gap-2">
                                <button className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700">
                                    All Templates
                                </button>
                                <button className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700">
                                    Premium Only
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {PRESENTATION_TEMPLATES.map((template) => (
                                <motion.div
                                    key={template.id}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-teal-500 transition-all cursor-pointer"
                                    onClick={() => handleTemplateSelect(template)}
                                >
                                    <div className="text-center">
                                        <div className="mb-4 h-32 w-full overflow-hidden rounded-lg relative">
                                            <Image src={template.thumbnail} alt={template.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-2">{template.name}</h3>
                                        <p className="text-gray-400 text-sm mb-4">{template.description}</p>

                                        <div className="flex justify-center gap-1 mb-4">
                                            {template.colors.map((color, index) => (
                                                <div
                                                    key={index}
                                                    className="w-6 h-6 rounded-full border-2 border-gray-600"
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </div>

                                        <div className="flex items-center justify-between text-sm text-gray-400">
                                            <span>{template.slideCount} slides</span>
                                            <span className="capitalize">{template.category}</span>
                                        </div>

                                        {template.premium && (
                                            <div className="mt-3 inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded-lg text-xs">
                                                <Sparkles className="w-3 h-3" />
                                                Premium
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Editor */}
                {selectedTemplate && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Sidebar */}
                        <div className="lg:col-span-1 space-y-6">
                            {/* Template Info */}
                            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                                <div className="text-center mb-4">
                                    <div className="mb-4 h-48 w-full overflow-hidden rounded-lg relative">
                                        <Image src={selectedTemplate.thumbnail} alt={selectedTemplate.name} fill className="object-cover" sizes="(max-width: 768px) 100vw, 300px" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">{selectedTemplate.name}</h3>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Color Scheme</label>
                                        <div className="grid grid-cols-4 gap-2">
                                            {selectedTemplate.colors.map((color, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => setSelectedColor(index)}
                                                    className={`w-12 h-12 rounded-lg border-2 transition-all ${selectedColor === index ? 'border-white scale-110' : 'border-gray-600'
                                                        }`}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Font Family</label>
                                        <select
                                            value={selectedFont}
                                            onChange={(e) => setSelectedFont(parseInt(e.target.value))}
                                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2"
                                        >
                                            {selectedTemplate.fonts.map((font, index) => (
                                                <option key={index} value={index}>{font}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Slide List */}
                            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-white font-semibold">Slides ({slides.length})</h4>
                                    <button
                                        onClick={addSlide}
                                        className="p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                    {slides.map((slide, index) => (
                                        <div
                                            key={index}
                                            onClick={() => setCurrentSlide(index)}
                                            className={`p-3 rounded-lg cursor-pointer transition-all ${currentSlide === index
                                                ? 'bg-teal-600/20 border border-teal-500'
                                                : 'bg-gray-700 hover:bg-gray-600 border border-gray-600'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-white text-sm font-medium truncate">
                                                        {slide.title}
                                                    </p>
                                                    <p className="text-gray-400 text-xs">
                                                        {slide.layout} layout
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteSlide(index);
                                                    }}
                                                    className="p-1 text-gray-400 hover:text-red-400"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Main Editor */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Slide Preview */}
                            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                                <div className="flex items-center justify-between mb-4">
                                    <h4 className="text-white font-semibold">Slide Preview</h4>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setPreviewMode(true)}
                                            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                        >
                                            <Eye className="w-4 h-4" />
                                            Preview
                                        </button>
                                        <button
                                            onClick={exportToPDF}
                                            disabled={isExporting}
                                            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                        >
                                            <Download className="w-4 h-4" />
                                            {isExporting ? 'Exporting...' : 'Export PDF'}
                                        </button>
                                    </div>
                                </div>

                                <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden" ref={slideRef}>
                                    {renderSlideContent(slides[currentSlide], currentSlide)}
                                </div>
                            </div>

                            {/* Slide Editor */}
                            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                                <h4 className="text-white font-semibold mb-4">Edit Slide</h4>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                                        <input
                                            type="text"
                                            value={slides[currentSlide].title}
                                            onChange={(e) => handleSlideEdit(currentSlide, 'title', e.target.value)}
                                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Subtitle (Optional)</label>
                                        <input
                                            type="text"
                                            value={slides[currentSlide].subtitle || ''}
                                            onChange={(e) => handleSlideEdit(currentSlide, 'subtitle', e.target.value)}
                                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Layout</label>
                                        <select
                                            value={slides[currentSlide].layout}
                                            onChange={(e) => handleSlideEdit(currentSlide, 'layout', e.target.value)}
                                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2"
                                        >
                                            <option value="title">Title Slide</option>
                                            <option value="content">Content Only</option>
                                            <option value="image-left">Image Left</option>
                                            <option value="image-right">Image Right</option>
                                            <option value="two-column">Two Column</option>
                                            <option value="three-column">Three Column</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Content (One per line)</label>
                                        <textarea
                                            value={slides[currentSlide].content.join('\n')}
                                            onChange={(e) => handleSlideEdit(currentSlide, 'content', e.target.value.split('\n').filter(line => line.trim()))}
                                            rows={6}
                                            className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2"
                                            placeholder="Enter each bullet point on a new line"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}