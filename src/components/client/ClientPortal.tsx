import React, { useState, useEffect } from 'react';
import { Card, Button } from '../ui/UIComponents';
import { Calendar, Download, CheckCircle, Clock, FileText, Star } from 'lucide-react';
import { Project, User } from '../../types';
import { projectService } from '../../services/projectService';
import { format } from 'date-fns';

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
    const [feedback, setFeedback] = useState({ rating: 0, comment: '' });
    const [showSurvey, setShowSurvey] = useState(false);

    useEffect(() => {
        loadProjects();
    }, [user.id]);

    useEffect(() => {
        if (selectedProject) {
            loadProjectDetails();
        }
    }, [selectedProject]);

    const loadProjects = async () => {
        setLoading(true);
        const { projects: userProjects } = await projectService.getProjects(user.id, user.role);
        if (userProjects && userProjects.length > 0) {
            const firstProject = userProjects[0];
            if (firstProject) {
                setSelectedProject(firstProject);
            }
        }
        setLoading(false);
    };

    const loadProjectDetails = async () => {
        // Load milestones and deliverables for the project
        // This would come from a project details API
        setMilestones([
            {
                id: '1',
                name: 'Project Kickoff',
                description: 'Initial meeting and requirements gathering',
                dueDate: new Date().toISOString(),
                completed: true,
                completedAt: new Date().toISOString(),
            },
            {
                id: '2',
                name: 'Design Phase',
                description: 'UI/UX design completion',
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                completed: false,
            },
        ]);

        setDeliverables([
            {
                id: '1',
                name: 'Project Proposal.pdf',
                type: 'file',
                url: '#',
                uploadedAt: new Date().toISOString(),
                size: 1024000,
            },
        ]);
    };

    const handleDownload = (deliverable: Deliverable) => {
        // Trigger download
        window.open(deliverable.url, '_blank');
    };

    const handleFeedbackSubmit = async () => {
        // Submit feedback
        setShowSurvey(false);
        setFeedback({ rating: 0, comment: '' });
    };

    if (loading) {
        return (
            <div className="p-10 text-center text-slate-500">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-400 mb-4"></div>
                <p>Loading your portal...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
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
                                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                            milestone.completed
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
                                            className={`w-10 h-10 rounded-lg transition-colors ${
                                                feedback.rating >= rating
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
                                <Button onClick={handleFeedbackSubmit} className="flex-1 bg-teal-600 hover:bg-teal-500">
                                    Submit
                                </Button>
                                <Button onClick={() => setShowSurvey(false)} variant="outline" className="flex-1">
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

