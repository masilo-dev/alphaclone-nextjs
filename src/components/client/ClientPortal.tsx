import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button } from '../ui/UIComponents';
import { Calendar, Download, CheckCircle, Clock, FileText, Star, AlertCircle } from 'lucide-react';
import { Project, User } from '../../types';
import { projectService } from '../../services/projectService';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { tenantService } from '../../services/tenancy/TenantService';
import toast from 'react-hot-toast';

interface ClientPortalProps {
    user: User;
}

interface Milestone {
    id: string;
    name: string;
    description?: string;
    dueDate: string;
    completed: boolean;
    completedAt?: string;
}

interface Deliverable {
    id: string;
    name: string;
    type: 'file' | 'link' | 'document';
    url: string;
    uploadedAt: string;
    size?: number;
}

const ClientPortal: React.FC<ClientPortalProps> = ({ user }) => {
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [feedback, setFeedback] = useState({ rating: 0, comment: '' });
    const [showSurvey, setShowSurvey] = useState(false);
    const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

    const loadProjectDetails = useCallback(async () => {
        if (!selectedProject?.id) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const tenantId = tenantService.getCurrentTenantId();
            
            // Fetch real milestones from database
            const { data: milestonesData, error: milestonesError } = await supabase
                .from('project_milestones')
                .select('*')
                .eq('project_id', selectedProject.id)
                .eq('tenant_id', tenantId)
                .order('order_index', { ascending: true });

            if (milestonesError) throw milestonesError;

            const mappedMilestones: Milestone[] = (milestonesData || []).map((m: any) => ({
                id: m.id,
                name: m.name,
                description: m.description,
                dueDate: m.due_date,
                completed: m.status === 'completed',
                completedAt: m.completed_at,
            }));

            setMilestones(mappedMilestones);

            // Fetch deliverables from project_files if available
            const { data: filesData } = await supabase
                .from('project_files')
                .select('*')
                .eq('project_id', selectedProject.id)
                .eq('tenant_id', tenantId)
                .eq('is_deliverable', true)
                .order('created_at', { ascending: false });

            const mappedDeliverables: Deliverable[] = (filesData || []).map((f: any) => ({
                id: f.id,
                name: f.file_name,
                type: f.file_type || 'file',
                url: f.file_url || f.storage_path || '#',
                uploadedAt: f.created_at,
                size: f.file_size,
            }));

            setDeliverables(mappedDeliverables);
        } catch (err) {
            console.error('Failed to load project details:', err);
            setError('Failed to load project details. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [selectedProject?.id]);

    const loadProjects = useCallback(async () => {
        setLoading(true);
        const { projects: userProjects } = await projectService.getProjects(user.id, user.role);
        if (userProjects && userProjects.length > 0) {
            const firstProject = userProjects[0];
            if (firstProject) {
                setSelectedProject(firstProject);
            }
        }
        setLoading(false);
    }, [user.id, user.role]);

    const handleDownload = (deliverable: Deliverable) => {
        // Trigger download
        window.open(deliverable.url, '_blank');
    };

    const handleFeedbackSubmit = async () => {
        if (!selectedProject || !user.id || feedback.rating === 0) return;
        
        setFeedbackSubmitting(true);
        
        try {
            const tenantId = tenantService.getCurrentTenantId();
            
            if (!tenantId) throw new Error('No active workspace');
            const response = await fetch('/api/client/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId,
                    projectId: selectedProject.id,
                    rating: feedback.rating,
                    comment: feedback.comment,
                }),
            });
            if (!response.ok) throw new Error('Feedback could not be submitted');
            
            setShowSurvey(false);
            setFeedback({ rating: 0, comment: '' });
            toast.success('Thank you for your feedback!');
        } catch (err) {
            console.error('Failed to submit feedback:', err);
            toast.error('Failed to submit feedback. Please try again.');
        } finally {
            setFeedbackSubmitting(false);
        }
    };

    useEffect(() => {
        loadProjects();
    }, [loadProjects]);

    useEffect(() => {
        if (selectedProject) {
            loadProjectDetails();
        }
    }, [selectedProject, loadProjectDetails]);

    if (loading && !selectedProject) {
        return (
            <div className="p-10 text-center text-slate-500">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400 mb-4"></div>
                <p>Loading your portal...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                    <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">
                        Dismiss
                    </button>
                </div>
            )}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white">Client Portal</h2>
                    <p className="text-slate-400 mt-1">Manage your projects and track progress</p>
                </div>
                <Button onClick={() => setShowSurvey(true)} variant="outline">
                    <Star className="w-4 h-4 mr-2" />
                    Provide Feedback
                </Button>
            </div>

            {/* Project Timeline */}
            {selectedProject && (
                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-teal-400" />
                        Project Timeline: {selectedProject.name}
                    </h3>
                    <div className="space-y-4">
                        {milestones.map((milestone, index) => (
                            <div key={milestone.id} className="flex items-start gap-4">
                                <div className="flex flex-col items-center">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center ${milestone.completed
                                            ? 'bg-teal-500 text-white'
                                            : 'bg-slate-800 border-2 border-slate-700'
                                            }`}
                                    >
                                        {milestone.completed ? (
                                            <CheckCircle className="w-6 h-6" />
                                        ) : (
                                            <Clock className="w-6 h-6 text-slate-400" />
                                        )}
                                    </div>
                                    {index < milestones.length - 1 && (
                                        <div className="w-0.5 h-12 bg-slate-800 mt-2" />
                                    )}
                                </div>
                                <div className="flex-1 pb-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-white font-medium">{milestone.name}</h4>
                                        <span className="text-sm text-slate-400">
                                            {format(new Date(milestone.dueDate), 'MMM dd, yyyy')}
                                        </span>
                                    </div>
                                    {milestone.description && (
                                        <p className="text-slate-400 text-sm mt-1">{milestone.description}</p>
                                    )}
                                    {milestone.completed && milestone.completedAt && (
                                        <p className="text-xs text-teal-400 mt-1">
                                            Completed on {format(new Date(milestone.completedAt), 'MMM dd, yyyy')}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Deliverables */}
            <Card className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Download className="w-5 h-5 text-blue-400" />
                    Deliverables
                </h3>
                {deliverables.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">No deliverables available yet</p>
                ) : (
                    <div className="space-y-3">
                        {deliverables.map((deliverable) => (
                            <div
                                key={deliverable.id}
                                className="flex items-center justify-between p-4 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <FileText className="w-5 h-5 text-slate-400" />
                                    <div>
                                        <p className="text-white font-medium">{deliverable.name}</p>
                                        <p className="text-xs text-slate-400">
                                            {format(new Date(deliverable.uploadedAt), 'MMM dd, yyyy')}
                                            {deliverable.size && ` • ${(deliverable.size / 1024).toFixed(1)} KB`}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => handleDownload(deliverable)}
                                    variant="outline"
                                    size="sm"
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Download
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Feedback Survey Modal */}
            {showSurvey && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md">
                        <h3 className="text-xl font-bold text-white mb-4">Project Feedback</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Rating</label>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map((rating) => (
                                        <button
                                            key={rating}
                                            onClick={() => setFeedback({ ...feedback, rating })}
                                            className={`w-10 h-10 rounded-lg transition-colors ${feedback.rating >= rating
                                                ? 'bg-yellow-500 text-white'
                                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                                }`}
                                        >
                                            <Star className="w-5 h-5 mx-auto" fill={feedback.rating >= rating ? 'currentColor' : 'none'} />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-slate-400 mb-2">Comments</label>
                                <textarea
                                    value={feedback.comment}
                                    onChange={(e) => setFeedback({ ...feedback, comment: e.target.value })}
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
                                    rows={4}
                                    placeholder="Share your thoughts..."
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    onClick={handleFeedbackSubmit} 
                                    disabled={feedbackSubmitting || feedback.rating === 0}
                                    className="flex-1 bg-teal-600 hover:bg-teal-500 disabled:opacity-50"
                                >
                                    {feedbackSubmitting ? 'Submitting...' : 'Submit'}
                                </Button>
                                <Button 
                                    onClick={() => setShowSurvey(false)} 
                                    variant="outline" 
                                    className="flex-1"
                                    disabled={feedbackSubmitting}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default ClientPortal;
