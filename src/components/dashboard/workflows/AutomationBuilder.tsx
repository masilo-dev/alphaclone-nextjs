import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  Handle,
  Position,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Zap, Mail, Plus, Play, Save, Settings, Loader2, RefreshCw, History, LayoutTemplate, Maximize, CheckCircle2, XCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { workflowService, Workflow, WorkflowExecution } from '../../../services/workflowService';
import { useTenant } from '../../../contexts/TenantContext';
import { supabase } from '../../../lib/supabase';

// Define custom node types for a premium feel
const TriggerNode = ({ data }: { data: { label: string; description: string } }) => (
  <div className="px-4 py-3 shadow-xl rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white min-w-[min(100vw-2rem,200px)] max-w-[min(100vw-2rem,280px)] border border-indigo-400">
    <div className="flex items-center gap-2 font-bold mb-1">
      <Zap className="w-4 h-4 text-indigo-100" />
      {data.label}
    </div>
    <div className="text-xs text-indigo-100 opacity-80">{data.description}</div>
    <Handle type="source" position={Position.Bottom} className="w-4 h-4 -bottom-2 bg-indigo-400 border-2 border-white shadow-md cursor-crosshair" />
  </div>
);

const NODE_STYLES: Record<string, { border: string; icon?: string }> = {
  zoho: { border: 'border-blue-500' },
  zoho_mail: { border: 'border-sky-500' },
  ai: { border: 'border-purple-500' },
  document: { border: 'border-amber-500' },
  campaign: { border: 'border-indigo-500' },
  task: { border: 'border-green-500' },
  finance: { border: 'border-emerald-500' },
  notify: { border: 'border-orange-500' },
  meeting: { border: 'border-cyan-500' },
  project: { border: 'border-indigo-400' },
  email: { border: 'border-teal-500' },
  ops: { border: 'border-slate-400' },
};

function typeAbbrev(type: string) {
  const t = (type || 'op').replace(/_/g, ' ');
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0] || 'OP').slice(0, 2).toUpperCase();
}

const ActionNode = ({ data }: { data: { label: string; description: string; type: string } }) => {
  const style = NODE_STYLES[data.type] || { border: 'border-slate-200 dark:border-slate-700' };
  const abbr = typeAbbrev(data.type);

  return (
    <div className={`px-4 py-3 shadow-xl rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white min-w-[min(100vw-2rem,200px)] max-w-[min(100vw-2rem,280px)] border-2 ${style.border}`}>
      <Handle type="target" position={Position.Top} className="w-4 h-4 -top-2 bg-slate-400 border-2 border-white dark:border-slate-800 shadow-md cursor-crosshair" />
      <div className="flex items-center gap-2 font-bold text-sm mb-1 min-w-0">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-slate-100 text-xs font-black text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300" title={data.type}>
          {abbr}
        </span>
        <span className="truncate">{data.label}</span>
      </div>
      <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">{data.description}</div>
      <Handle type="source" position={Position.Bottom} className="w-4 h-4 -bottom-2 bg-slate-400 border-2 border-white dark:border-slate-800 shadow-md cursor-crosshair" />
    </div>
  );
};

const nodeTypes = {
  triggerNode: TriggerNode,
  actionNode: ActionNode,
};

// Default initial workflow
const initialNodes: Node[] = [
  { 
    id: 'trigger-1', 
    type: 'triggerNode', 
    position: { x: 250, y: 50 }, 
    data: { label: 'On New Lead Captured', description: 'Triggers when OmniCrawler finds a lead.' } 
  },
  { 
    id: 'action-1', 
    type: 'actionNode', 
    position: { x: 250, y: 200 }, 
    data: { label: 'Assess with AI', description: 'Analyze website & score lead quality' } 
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: 'trigger-1', target: 'action-1', animated: true, style: { stroke: '#0d9488', strokeWidth: 2 } },
];

