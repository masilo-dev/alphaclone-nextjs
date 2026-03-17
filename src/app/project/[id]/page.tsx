'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CheckCircle2, Clock, Package, Loader2 } from 'lucide-react';

interface Milestone {
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed';
    dueDate?: string;
    completedAt?: string;
    order: number;
}

interface Project {
    id: string;
    name: string;
    description?: string;
    category?: string;
    currentStage?: string;
    progress?: number;
    image?: string;
    status?: string;
}

export default function PublicProjectPage() {
    const params = useParams();
    const projectId = params?.id as string;

    const [project, setProject] = useState<Project | null>(null);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (projectId) {
            loadProjectData();
        }
    }, [projectId]);

    const loadProjectData = async () => {
        try {
            setLoading(true);

            // Fetch project details
            const { data: projectData, error: projectError } = await supabase
                .from('projects')
                .select('id, name, description, category, current_stage, progress, image, status')
                .eq('id', projectId)
                .single();

            if (projectError) throw projectError;

            setProject({
                id: projectData.id,
                name: projectData.name,
                description: projectData.description,
                category: projectData.category,
                currentStage: projectData.current_stage,
                progress: projectData.progress,
                image: projectData.image,
                status: projectData.status,
            });

            // Fetch milestones
            const { data: milestonesData, error: milestonesError } = await supabase
                .from('milestones')
                .select('*')
                .eq('project_id', projectId)
                .order('order', { ascending: true });

            if (milestonesError) throw milestonesError;

            setMilestones(milestonesData.map((m: any) => ({
                id: m.id,
                title: m.title,
                description: m.description,
                status: m.status,
                dueDate: m.due_date,
                completedAt: m.completed_at,
                order: m.order,
            })));

        } catch (err) {
            console.error('Error loading project:', err);
            setError('Failed to load project information');
        } finally {
            setLoading(false);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle2 className="w-6 h-6 text-green-500" />;
            case 'in_progress':
                return <Clock className="w-6 h-6 text-blue-500" />;
            default:
                return <Package className="w-6 h-6 text-slate-500" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed':
                return 'border-green-500 bg-green-500/10';
            case 'in_progress':
                return 'border-blue-500 bg-blue-500/10';
            default:
                return 'border-slate-700 bg-slate-900/50';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-teal-400 animate-spin mx-auto mb-4" />
                    <p className="text-slate-400">Loading project details...</p>
                </div>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
                <div className="text-center max-w-md">
                    <Package className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-white mb-2">Project Not Found</h1>
                    <p className="text-slate-400">{error || 'The project you are looking for does not exist or is not publicly accessible.'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            {/* Header */}
            <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-xl">
                <div className="max-w-5xl mx-auto px-6 py-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Package className="w-8 h-8 text-teal-400" />
                        <span className="text-sm text-slate-500 uppercase tracking-wider">Project Tracking</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">{project.name}</h1>
                    {project.description && (
                        <p className="text-slate-400 text-lg">{project.description}</p>
                    )}
                    {project.category && (
                        <div className="mt-4">
                            <span className="px-3 py-1 bg-teal-500/10 text-teal-400 rounded-full text-sm font-medium border border-teal-500/20">
                                {project.category}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Progress Bar */}
            {project.progress !== undefined && (
                <div className="max-w-5xl mx-auto px-6 py-6">
                    <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-800">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-slate-400 text-sm font-medium">Overall Progress</span>
                            <span className="text-2xl font-bold text-teal-400">{project.progress}%</span>
                        </div>
                        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-teal-500 to-blue-500 transition-all duration-500"
                                style={{ width: `${project.progress}%` }}
                            />
                        </div>
                        {project.currentStage && (
                            <p className="mt-3 text-slate-500 text-sm">
                                Current Stage: <span className="text-white font-medium">{project.currentStage}</span>
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Milestones Timeline */}
            <div className="max-w-5xl mx-auto px-6 py-8">
                <h2 className="text-2xl font-bold text-white mb-6">Project Milestones</h2>

                {milestones.length === 0 ? (
                    <div className="text-center py-12 bg-slate-900/30 rounded-xl border border-slate-800">
                        <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-500">No milestones have been set for this project yet.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {milestones.map((milestone, index) => (
                            <div
                                key={milestone.id}
                                className={`relative border-2 rounded-xl p-6 transition-all ${getStatusColor(milestone.status)}`}
                            >
                                {/* Connector Line */}
                                {index < milestones.length - 1 && (
                                    <div className="absolute left-9 top-full h-4 w-0.5 bg-slate-700" />
                                )}

                                <div className="flex gap-4">
                                    <div className="flex-shrink-0">
                                        {getStatusIcon(milestone.status)}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-xl font-bold text-white mb-2">{milestone.title}</h3>
                                        {milestone.description && (
                                            <p className="text-slate-400 mb-3">{milestone.description}</p>
                                        )}
                                        <div className="flex flex-wrap gap-4 text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="text-slate-500">Status:</span>
                                                <span className={`font-medium capitalize ${milestone.status === 'completed' ? 'text-green-400' :
                                                        milestone.status === 'in_progress' ? 'text-blue-400' :
                                                            'text-slate-400'
                                                    }`}>
                                                    {milestone.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                            {milestone.dueDate && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-500">Due:</span>
                                                    <span className="text-white">{new Date(milestone.dueDate).toLocaleDateString()}</span>
                                                </div>
                                            )}
                                            {milestone.completedAt && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-500">Completed:</span>
                                                    <span className="text-green-400">{new Date(milestone.completedAt).toLocaleDateString()}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="max-w-5xl mx-auto px-6 py-8 text-center">
                <p className="text-slate-500 text-sm">
                    Powered by <span className="text-teal-400 font-semibold">AlphaClone Systems</span>
                </p>
            </div>
        </div>
    );
}
