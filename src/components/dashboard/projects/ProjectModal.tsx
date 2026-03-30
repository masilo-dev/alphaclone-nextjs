import React, { useState } from 'react';
import { Modal, Input, Button } from '../../ui/UIComponents';
import TemplateSelector from './TemplateSelector';
import { projectService } from '../../../services/projectService';
import { Project } from '../../../types';
import toast from 'react-hot-toast';

interface ProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    clientId: string | null;
    ownerId: string;
    ownerName: string;
    onSuccess: (project: Project) => void;
}

export default function ProjectModal({ isOpen, onClose, clientId, ownerId, ownerName, onSuccess }: ProjectModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        category: 'Consulting',
        description: '',
        budget: 0,
        dueDate: ''
    });

    const handleSubmit = async () => {
        if (!formData.name) {
            toast.error('Project name is required');
            return;
        }

        setIsSubmitting(true);
        try {
            const projectData: Omit<Project, 'id'> = {
                name: formData.name,
                category: formData.category,
                description: formData.description,
                budget: Number(formData.budget),
                dueDate: formData.dueDate,
                ownerId,
                ownerName,
                clientId: clientId || undefined,
                status: 'Active',
                currentStage: 'Initiation',
                progress: 0,
                team: [ownerId],
                resources: [],
                createdAt: new Date().toISOString()
            };

            const { project, error } = await projectService.createProject(projectData, selectedTemplateId || undefined);

            if (error) throw new Error(error);

            if (project) {
                toast.success(selectedTemplateId ? 'Project created with template!' : 'Project created!');
                onSuccess(project);
                onClose();
                // Reset form
                setFormData({
                    name: '',
                    category: 'Consulting',
                    description: '',
                    budget: 0,
                    dueDate: ''
                });
                setSelectedTemplateId(null);
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to create project');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Launch New Project"
            maxWidth="max-w-2xl"
        >
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label="Project Name"
                        value={formData.name}
                        onChange={(e: any) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Website Redesign"
                        required
                    />
                    <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1">Category</label>
                        <select
                            value={formData.category}
                            onChange={(e: any) => setFormData({ ...formData, category: e.target.value })}
                            className="w-full px-4 py-2 bg-slate-900 border border-white/10 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-teal-500"
                        >
                            <option value="Consulting">Consulting</option>
                            <option value="Development">Development</option>
                            <option value="Design">Design</option>
                            <option value="Marketing">Marketing</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label="Budget ($)"
                        type="number"
                        value={formData.budget}
                        onChange={(e: any) => setFormData({ ...formData, budget: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                    />
                    <Input
                        label="Due Date"
                        type="date"
                        value={formData.dueDate}
                        onChange={(e: any) => setFormData({ ...formData, dueDate: e.target.value })}
                    />
                </div>

                <Input
                    label="Description"
                    value={formData.description}
                    onChange={(e: any) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Short overview of the project objectives..."
                    textarea
                />

                <div className="pt-4 border-t border-slate-800">
                    <TemplateSelector
                        selectedTemplateId={selectedTemplateId}
                        onSelect={setSelectedTemplateId}
                    />
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-slate-800">
                    <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="bg-teal-600 hover:bg-teal-500"
                    >
                        {isSubmitting ? 'Launching...' : 'Initialize Project'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