export default function AutomationBuilder() {
  const { currentTenant } = useTenant();
  const [userId, setUserId] = useState<string>('');
  const [workflowName, setWorkflowName] = useState('Lead Welcome Sequence');
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [savedWorkflows, setSavedWorkflows] = useState<Workflow[]>([]);
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'history' | 'templates'>('editor');
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [workflowTemplates, setWorkflowTemplates] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  
  const rfInstance = useRef<any>(null);

  const fetchWorkflows = useCallback(async (uid: string) => {
    if (!uid) return;
    const { workflows, error } = await workflowService.getWorkflows(uid);
    if (!error) setSavedWorkflows(workflows);
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUserId(data.user.id);
        fetchWorkflows(data.user.id);
      }
    };
    fetchUser();
  }, [fetchWorkflows]);

  const fetchHistory = useCallback(async () => {
    if (!workflowId) return;
    setLoadingHistory(true);
    const { executions, error } = await workflowService.getWorkflowExecutions(workflowId);
    if (!error) setExecutions(executions);
    setLoadingHistory(false);
  }, [workflowId]);

  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    const { templates, error } = await workflowService.getWorkflowTemplates();
    if (!error) setWorkflowTemplates(templates);
    setLoadingTemplates(false);
  }, []);

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
    if (activeTab === 'templates') fetchTemplates();
  }, [activeTab, fetchHistory, fetchTemplates]);

  const handleNew = () => {
    setWorkflowId(null);
    setWorkflowName('New Sequence');
    setNodes(initialNodes);
    setEdges(initialEdges);
    toast.success('Started new workflow');
  };

  const loadWorkflow = (wf: Workflow) => {
    setWorkflowId(wf.id);
    setWorkflowName(wf.name);
    
    // Restore nodes and edges from trigger_conditions (UI state)
    if (wf.trigger_conditions && wf.trigger_conditions.nodes) {
      setNodes(wf.trigger_conditions.nodes);
      setEdges(wf.trigger_conditions.edges || []);
    } else if (wf.steps) {
      // Fallback: Reconstruct simple vertical layout from steps
      const reconstructedNodes: Node[] = [
        { 
          id: 'trigger-1', 
          type: 'triggerNode', 
          position: { x: 250, y: 50 }, 
          data: { label: wf.trigger_type || 'Manual Trigger', description: 'Restored from data structure' } 
        }
      ];
      const reconstructedEdges: Edge[] = [];
      
      wf.steps.forEach((step, idx) => {
        const id = `action-${idx}`;
        reconstructedNodes.push({
          id,
          type: 'actionNode',
          position: { x: 250, y: 200 + (idx * 150) },
          data: { 
            label: step.action_type, 
            description: `Order: ${step.action_order}`,
            actionType: step.action_type,
            type: (step.action_config as any)?.type || 'ops'
          }
        });
        reconstructedEdges.push({
          id: `e-${idx}`,
          source: idx === 0 ? 'trigger-1' : `action-${idx - 1}`,
          target: id,
          animated: true,
          style: { stroke: '#0d9488', strokeWidth: 2 }
        });
      });
      setNodes(reconstructedNodes);
      setEdges(reconstructedEdges);
    }
    
    setShowLoadMenu(false);
    toast.success(`Loaded ${wf.name}`);
  };

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds: Edge[]) => addEdge({ ...params, animated: true, style: { stroke: '#0d9488', strokeWidth: 2 } } as Edge, eds)),
    [setEdges],
  );

  const handleSave = async () => {
    if (!userId || !currentTenant?.id) {
      toast.error('User not authenticated');
      return;
    }

    setSaving(true);
    try {
      // Find trigger node
      const triggerNode = nodes.find((n: Node) => n.type === 'triggerNode');
      
      // Convert ReactFlow nodes to workflow actions 
      // (We store the full graph in trigger_conditions/metadata for UI restoration)
      const actionNodes = nodes.filter((n: Node) => n.type !== 'triggerNode');
      const steps = actionNodes.map((node: Node, index: number) => ({
        action_type: (node.data as any).actionType || 'webhook',
        action_order: index,
        action_config: {
          label: node.data.label,
          description: node.data.description,
          type: (node.data as any).type,
          position: node.position,
          // Merge any node-specific config if it exists
          ...((node.data as any).config || {})
        },
      }));

      const workflowData = {
        name: workflowName,
        description: 'Automated workflow for lead engagement',
        is_active: true,
        trigger_type: (triggerNode?.data as any)?.triggerType || 'manual_trigger',
        trigger_conditions: {
          nodes, 
          edges,
        },
        steps,
        created_by: userId,
      };

      if (workflowId) {
        // Update existing workflow
        const { success, error } = await workflowService.updateWorkflow(workflowId, workflowData);
        if (error) throw new Error(error);
        toast.success('Workflow updated successfully!');
      } else {
        // Create new workflow
        const { workflow, error } = await workflowService.createWorkflow(workflowData);
        if (error) throw new Error(error);
        if (workflow) {
          setWorkflowId(workflow.id);
          fetchWorkflows(userId); // Refresh list
          toast.success('Workflow published successfully!');
        }
      }
    } catch (error) {
      console.error('Failed to save workflow:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save workflow');
    } finally {
      setSaving(false);
    }
  };

  const handleExecute = async () => {
    if (!workflowId) {
      toast.error('Please save the workflow first');
      return;
    }

    setExecuting(true);
    try {
      const { success, error } = await workflowService.executeWorkflow(workflowId, {
        userId,
        tenantId: currentTenant?.id,
      });

      if (success) {
        toast.success('Workflow executed successfully!');
      } else {
        throw new Error(error || 'Execution failed');
      }
    } catch (error) {
      console.error('Failed to execute workflow:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to execute workflow');
    } finally {
      setExecuting(false);
    }
  };

  const [showActionMenu, setShowActionMenu] = useState(false);

  const [activeCategory, setActiveCategory] = useState('all');

  const actionCategories = [
    { id: 'all', label: 'All' },
    { id: 'zoho', label: 'Zoho CRM' },
    { id: 'mail', label: 'Mail' },
    { id: 'ai', label: 'AI' },
    { id: 'docs', label: 'Documents' },
    { id: 'ops', label: 'Operations' },
  ];

  const actionTemplates = [
    // Zoho CRM
    { label: 'Create Zoho Lead', description: 'Add lead to Zoho CRM', type: 'zoho', category: 'zoho', actionType: 'zoho_create_lead' },
    { label: 'Update Zoho Deal', description: 'Update deal stage/amount', type: 'zoho', category: 'zoho', actionType: 'zoho_update_deal' },
    { label: 'Create Contact', description: 'Add contact to Zoho CRM', type: 'zoho', category: 'zoho', actionType: 'zoho_create_contact' },
    // Mail
    { label: 'Send Gmail', description: 'Send email via Gmail API', type: 'email', category: 'mail', actionType: 'send_email' },
    { label: 'Send Zoho Mail', description: 'Send email via Zoho Mail', type: 'zoho_mail', category: 'mail', actionType: 'zoho_send_mail' },
    { label: 'Launch Campaign', description: 'Create & schedule email campaign', type: 'campaign', category: 'mail', actionType: 'launch_campaign' },
    // AI
    { label: 'AI Lead Analysis', description: 'Score & qualify lead with AI', type: 'ai', category: 'ai', actionType: 'ai_analyze_lead' },
    { label: 'AI Draft Email', description: 'AI writes personalized email', type: 'ai', category: 'ai', actionType: 'ai_draft_email' },
    { label: 'AI Generate Contract', description: 'AI drafts contract content', type: 'ai', category: 'ai', actionType: 'ai_generate_contract' },
    // Documents
    { label: 'Create Contract', description: 'Generate service contract', type: 'document', category: 'docs', actionType: 'create_contract' },
    { label: 'Generate Invoice', description: 'Auto-create business invoice', type: 'finance', category: 'docs', actionType: 'generate_invoice' },
    { label: 'Generate Quotation', description: 'Create price quotation', type: 'finance', category: 'docs', actionType: 'generate_quote' },
    // Operations
    { label: 'Create Task', description: 'Add task to task board', type: 'task', category: 'ops', actionType: 'create_task' },
    { label: 'Send Notification', description: 'Push notification to user', type: 'notify', category: 'ops', actionType: 'send_notification' },
    { label: 'Schedule Meeting', description: 'Book video meeting', type: 'meeting', category: 'ops', actionType: 'schedule_meeting' },
    { label: 'Update Project', description: 'Change project status', type: 'project', category: 'ops', actionType: 'update_project_status' },
    { label: 'Send Message', description: 'Internal CRM message', type: 'notify', category: 'ops', actionType: 'send_message' },
  ];

  const filteredTemplates = activeCategory === 'all'
    ? actionTemplates
    : actionTemplates.filter(t => t.category === activeCategory);

  const addActionNode = (template?: typeof actionTemplates[0]) => {
    const selectedTemplate = template || actionTemplates[0];
    const newNode: Node = {
        id: `action-${Date.now()}`,
        type: 'actionNode',
        position: { x: 250 + (Math.random() * 100 - 50), y: 350 + (nodes.length * 50) },
        data: { 
          label: selectedTemplate.label, 
          description: selectedTemplate.description,
          type: selectedTemplate.type,
          actionType: selectedTemplate.actionType,
        }
    };
    setNodes((nds: Node[]) => [...nds, newNode]);
    setShowActionMenu(false);
    setActiveCategory('all');
  };

  const centerView = () => {
    if (rfInstance.current) {
        rfInstance.current.fitView({ padding: 0.2, duration: 800 });
    }
  };

  const loadFromTemplate = (template: any) => {
    setWorkflowId(null);
    setWorkflowName(template.name);
    
    // Convert template definition to Nodes/Edges
    const definition = template.definition;
    const reconstructedNodes: Node[] = [
        { 
          id: 'trigger-1', 
          type: 'triggerNode', 
          position: { x: 250, y: 50 }, 
          data: { label: definition.trigger?.event || 'Event Trigger', description: definition.description } 
        }
    ];
    const reconstructedEdges: Edge[] = [];
    
    definition.steps.forEach((step: any, idx: number) => {
        const id = `action-${idx}`;
        reconstructedNodes.push({
          id,
          type: 'actionNode',
          position: { x: 250, y: 200 + (idx * 150) },
          data: { label: step.type === 'email' ? 'Send Email' : step.id, description: step.config?.template || 'Auto-generated step', type: step.type === 'email' ? 'email' : 'ops' }
        });
        reconstructedEdges.push({
          id: `e-${idx}`,
          source: idx === 0 ? 'trigger-1' : `action-${idx - 1}`,
          target: id,
          animated: true,
          style: { stroke: '#0d9488', strokeWidth: 2 }
        });
    });
    setNodes(reconstructedNodes);
    setEdges(reconstructedEdges);
    setActiveTab('editor');
    toast.success(`Loaded ${template.name} template`);
  };

  return (
    <div className="w-full h-full min-w-0 min-h-[min(100dvh,720px)] sm:min-h-[640px] lg:min-h-[700px] flex flex-col bg-slate-50 dark:bg-slate-950 rounded-xl sm:rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 relative shadow-inner">
        {/* Main Tab Controller */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between z-20 min-w-0">
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto [scrollbar-width:thin] min-w-0">
                {[
                    { id: 'editor', label: 'Builder', icon: Zap },
                    { id: 'history', label: 'Audit Trail', icon: History },
                    { id: 'templates', label: 'Templates', icon: LayoutTemplate },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all shrink-0 ${
                            activeTab === tab.id
                                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3 shrink-0 self-end sm:self-auto">
                <div className="hidden md:block text-right min-w-0">
                    <div className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{workflowName}</div>
                    <div className="text-xs text-slate-500 uppercase tracking-widest font-bold">
                        {workflowId ? 'Syncing Cloud' : 'New Draft'}
                    </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-xs ring-2 ring-indigo-500/20 shadow-lg">
                    {userId ? 'A' : '?'}
                </div>
            </div>
        </div>

        <div className="flex-1 relative overflow-hidden">
            {activeTab === 'editor' && (
                <>
        {/* Header toolbar */}
        <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-2">
                <button 
                  onClick={centerView}
                  className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-2 rounded-xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 hover:text-indigo-500 transition"
                  title="Center View"
                >
                  <Maximize className="w-5 h-5" />
                </button>
            </div>

            <div className="pointer-events-auto flex gap-2">
                <button 
                  onClick={handleNew}
                  className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 transition flex items-center gap-2 text-sm font-medium"
                >
                  <Plus className="w-4 h-4" /> New
                </button>

                <div className="relative">
                    <button 
                        onClick={() => {
                          setShowLoadMenu(!showLoadMenu);
                          if (!showLoadMenu) fetchWorkflows(userId);
                        }}
                        className="flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 transition text-sm font-medium"
                    >
                        <RefreshCw className="w-4 h-4" /> Load
                    </button>
                    {showLoadMenu && (
                        <div className="absolute top-full mt-2 right-0 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 w-[280px]">
                            <div className="p-3 border-b border-slate-100 dark:border-slate-700 font-bold text-xs uppercase tracking-wider text-slate-500">
                                Saved Automations
                            </div>
                            <div className="max-h-[300px] overflow-y-auto">
                                {savedWorkflows.length === 0 ? (
                                    <div className="p-4 text-center text-slate-400 text-xs italic">No saved workflows found</div>
                                ) : (
                                    savedWorkflows.map(wf => (
                                        <button
                                            key={wf.id}
                                            onClick={() => loadWorkflow(wf)}
                                            className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-50 dark:border-slate-700/50 last:border-0 transition"
                                        >
                                            <div className="text-sm font-bold text-slate-800 dark:text-white truncate">{wf.name}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">{wf.is_active ? 'Active' : 'Draft'} • {new Date(wf.created_at || '').toLocaleDateString()}</div>
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="relative">
                    <button 
                        onClick={() => setShowActionMenu(!showActionMenu)}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl shadow-lg shadow-indigo-500/30 transition text-sm font-bold"
                    >
                        <Plus className="w-4 h-4" /> Add Action
                    </button>
                    {showActionMenu && (
                        <div className="absolute top-full mt-2 right-0 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 w-[320px]">
                            <div className="flex gap-1 p-2 border-b border-slate-100 dark:border-slate-700 overflow-x-auto">
                                {actionCategories.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setActiveCategory(cat.id)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all ${
                                            activeCategory === cat.id
                                                ? 'bg-indigo-500 text-white shadow'
                                                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                                        }`}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                            <div className="max-h-[320px] overflow-y-auto">
                                {filteredTemplates.map((template, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => addActionNode(template)}
                                        className="w-full px-3 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition flex items-center gap-3 border-b border-slate-100/50 dark:border-slate-700/50 last:border-0"
                                    >
                                        <span className="text-base w-6 text-center shrink-0">
                                            {NODE_STYLES[template.type]?.icon || '⚡'}
                                        </span>
                                        <div className="min-w-0">
                                            <div className="font-semibold text-xs text-slate-900 dark:text-white truncate">{template.label}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{template.description}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <button 
                    onClick={handleExecute}
                    disabled={!workflowId || executing}
                    className="flex items-center gap-2 bg-teal-500 hover:bg-teal-400 disabled:bg-slate-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl shadow-lg transition font-medium"
                >
                    {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {executing ? 'Running...' : 'Test Run'}
                </button>
                <button 
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-400 disabled:cursor-not-allowed text-white px-5 py-2 rounded-xl shadow-lg shadow-amber-500/20 transition font-medium"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Saving...' : (workflowId ? 'Update' : 'Publish')}
                </button>
            </div>
        </div>

        <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onInit={(instance) => {
                rfInstance.current = instance;
                instance.fitView({ padding: 0.2 });
            }}
            className="bg-slate-50 dark:bg-slate-950"
        >
            <Controls className="bg-white dark:bg-slate-800 border-none shadow-xl rounded-xl overflow-hidden" />
            <MiniMap 
                nodeStrokeColor={(n: Node) => {
                    if (n.type === 'triggerNode') return '#4f46e5';
                    if (n.type === 'actionNode') return '#0f172a';
                    return '#eee';
                }}
                nodeColor={(n: Node) => {
                    if (n.type === 'triggerNode') return '#6366f1';
                    if (n.type === 'actionNode') return '#1e293b';
                    return '#fff';
                }}
                maskColor="rgba(0, 0, 0, 0.1)"
                className="bg-white/50 dark:bg-slate-900/50 backdrop-blur rounded-xl shadow-xl border border-slate-200 dark:border-slate-800" 
            />
            <Background color="#94a3b8" gap={24} size={1} />
        </ReactFlow>

        {/* Footer info */}
        <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
            <Panel position="bottom-left" className="pointer-events-auto bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800/30 flex items-center gap-2 shadow-lg">
                <Settings className="w-3 h-3" />
                Drag handles to connect actions. No code required.
            </Panel>
        </div>
            </>
        )}

        {activeTab === 'history' && (
            <div className="w-full h-full min-w-0 bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="mb-8">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                        <History className="w-6 h-6 text-indigo-500" /> Audit Trail
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Detailed execution history for <b>{workflowName}</b></p>
                </div>

                {!workflowId ? (
                    <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                        <div className="text-center">
                            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-500 font-medium">Save this workflow to start tracking history</p>
                        </div>
                    </div>
                ) : loadingHistory ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                    </div>
                ) : executions.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
                        <div className="text-center">
                            <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                            <p className="text-slate-500 font-medium">No execution history found yet.</p>
                            <button onClick={handleExecute} className="mt-4 text-indigo-500 font-bold hover:underline">Run a Test Now</button>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl overflow-x-auto">
                        <table className="w-full min-w-[520px] text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">Execution Date</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">Status</th>
                                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-500">Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {executions.map(ex => (
                                    <tr key={ex.id} className="border-b border-slate-50 dark:border-slate-800 last:border-0">
                                        <td className="px-6 py-5 text-sm font-medium text-slate-900 dark:text-slate-200">
                                            {new Date(ex.executed_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-5">
                                            {ex.status === 'completed' ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-black uppercase tracking-wider">
                                                    <CheckCircle2 className="w-3 h-3" /> Completed
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 text-xs font-black uppercase tracking-wider">
                                                    <XCircle className="w-3 h-3" /> {ex.status}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-sm text-slate-500 dark:text-slate-400">
                                            {ex.error_message || 'Workflow executed successfully.'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'templates' && (
            <div className="w-full h-full min-w-0 bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 flex flex-col animate-in fade-in scale-in-95 duration-500">
                <div className="mb-8">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                        <LayoutTemplate className="w-6 h-6 text-indigo-500" /> Automation Templates
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Quick-start with industry-standard patterns</p>
                </div>

                {loadingTemplates ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {workflowTemplates.map(template => (
                            <button
                                key={template.id}
                                onClick={() => loadFromTemplate(template)}
                                className="group relative bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all text-left shadow-lg hover:shadow-indigo-500/10"
                            >
                                <span className="absolute top-6 right-6 text-4xl group-hover:scale-110 transition-transform duration-300">
                                    {template.icon}
                                </span>
                                <div className="pr-12">
                                    <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">{template.name}</h3>
                                    <div className="inline-block px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-widest mb-4">
                                        {template.category}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                                        {template.description}
                                    </p>
                                </div>
                                <div className="mt-6 pt-4 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
                                    <span className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">
                                        {template.definition.steps.length} Steps
                                    </span>
                                    <Plus className="w-5 h-5 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        )}
        </div>
    </div>
  );
}

