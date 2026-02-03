import React from 'react';
import { Card, Input, Button } from '../ui/UIComponents';

interface ProjectSubmitTabProps {
    newProject: {
        name: string;
        category: string;
        description: string;
        image: string;
    };
    setNewProject: React.Dispatch<React.SetStateAction<{
        name: string;
        category: string;
        description: string;
        image: string;
    }>>;
    handleAddProject: () => void;
}

const ProjectSubmitTab: React.FC<ProjectSubmitTabProps> = ({
    newProject,
    setNewProject,
    handleAddProject
}) => {
    return (
        <div className="max-w-2xl mx-auto animate-fade-in">
            <Card className="bg-slate-900 border-slate-800 shadow-2xl p-6">
                <h2 className="text-2xl font-bold text-white mb-2">Initialize New Project</h2>
                <p className="text-slate-400 mb-8">Submit a request for a new module, feature, or entire platform. Our team will review instantly.</p>
                <div className="space-y-6">
                    <Input
                        label="Project Name"
                        value={newProject.name}
                        onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                        placeholder="e.g., Q3 Marketing Campaign Landing Page"
                    />
                    <Input
                        label="Category / Type"
                        value={newProject.category}
                        onChange={e => setNewProject({ ...newProject, category: e.target.value })}
                        placeholder="Web, Mobile, AI, Consulting..."
                    />
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5">Description & Requirements</label>
                        <textarea
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 min-h-[120px]"
                            value={newProject.description}
                            onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                        />
                    </div>
                    <div className="pt-4 flex justify-end">
                        <Button onClick={handleAddProject} className="w-full md:w-auto px-8">Submit Request</Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default ProjectSubmitTab;
