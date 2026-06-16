'use client';

import { useState } from 'react';
import { CheckCircle, Clock, Play, AlertCircle, Calendar, Users, Target } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  current_stage: string;
  progress: number;
  stages: ProjectStage[];
  next_steps: NextStep[];
}

interface ProjectStage {
  id: string;
  name: string;
  status: 'completed' | 'active' | 'pending';
  date?: string;
  description?: string;
}

interface NextStep {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  assignee?: string;
  due_date?: string;
}

interface ProjectTimelineProps {
  project: Project;
  onStageUpdate?: (stageId: string, status: string) => void;
  onNextStepAction?: (stepId: string, action: string) => void;
}

const ProjectTimeline: React.FC<ProjectTimelineProps> = ({ 
  project, 
  onStageUpdate, 
  onNextStepAction 
}) => {
  const [activeStage, setActiveStage] = useState(project?.current_stage || '');
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  // Handle empty project
  if (!project || !project.id) {
    return (
      <div className="project-timeline bg-slate-800 rounded-xl p-6 border border-slate-700">
        <div className="text-center py-12">
          <Target className="w-16 h-16 text-slate-500 mx-auto mb-4" />
          <h4 className="text-lg font-semibold text-white mb-2">No Project Selected</h4>
          <p className="text-slate-400">Select a project to view its timeline and progress.</p>
        </div>
      </div>
    );
  }

  const getStageIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'active':
        return <Play className="w-4 h-4 text-teal-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-slate-500" />;
      default:
        return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'low':
        return 'bg-slate-600/20 text-slate-400 border-slate-500/30';
      default:
        return 'bg-slate-600/20 text-slate-400 border-slate-500/30';
    }
  };

  const handleStageClick = (stage: ProjectStage) => {
    if (stage.status === 'pending' && onStageUpdate) {
      onStageUpdate(stage.id, 'active');
      setActiveStage(stage.id);
    }
  };

  const handleStepAction = (stepId: string, action: string) => {
    if (onNextStepAction) {
      onNextStepAction(stepId, action);
    }
  };

  return (
    <div className="project-timeline bg-slate-800 rounded-xl p-6 border border-slate-700">
      {/* Progress Overview */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-teal-500" />
            <h4 className="text-lg font-semibold text-white">Project Progress</h4>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">Completion</span>
            <span className="text-sm font-medium text-teal-400">{project.progress}%</span>
          </div>
        </div>
        
        <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-teal-500 to-blue-500 h-3 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${project.progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-slate-500">Started</span>
          <span className="text-xs text-slate-500">In Progress</span>
          <span className="text-xs text-slate-500">Complete</span>
        </div>
      </div>

      {/* Timeline Stages */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="w-5 h-5 text-teal-500" />
          <h4 className="text-lg font-semibold text-white">Project Stages</h4>
        </div>
        
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-slate-600" />
          
          {project.stages && project.stages.length > 0 ? (
            project.stages.map((stage, index) => (
              <div 
                key={stage.id} 
                className="relative flex items-center mb-8 cursor-pointer group"
                onClick={() => handleStageClick(stage)}
              >
                {/* Stage Indicator */}
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center z-10 transition-all duration-200
                  ${stage.status === 'completed' ? 'bg-green-500 ring-2 ring-green-500/20' : 
                    stage.status === 'active' ? 'bg-teal-500 ring-2 ring-teal-500/20 animate-pulse' : 
                    'bg-slate-600 ring-2 ring-slate-600/20 group-hover:bg-slate-500'}
                `}>
                  {getStageIcon(stage.status)}
                </div>

                {/* Stage Content */}
                <div className="ml-6 flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-white group-hover:text-teal-400 transition-colors">
                      {stage.name}
                    </h5>
                    {stage.date && (
                      <span className="text-xs text-slate-400">
                        {new Date(stage.date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  
                  {stage.description && (
                    <p className="text-sm text-slate-400 mb-2">{stage.description}</p>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <span className={`
                      text-xs px-2 py-1 rounded-full
                      ${stage.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        stage.status === 'active' ? 'bg-teal-500/20 text-teal-400' :
                        'bg-slate-600/20 text-slate-400'}
                    `}>
                      {stage.status.charAt(0).toUpperCase() + stage.status.slice(1)}
                    </span>
                    
                    {stage.status === 'active' && (
                      <span className="text-xs text-teal-400 animate-pulse">
                        Currently in progress
                      </span>
                    )}
                    
                    {stage.status === 'pending' && (
                      <span className="text-xs text-slate-500 group-hover:text-teal-400 transition-colors">
                        Click to start
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 bg-slate-700/30 rounded-xl border border-dashed border-slate-600 ml-6">
              <Calendar className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <h5 className="text-lg font-medium text-white mb-2">No Stages Defined</h5>
              <p className="text-slate-400 text-sm">This project doesn't have any stages yet.</p>
              <button
                onClick={() => onStageUpdate?.('new', 'create')}
                className="mt-4 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-black text-sm font-medium rounded-lg transition-colors"
              >
                + Add First Stage
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Next Steps */}
      <div className="border-t border-slate-700 pt-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Play className="w-5 h-5 text-teal-500" />
            <h4 className="text-lg font-semibold text-white">Next Steps</h4>
          </div>
          <span className="text-sm text-slate-400">
            {project.next_steps.length} actions pending
          </span>
        </div>
        
        {project.next_steps.length === 0 ? (
          <div className="text-center py-8 bg-slate-700/30 rounded-xl border border-dashed border-slate-600">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h5 className="text-lg font-medium text-white mb-2">All Caught Up!</h5>
            <p className="text-slate-400">No immediate next steps. Great progress!</p>
            <button
              onClick={() => handleStepAction('new', 'create')}
              className="mt-4 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-black text-sm font-medium rounded-lg transition-colors"
            >
              + Add Next Step
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {project.next_steps.map((step) => (
              <div 
                key={step.id} 
                className="bg-slate-700/50 rounded-lg p-4 border border-slate-600 hover:border-teal-500/50 transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h5 className="font-medium text-white">{step.title}</h5>
                      <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(step.priority)}`}>
                        {step.priority}
                      </span>
                    </div>
                    
                    <p className="text-sm text-slate-400 mb-3">{step.description}</p>
                    
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      {step.assignee && (
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>{step.assignee}</span>
                        </div>
                      )}
                      {step.due_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(step.due_date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                      className="p-1 text-slate-400 hover:text-white transition-colors"
                    >
                      <AlertCircle className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => handleStepAction(step.id, 'start')}
                      className="px-3 py-1 bg-teal-500 hover:bg-teal-400 text-black text-sm font-medium rounded transition-colors"
                    >
                      Start
                    </button>
                  </div>
                </div>
                
                {/* Expanded Details */}
                {expandedStep === step.id && (
                  <div className="mt-4 pt-4 border-t border-slate-600">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500">Estimated Time:</span>
                        <span className="ml-2 text-slate-300">2-3 hours</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Dependencies:</span>
                        <span className="ml-2 text-slate-300">Previous stage completion</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Resources:</span>
                        <span className="ml-2 text-slate-300">Design team, API access</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Risk Level:</span>
                        <span className="ml-2 text-amber-400">Medium</span>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => handleStepAction(step.id, 'complete')}
                        className="px-3 py-1 bg-green-500 hover:bg-green-400 text-white text-sm font-medium rounded transition-colors"
                      >
                        Mark Complete
                      </button>
                      <button
                        onClick={() => handleStepAction(step.id, 'defer')}
                        className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium rounded transition-colors"
                      >
                        Defer
                      </button>
                      <button
                        onClick={() => handleStepAction(step.id, 'assign')}
                        className="px-3 py-1 bg-blue-500 hover:bg-blue-400 text-white text-sm font-medium rounded transition-colors"
                      >
                        Assign
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="border-t border-slate-700 pt-6 mt-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-400">
            Last updated: {new Date().toLocaleDateString()}
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-slate-600 hover:bg-slate-500 text-white text-sm font-medium rounded transition-colors">
              Export Timeline
            </button>
            <button className="px-3 py-1 bg-teal-500 hover:bg-teal-400 text-black text-sm font-medium rounded transition-colors">
              Schedule Review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectTimeline;
