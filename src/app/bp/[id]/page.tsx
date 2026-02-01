'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { projectService } from '@/services/projectService';
import { Project as BusinessProject } from '@/types';
import { Card } from '@/components/ui/UIComponents';
import { Calendar, Briefcase, CheckCircle2, Clock } from 'lucide-react';

export default function PublicBusinessProjectPage() {
    const params = useParams();
    const projectId = params?.id as string;
    const [project, setProject] = useState<BusinessProject | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (projectId) {
            loadProject();
        }
    }, [projectId]);

    const loadProject = async () => {
        try {
            const { project, error } = await projectService.getPublicProjectStatus(projectId);
            if (error) {
                setError(error);
            } else {
                setProject(project as BusinessProject);
            }
        } catch (err) {
            setError('Failed to load project details');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-teal-400">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="animate-pulse">Loading project status...</p>
                </div>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center text-red-400 p-6">
                <div className="text-center max-w-md">
                    <h1 className="text-3xl font-bold mb-4">Access Denied</h1>
                    <p className="text-slate-400 mb-8">This project information is not public or the link has expired. Please contact your project manager for access.</p>
                    <a href="/" className="px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white transition-all">Go to Homepage</a>
                </div>
            </div>
        );
    }

    const statusColors: any = {
        Active: 'text-teal-400 bg-teal-400/10 border-teal-500/20',
        Pending: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
        Completed: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
        Declined: 'text-red-400 bg-red-400/10 border-red-400/20'
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 md:p-12 selection:bg-teal-500/30">
            {/* Background Glow */}
            <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-screen pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-500/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full"></div>
            </div>

            <div className="max-w-4xl mx-auto relative z-10 space-y-12">
                {/* Header */}
                <div className="text-center space-y-6">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 text-teal-400 text-sm font-semibold border border-teal-500/20 tracking-wide uppercase">
                        <CheckCircle2 className="w-4 h-4" />
                        Live Implementation Tracking
                    </div>
                    <h1 className="text-5xl md:text-7xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-500">
                        {project.name}
                    </h1>
                    <div className="flex flex-wrap items-center justify-center gap-6 text-slate-400">
                        <div className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4" />
                            <span>Business Project</span>
                        </div>
                        {project.dueDate && (
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                <span>Target: {new Date(project.dueDate).toLocaleDateString()}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Progress Visualizer */}
                <Card className="p-8 md:p-12 border-slate-800 bg-slate-900/40 backdrop-blur-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Briefcase className="w-32 h-32" />
                    </div>

                    <div className="space-y-12">
                        {/* Big Percent */}
                        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                            <div className="text-center md:text-left">
                                <p className="text-slate-500 text-sm font-medium uppercase tracking-widest mb-2">Overall Completion</p>
                                <div className="text-8xl font-black text-white flex items-baseline">
                                    {project.progress}
                                    <span className="text-teal-500 text-4xl ml-2">%</span>
                                </div>
                            </div>

                            <div className="w-48 h-4( bg-slate-800/50 rounded-2xl p-6 border border-white/5 text-center">
                                <p className="text-slate-500 text-xs uppercase mb-2">Current Phase</p>
                                <p className={`text-lg font-bold capitalize ${statusColors[project.status].split(' ')[0]}`}>
                                    {project.status.replace('_', ' ')}
                                </p>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-4">
                            <div className="h-6 bg-slate-950/50 border border-white/5 rounded-full p-1 shadow-inner relative overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-teal-500 via-cyan-400 to-teal-400 transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(20,184,166,0.3)]"
                                    style={{ width: `${project.progress}%` }}
                                >
                                    <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[shimmer_2s_linear_infinite]"></div>
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        {project.description && (
                            <div className="pt-8 border-t border-white/5">
                                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-4">Project Brief</h3>
                                <p className="text-lg text-slate-300 leading-relaxed max-w-2xl">
                                    {project.description}
                                </p>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Footer Section */}
                <div className="text-center space-y-8 pt-12">
                    <div className="flex items-center justify-center gap-3">
                        <div className="h-px w-12 bg-slate-800"></div>
                        <p className="text-slate-600 font-mono text-sm">SECURE UPDATES POWERED BY ALPHACLONE</p>
                        <div className="h-px w-12 bg-slate-800"></div>
                    </div>

                    <button
                        onClick={() => window.location.href = '/'}
                        className="group relative px-8 py-4 bg-white text-black font-bold rounded-xl overflow-hidden hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.1)]"
                    >
                        <span className="relative z-10">Visit Official Platform</span>
                        <div className="absolute inset-x-0 bottom-0 h-0 group-hover:h-full bg-teal-500 transition-all duration-300"></div>
                    </button>

                    <p className="text-slate-500 text-xs">
                        &copy; {new Date().getFullYear()} AlphaClone Systems. All systems operational.
                    </p>
                </div>
            </div>

            <style jsx>{`
                @keyframes shimmer {
                    0% { background-position: 0 0; }
                    100% { background-position: 40px 0; }
                }
            `}</style>
        </div>
    );
}
