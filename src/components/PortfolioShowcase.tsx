import React from 'react';
import { ExternalLink, ArrowRight } from 'lucide-react';

interface PortfolioItem {
    id: number;
    title: string;
    description: string;
    url: string;
    image: string;
    category: string;
    technologies: string[];
    featured: boolean;
}

const portfolioWebsites: PortfolioItem[] = [
    {
        id: 1,
        title: "Yakazuma Store",
        description: "E-commerce platform for authentic South African products and cuisine. Features secure payments, inventory management, and customer reviews.",
        url: "https://yakazuma.store/",
        image: "https://via.placeholder.com/600x400/14b8a6/ffffff?text=Yakazuma+Store",
        category: "E-Commerce",
        technologies: ["React", "Node.js", "Stripe", "Tailwind CSS"],
        featured: true
    },
    {
        id: 2,
        title: "Movana",
        description: "Modern business solutions and digital transformation platform with advanced analytics and workflow automation.",
        url: "https://movana.com/",
        image: "https://via.placeholder.com/600x400/8b5cf6/ffffff?text=Movana",
        category: "Business Platform",
        technologies: ["React", "TypeScript", "Supabase"],
        featured: true
    },
    {
        id: 3,
        title: "Cozy Haven",
        description: "Premium hospitality and accommodation booking system with real-time availability and instant confirmations.",
        url: "https://cozyhaven.co.uk/",
        image: "https://via.placeholder.com/600x400/0d9488/ffffff?text=Cozy+Haven",
        category: "Hospitality",
        technologies: ["React", "Next.js", "Booking API"],
        featured: false
    },
    {
        id: 4,
        title: "Luna Antiques",
        description: "Elegant online marketplace for rare and vintage antiques with detailed cataloging and authentication.",
        url: "https://lunarantiques.co.uk/",
        image: "https://via.placeholder.com/600x400/7c3aed/ffffff?text=Luna+Antiques",
        category: "E-Commerce",
        technologies: ["React", "Shopify", "Custom CMS"],
        featured: false
    },
    {
        id: 5,
        title: "Szymon Masaz",
        description: "Professional massage therapy and wellness booking platform with appointment scheduling and payment processing.",
        url: "https://szymon-masaz.pl/",
        image: "https://via.placeholder.com/600x400/14b8a6/ffffff?text=Szymon+Masaz",
        category: "Healthcare",
        technologies: ["React", "Booking System", "Payment Integration"],
        featured: false
    },
    {
        id: 6,
        title: "Empowerement",
        description: "Personal development and coaching platform with video courses, live sessions, and progress tracking.",
        url: "https://empowerement.co.uk/",
        image: "https://via.placeholder.com/600x400/0d9488/ffffff?text=Empowerement",
        category: "Education",
        technologies: ["React", "Video Streaming", "LMS"],
        featured: false
    }
];

const PortfolioShowcase: React.FC = () => {
    return (
        <section className="py-20 px-4 bg-gradient-to-b from-slate-900 to-slate-950">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16 animate-fade-in">
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                        Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-violet-500">Portfolio</span>
                    </h2>
                    <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                        Delivering exceptional digital experiences for clients worldwide
                    </p>
                </div>

                {/* Portfolio Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {portfolioWebsites.map((project, index) => (
                        <div
                            key={project.id}
                            className="group relative bg-slate-800/50 backdrop-blur-sm rounded-2xl overflow-hidden border border-slate-700 hover:border-teal-500/50 transition-all duration-300 hover:transform hover:scale-105 animate-slide-up"
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            {/* Featured Badge */}
                            {project.featured && (
                                <div className="absolute top-4 right-4 z-10 bg-gradient-to-r from-teal-500 to-violet-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                                    Featured
                                </div>
                            )}

                            {/* Image */}
                            <div className="relative h-48 overflow-hidden bg-gradient-to-br from-teal-500/20 to-violet-500/20">
                                <a
                                    href={project.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-full h-full"
                                >
                                    <img
                                        src={project.image}
                                        alt={project.title}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-60"></div>
                                </a>
                            </div>

                            {/* Content */}
                            <div className="p-6">
                                {/* Category */}
                                <span className="inline-block px-3 py-1 bg-teal-500/10 text-teal-400 text-xs font-semibold rounded-full mb-3">
                                    {project.category}
                                </span>

                                {/* Title */}
                                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-teal-400 transition-colors">
                                    {project.title}
                                </h3>

                                {/* Description */}
                                <p className="text-slate-400 text-sm mb-4 line-clamp-3">
                                    {project.description}
                                </p>

                                {/* Technologies */}
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {project.technologies.map((tech, i) => (
                                        <span
                                            key={i}
                                            className="px-2 py-1 bg-slate-700/50 text-slate-300 text-xs rounded"
                                        >
                                            {tech}
                                        </span>
                                    ))}
                                </div>

                                {/* Visit Button */}
                                <a
                                    href={project.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-teal-400 hover:text-teal-300 font-semibold text-sm group-hover:gap-3 transition-all"
                                >
                                    Visit Website
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>

                            {/* Hover Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-teal-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <div className="text-center mt-16">
                    <a
                        href="#contact"
                        className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-teal-500 to-violet-500 text-white font-bold rounded-full hover:shadow-lg hover:shadow-teal-500/50 transition-all group"
                    >
                        Start Your Project
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </a>
                </div>
            </div>
        </section>
    );
};

export default PortfolioShowcase;
