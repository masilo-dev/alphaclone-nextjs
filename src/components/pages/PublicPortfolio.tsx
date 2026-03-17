'use client';

import React, { useState, useEffect } from 'react';
import { ExternalLink, Globe, Search, ArrowRight, Check } from 'lucide-react';
import { projectService } from '../../services/projectService';
import PublicNavigation from '../PublicNavigation';
import { Project } from '../../types';

const PublicPortfolio: React.FC = () => {
    const [, setIsLoginOpen] = React.useState(false);
    const [projects, setProjects] = useState<Project[]>([]);
    const [filter, setFilter] = useState<'all' | 'web' | 'mobile' | 'ai'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadProjects = async () => {
            setIsLoading(true);
            // Fetch all public portfolio projects
            const { projects: fetchedProjects } = await projectService.getPublicProjects();
            if (fetchedProjects) {
                // Filter for projects explicitly marked to show in portfolio
                const publicProjects = fetchedProjects.filter(p =>
                    (p.isPublic !== false && p.showInPortfolio !== false)
                );
                setProjects(publicProjects);
            }
            setIsLoading(false);
        };
        loadProjects();
    }, []);

    const filteredProjects = projects.filter((p) => {
        const matchesFilter =
            filter === 'all' ||
            p.category.toLowerCase().includes(filter) ||
            (filter === 'web' && (p.category.toLowerCase().includes('website') || p.category.toLowerCase().includes('web')));

        const matchesSearch =
            searchQuery === '' ||
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.description?.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesFilter && matchesSearch;
    });

    const categories = [
        { id: 'all', label: 'All Work', count: projects.length },
        { id: 'web', label: 'Websites', count: projects.filter(p => p.category.toLowerCase().includes('web')).length },
        { id: 'mobile', label: 'Mobile', count: projects.filter(p => p.category.toLowerCase().includes('mobile')).length },
        { id: 'ai', label: 'AI & Tech', count: projects.filter(p => p.category.toLowerCase().includes('ai')).length },
    ];

    return (
        <div className="min-h-screen bg-slate-950 relative">
            {/* Animated Background - matching landing page */}
            <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute inset-0 bg-slate-950" />
                <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-teal-500/8 blur-[80px] animate-blob" style={{ animationDuration: '20s' }} />
                <div className="absolute top-[-5%] right-[-10%] w-[45vw] h-[45vw] rounded-full bg-teal-400/6 blur-[80px] animate-blob" style={{ animationDuration: '25s', animationDelay: '2s' }} />
                <div className="absolute bottom-[-10%] left-[10%] w-[40vw] h-[40vw] rounded-full bg-teal-600/7 blur-[80px] animate-blob" style={{ animationDuration: '30s', animationDelay: '4s' }} />
            </div>

            <div className="relative z-10">
                <PublicNavigation onLoginClick={() => setIsLoginOpen(true)} />
                {/* Hero Section */}
                <div className="relative overflow-hidden py-24">
                    <div className="absolute inset-0 bg-gradient-to-b from-teal-500/5 to-transparent" />

                    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
                        <div className="text-center max-w-4xl mx-auto">
                            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 animate-fade-in">
                                Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-teal-600">Portfolio</span>
                            </h1>
                            <p className="text-xl md:text-2xl text-slate-300 mb-8 animate-fade-in">
                                Showcasing excellence in web development, mobile apps, and AI solutions
                            </p>
                            <div className="flex flex-wrap gap-4 justify-center text-slate-400 animate-fade-in">
                                <div className="flex items-center gap-2">
                                    <Check className="w-5 h-5 text-teal-400" />
                                    <span>{projects.length}+ Projects Delivered</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Check className="w-5 h-5 text-teal-400" />
                                    <span>100% Client Satisfaction</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Check className="w-5 h-5 text-teal-400" />
                                    <span>Award-Winning Design</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filter Section */}
                <div className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-lg border-b border-slate-800">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                            {/* Search */}
                            <div className="relative w-full md:w-96">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search projects..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-teal-500 transition-colors"
                                />
                            </div>

                            {/* Category Filter */}
                            <div className="flex gap-2 flex-wrap justify-center">
                                {categories.map((cat) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setFilter(cat.id as any)}
                                        className={`px-6 py-3 rounded-lg font-medium transition-all ${filter === cat.id
                                            ? 'bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-lg shadow-teal-500/25'
                                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                                            }`}
                                    >
                                        {cat.label} <span className="opacity-60">({cat.count})</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Portfolio Grid */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                    {isLoading ? (
                        <div className="text-center py-20">
                            <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-slate-400">Loading portfolio...</p>
                        </div>
                    ) : filteredProjects.length === 0 ? (
                        <div className="text-center py-20">
                            <Globe className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-2xl font-semibold text-white mb-2">No projects found</h3>
                            <p className="text-slate-400">
                                {searchQuery ? 'Try adjusting your search' : 'Check back soon for new projects'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {filteredProjects.map((project, index) => (
                                <a
                                    key={project.id}
                                    href={project.externalUrl || '#'}
                                    target={project.externalUrl ? '_blank' : '_self'}
                                    rel={project.externalUrl ? 'noopener noreferrer' : undefined}
                                    className="group relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 hover:border-teal-500/50 transition-all duration-500 hover:shadow-2xl hover:shadow-teal-500/20 animate-fade-in block"
                                    style={{ animationDelay: `${index * 100}ms` }}
                                >
                                    {/* Project Image */}
                                    <div className="aspect-[16/10] relative overflow-hidden bg-slate-800">
                                        <img
                                            src={project.image || 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800'}
                                            alt={project.name}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent opacity-60" />

                                        {/* Hover Overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-br from-teal-600/90 to-teal-700/90 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center">
                                            <div className="text-center transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                                                <ExternalLink className="w-12 h-12 text-white mx-auto mb-3" />
                                                <p className="text-white font-bold text-lg">View Project</p>
                                                <ArrowRight className="w-6 h-6 text-white mx-auto mt-2 animate-pulse" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Project Info */}
                                    <div className="p-6">
                                        <div className="mb-3">
                                            <span className="inline-block px-3 py-1 bg-teal-500/10 text-teal-400 text-xs font-semibold rounded-full border border-teal-500/20">
                                                {project.category}
                                            </span>
                                        </div>

                                        <h3 className="text-xl font-bold text-white mb-3 group-hover:text-teal-400 transition-colors">
                                            {project.name}
                                        </h3>

                                        <p className="text-slate-400 text-sm mb-4 line-clamp-2">
                                            {project.description || 'A stunning project showcasing modern design and cutting-edge technology.'}
                                        </p>

                                        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                                            <span className="text-xs text-slate-500">Completed</span>
                                            <div className="flex items-center gap-2 text-teal-400">
                                                <span className="text-sm font-medium">View Details</span>
                                                <ArrowRight className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>
                                </a>
                            ))}
                        </div>
                    )}
                </div>

                {/* CTA Section */}
                <div className="bg-gradient-to-br from-teal-600 to-teal-700 py-20">
                    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                        <h2 className="text-4xl font-bold text-white mb-6">
                            Ready to Start Your Project?
                        </h2>
                        <p className="text-xl text-teal-50 mb-8">
                            Let's create something amazing together. Get in touch today!
                        </p>
                        <a
                            href="/#contact"
                            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-teal-600 font-bold rounded-lg hover:bg-slate-100 transition-colors shadow-xl"
                        >
                            Get Started
                            <ArrowRight className="w-5 h-5" />
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PublicPortfolio;
