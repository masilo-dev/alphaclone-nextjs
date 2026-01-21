'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { projectService } from '@/services/projectService';
import { Project } from '@/types';
import { Card } from '@/components/ui/Card';

export default function PublicProjectPage() {
    const params = useParams();
    const projectId = params?.id as string;
    const [project, setProject] = useState<Partial<Project> | null>(null);
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
                setProject(project);
            }
        } catch (err) {
            setError('Failed to load project');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center text-teal-400">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                    <p>Loading project status...</p>
                </div>
            </div>
        );
    }

    if (error || !project) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center text-red-400">
                <div className="text-center">
                    <h1 className="text-2xl font-bold mb-2">Project Not Found</h1>
                    <p className="text-slate-400">This project may not be public or the link is invalid.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6 md:p-12">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center space-y-4">
                    <div className="inline-block px-4 py-1.5 rounded-full bg-teal-500/10 text-teal-400 text-sm font-medium border border-teal-500/20">
                        Project Status Update
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                        {project.name}
                    </h1>
                    {project.ownerName && (
                        <p className="text-slate-400">Client: {project.ownerName}</p>
                    )}
                </div>

                {/* Progress Card */}
                <Card className="p-8 border-slate-800 bg-slate-900/50 backdrop-blur-xl">
                    <div className="flex flex-col gap-8">
                        {/* Status Bar */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm text-slate-400">
                                <span>Overall Progress</span>
                                <span className="text-teal-400 font-bold">{project.progress}%</span>
                            </div>
                            <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-1000 ease-out"
                                    style={{ width: `${project.progress}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Current Stage */}
                        <div className="grid md:grid-cols-2 gap-8 items-center">
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-slate-300">Phase</h3>
                                <div className="text-3xl font-bold text-teal-400">
                                    {project.currentStage}
                                </div>
                                <div className="inline-flex items-center px-3 py-1 rounded bg-slate-800 text-slate-300 text-sm">
                                    Status: <span className="ml-2 text-white capitalize">{project.status}</span>
                                </div>
                            </div>

                            {project.dueDate && (
                                <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                                    <p className="text-slate-400 text-sm mb-1">Target Completion</p>
                                    <p className="text-xl font-mono text-white">
                                        {new Date(project.dueDate).toLocaleDateString(undefined, {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>

                {/* Footer */}
                <div className="text-center pt-8 border-t border-slate-800/50">
                    <p className="text-slate-500 text-sm">
                        Powered by <span className="text-teal-500 font-semibold">AlphaClone Systems</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
