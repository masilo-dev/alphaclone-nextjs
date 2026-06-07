'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { projectService } from '@/services/projectService';
import { milestoneService, Milestone } from '@/services/milestoneService';
import { Project } from '@/types';
import { Card } from '@/components/ui/UIComponents';
import { CheckCircle2, Calendar, MessageSquare, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface ProjectComment {
  id: string;
  author_name: string;
  author_email?: string | null;
  content: string;
  is_client: boolean;
  created_at: string;
}

export default function PublicProjectPage() {
  const params = useParams();
  const projectId = params?.id as string;
  const [project, setProject] = useState<Partial<Project> | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);

  const loadComments = useCallback(async () => {
    if (!projectId) return;
    const res = await fetch(`/api/projects/public/${projectId}/comments`);
    const data = await res.json().catch(() => ({}));
    if (data.success) setComments(data.comments || []);
  }, [projectId]);

  useEffect(() => {
    if (projectId) loadData();
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    loadComments();
    const channel = supabase
      .channel(`project_comments_${projectId}`)
      .on('postgres_changes' as any, {
        event: 'INSERT',
        schema: 'public',
        table: 'project_comments',
        filter: `project_id=eq.${projectId}`,
      }, (payload: any) => {
        const row = payload.new as ProjectComment;
        setComments((prev) => (prev.some((c) => c.id === row.id) ? prev : [...prev, row]));
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [projectId, loadComments]);

  const loadData = async () => {
    try {
      const { project, error: projectError } = await projectService.getPublicProjectStatus(projectId);
      if (projectError) throw new Error(projectError);
      setProject(project);
      const { milestones, error: milestonesError } = await milestoneService.getMilestones(projectId);
      if (!milestonesError) setMilestones(milestones);
    } catch {
      setError('Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorName.trim() || !newComment.trim()) {
      toast.error('Name and message are required');
      return;
    }
    setPosting(true);
    try {
      const res = await fetch(`/api/projects/public/${projectId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorName, authorEmail, content: newComment, isClient: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post');
      if (data.comment) setComments((prev) => [...prev, data.comment]);
      setNewComment('');
      toast.success('Message sent to your team');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-teal-400">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
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
        <div className="text-center space-y-4">
          <div className="inline-block px-4 py-1.5 rounded-full bg-teal-500/10 text-teal-400 text-sm font-medium border border-teal-500/20">
            Project Portal
          </div>
          <h1 className="text-4xl md:text-5xl font-bold">{project.name}</h1>
          {project.ownerName && <p className="text-slate-400">Client: {project.ownerName}</p>}
        </div>

        <Card className="p-8 border-slate-800 bg-slate-900/50 backdrop-blur-xl">
          <div className="space-y-2 mb-6">
            <div className="flex justify-between text-sm text-slate-400">
              <span>Overall Progress</span>
              <span className="text-teal-400 font-bold">{project.progress}%</span>
            </div>
            <div className="h-4 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all" style={{ width: `${project.progress}%` }} />
            </div>
          </div>
          <div className="text-3xl font-bold text-teal-400">{project.currentStage || 'In Progress'}</div>
        </Card>

        {milestones.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-xl font-bold">Timeline</h3>
            {milestones.map((m, index) => (
              <div key={m.id} className="p-6 rounded-xl border border-slate-800 bg-slate-900/50">
                <div className="flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.status === 'completed' ? 'bg-teal-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                    {m.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : index + 1}
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">{m.name}</h4>
                    {m.dueDate && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3" /> {new Date(m.dueDate).toLocaleDateString()}
                      </p>
                    )}
                    {m.description && <p className="text-sm text-slate-400 mt-2">{m.description}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Card className="p-6 border-slate-800 bg-slate-900/50">
          <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-teal-400" /> Project Conversation
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto mb-4">
            {comments.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No messages yet. Tell your team what you need below.</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className={`p-4 rounded-xl ${c.is_client ? 'bg-teal-500/5 border border-teal-500/20 ml-4' : 'bg-slate-800/50 border border-slate-700/50 mr-4'}`}>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span className="font-bold text-slate-300">{c.author_name}{c.is_client ? ' (You)' : ' (Team)'}</span>
                    <span>{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-slate-200 whitespace-pre-wrap">{c.content}</p>
                </div>
              ))
            )}
          </div>
          <form onSubmit={handlePostComment} className="space-y-3 border-t border-slate-800 pt-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="Your name" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-white" required />
              <input value={authorEmail} onChange={(e) => setAuthorEmail(e.target.value)} placeholder="Email (optional)" type="email" className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-white" />
            </div>
            <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="What do you need? Add notes, questions, or feedback..." rows={3} className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white resize-none" required />
            <button type="submit" disabled={posting} className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 rounded-xl text-white font-bold text-sm disabled:opacity-50">
              {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send Message
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
