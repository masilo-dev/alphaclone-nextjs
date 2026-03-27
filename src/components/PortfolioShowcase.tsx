import React from 'react';
import Image from 'next/image';
import { ExternalLink, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

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
        image: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&q=80&w=800",
        category: "E-Commerce",
        technologies: ["React", "Node.js", "Stripe", "Tailwind CSS"],
        featured: true
    },
    {
        id: 2,
        title: "Movana",
        description: "Modern business solutions and digital transformation platform with advanced analytics and workflow automation.",
        url: "https://movana.com/",
        image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800",
        category: "Business Platform",
        technologies: ["React", "TypeScript", "Supabase"],
        featured: true
    },
    {
        id: 3,
        title: "Cozy Haven",
        description: "Premium hospitality and accommodation booking system with real-time availability and instant confirmations.",
        url: "https://cozyhaven.co.uk/",
        image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=800",
        category: "Hospitality",
        technologies: ["React", "Next.js", "Booking API"],
        featured: false
    },
    {
        id: 4,
        title: "Luna Antiques",
        description: "Elegant online marketplace for rare and vintage antiques with detailed cataloging and authentication.",
        url: "https://lunarantiques.co.uk/",
        image: "https://images.unsplash.com/photo-1531058240690-006c446962d8?auto=format&fit=crop&q=80&w=800",
        category: "E-Commerce",
        technologies: ["React", "Shopify", "Custom CMS"],
        featured: false
    },
    {
        id: 5,
        title: "Szymon Masaz",
        description: "Professional massage therapy and wellness booking platform with appointment scheduling and payment processing.",
        url: "https://szymon-masaz.pl/",
        image: "https://images.unsplash.com/photo-1544161515-4af6b1d462c2?auto=format&fit=crop&q=80&w=800",
        category: "Healthcare",
        technologies: ["React", "Booking System", "Payment Integration"],
        featured: false
    },
    {
        id: 6,
        title: "Empowerement",
        description: "Personal development and coaching platform with video courses, live sessions, and progress tracking.",
        url: "https://empowerement.co.uk/",
        image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800",
        category: "Education",
        technologies: ["React", "Video Streaming", "LMS"],
        featured: false
    }
];

const PortfolioShowcase: React.FC<{ projects?: any[] }> = ({ projects }) => {
    const displayProjects = projects && projects.length > 0 ? projects : portfolioWebsites;

    return (
        <section className="py-20 px-4 bg-transparent">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 uppercase tracking-tighter font-marketing-heading">
                        Our <span className="bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">Portfolio</span>
                    </h2>
                    <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                        Delivering exceptional digital experiences for clients worldwide
                    </p>
                </div>

                {/* Portfolio Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {displayProjects.map((project, index) => (
                        <motion.div
                            key={project.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1 }}
                            className="group relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-teal-500/50 transition-all duration-300"
                        >
                            {/* Featured Badge */}
                            {project.featured && (
                                <div className="absolute top-4 right-4 z-10 bg-teal-500 text-slate-950 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                                    Featured
                                </div>
                            )}

                            {/* Image Container */}
                            <div className="relative h-56 overflow-hidden">
                                <a
                                    href={project.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block w-full h-full relative"
                                >
                                    <Image
                                        src={project.image}
                                        alt={project.title}
                                        fill
                                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-transparent transition-colors duration-300" />
                                </a>
                            </div>

                            {/* Content */}
                            <div className="p-8">
                                <span className="inline-block px-3 py-1 bg-teal-500/10 text-teal-400 text-[10px] font-bold rounded-full mb-4 uppercase tracking-widest">
                                    {project.category}
                                </span>

                                <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-teal-400 transition-colors">
                                    {project.title}
                                </h3>

                                <p className="text-slate-400 text-sm mb-6 line-clamp-2 leading-relaxed">
                                    {project.description}
                                </p>

                                <div className="flex flex-wrap gap-2 mb-8">
                                    {project.technologies.slice(0, 3).map((tech: string, i: number) => (
                                        <span
                                            key={i}
                                            className="px-2 py-1 bg-slate-800/50 text-slate-400 text-[10px] font-bold rounded border border-slate-700"
                                        >
                                            {tech}
                                        </span>
                                    ))}
                                </div>

                                <a
                                    href={project.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-white font-bold text-sm group-hover:text-teal-400 transition-all uppercase tracking-widest"
                                >
                                    Visit Project
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* CTA */}
                <div className="text-center mt-20">
                    <button
                        onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
                        className="inline-flex items-center gap-3 px-10 py-5 bg-teal-500 text-slate-950 font-black rounded-xl hover:bg-teal-400 transition-all group scale-100 hover:scale-105 active:scale-95 shadow-2xl shadow-teal-500/20 uppercase tracking-tighter"
                    >
                        Start Your Project
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </section>
    );
};

export default PortfolioShowcase;
