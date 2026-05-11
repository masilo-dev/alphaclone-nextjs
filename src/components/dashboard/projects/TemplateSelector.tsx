import React, { useState, useEffect } from 'react';
import { Layout, CheckCircle, Info, Loader2 } from 'lucide-react';
import { projectTemplateService, ProjectTemplate, TemplatePhase } from '../../../services/projectTemplateService';

interface TemplateSelectorProps {
    onSelect: (templateId: string | null) => void;
    selectedTemplateId: string | null;
}

export default function TemplateSelector({ onSelect, selectedTemplateId }: TemplateSelectorProps) {
    const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
    const [phases, setPhases] = useState<TemplatePhase[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingPhases, setIsLoadingPhases] = useState(false);

    useEffect(() => {
        const loadTemplates = async () => {
            setIsLoading(true);
            const { templates } = await projectTemplateService.getTemplates();
            setTemplates(templates);
            setIsLoading(false);
        };
        loadTemplates();
    }, []);

    useEffect(() => {
        const loadPhases = async () => {
            if (!selectedTemplateId) {
                setPhases([]);
                return;
            }
            setIsLoadingPhases(true);
            const { phases } = await projectTemplateService.getTemplatePhases(selectedTemplateId);
            setPhases(phases);
            setIsLoadingPhases(false);
        };
        loadPhases();
    }, [selectedTemplateId]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span>Loading templates...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <Layout className="w-4 h-4 text-teal-400" />
                <h4 className="text-sm font-semibold text-white">Project Lifecycle Template</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                    onClick={() => onSelect(null)}
                    className={`p-3 rounded-lg border text-left transition-all ${!selectedTemplateId
                            ? 'bg-teal-500/10 border-teal-500 text-white'
                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                        }`}
                >
                    <div className="font-medium text-sm">Blank Project</div>
                    <div className="text-xs opacity-60">Manual milestone management</div>
                </button>

                {templates.map(template => (
                    <button
                        key={template.id}
                        onClick={() => onSelect(template.id)}
                        className={`p-3 rounded-lg border text-left transition-all ${selectedTemplateId === template.id
                                ? 'bg-teal-500/10 border-teal-500 text-white'
                                : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                            }`}
                    >
                        <div className="font-medium text-sm">{template.name}</div>
                        <div className="text-xs opacity-60 truncate">{template.description || 'Standard lifecycle'}</div>
                    </button>
                ))}
            </div>

            {selectedTemplateId && (
                <div className="bg-slate-950/50 rounded-lg p-4 border border-slate-800 animate-fade-in">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-slate-500">Template Phases</span>
                        {isLoadingPhases && <Loader2 className="w-3 h-3 animate-spin" />}
                    </div>

                    {phases.length === 0 && !isLoadingPhases ? (
                        <div className="text-xs text-slate-600 italic">No phases defined for this template.</div>
                    ) : (
                        <div className="space-y-2">
                            {phases.map((phase, idx) => (
                                <div key={phase.id} className="flex items-start gap-2">
                                    <div className="mt-0.5">
                                        <CheckCircle className="w-3.5 h-3.5 text-teal-500" />
                                    </div>
                                    <div>
                                        <div className="text-xs text-white font-medium">{phase.name}</div>
                                        {phase.description && <div className="text-xs text-slate-500">{phase.description}</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mt-4 flex items-center gap-2 p-2 bg-blue-500/5 rounded border border-blue-500/20">
                        <Info className="w-3 h-3 text-blue-400" />
                        <p className="text-xs text-blue-300">Applying this template will automatically create all phases as project milestones.</p>
                    </div>
                </div>
            )}
        </div>
    );
}

