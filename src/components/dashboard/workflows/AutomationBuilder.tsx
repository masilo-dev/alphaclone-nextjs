import React, { useState, useCallback } from 'react';
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
import { Zap, Mail, Plus, Play, Save, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

// Define custom node types for a premium feel
const TriggerNode = ({ data }: { data: any }) => (
  <div className="px-4 py-3 shadow-xl rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white min-w-[200px] border border-indigo-400">
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-200" />
    <div className="flex items-center gap-2 font-bold mb-1">
      <Zap className="w-4 h-4 text-indigo-100" />
      {data.label}
    </div>
    <div className="text-xs text-indigo-100 opacity-80">{data.description}</div>
  </div>
);

const ActionNode = ({ data }: { data: any }) => (
  <div className="px-4 py-3 shadow-xl rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white min-w-[200px] border-2 border-slate-200 dark:border-slate-700">
    <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    <div className="flex items-center gap-2 font-bold mb-1">
      <Mail className="w-4 h-4 text-teal-500" />
      {data.label}
    </div>
    <div className="text-xs text-slate-500 dark:text-slate-400">{data.description}</div>
  </div>
);

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
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#0d9488', strokeWidth: 2 } }, eds)),
    [setEdges],
  );

  const handleSave = () => {
    // In a real app, serialize nodes/edges to JSON and save to Supabase
    console.log("Saving workflow:", { nodes, edges });
    toast.success("Workflow saved successfully! (Native No-Webhook Automation)");
  };

  const addActionNode = () => {
    const newNode: Node = {
        id: `action-${Date.now()}`,
        type: 'actionNode',
        position: { x: 250 + (Math.random() * 100 - 50), y: 350 + (nodes.length * 50) },
        data: { label: 'Send AI Outreach Email', description: 'Drafts and sends a hyper-personalized email.' }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 dark:bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 relative shadow-inner min-h-[600px]">
        {/* Header toolbar */}
        <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-center pointer-events-none">
            <div className="pointer-events-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 flex flex-col">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" /> Lead Welcome Sequence
                </h3>
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">Native Execution Engine</span>
            </div>

            <div className="pointer-events-auto flex gap-2">
                <button 
                    onClick={addActionNode}
                    className="flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 transition"
                >
                    <Plus className="w-4 h-4" /> Add Action
                </button>
                <button 
                    onClick={handleSave}
                    className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-5 py-2 rounded-xl shadow-lg shadow-amber-500/20 transition font-medium"
                >
                    <Save className="w-4 h-4" /> Publish Workflow
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
            fitView
            className="bg-slate-50 dark:bg-slate-950"
        >
            <Controls className="bg-white dark:bg-slate-800 border-none shadow-xl rounded-xl overflow-hidden" />
            <MiniMap 
                nodeStrokeColor={(n) => {
                    if (n.type === 'triggerNode') return '#4f46e5';
                    if (n.type === 'actionNode') return '#0f172a';
                    return '#eee';
                }}
                nodeColor={(n) => {
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
                No webhooks required. This workflow executes directly on your Supabase Edge Functions.
            </Panel>
        </div>
    </div>
  );
}
