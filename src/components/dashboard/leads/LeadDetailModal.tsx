import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Calendar, Clock, Plus, ArrowRight, Upload, Phone, Mail, Globe, MapPin, User, FileText, Send, Bot } from 'lucide-react';
import { Modal, Button, Input, Card, Badge } from '../../ui/UIComponents';
import { Lead, leadService } from '../../../services/leadService';
import { taskService, Task } from '../../../services/taskService';
import { calendarService, CalendarEvent } from '../../../services/calendarService';
import { dealService } from '../../../services/dealService';
import { contactService } from '../../../services/contactService';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface LeadDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    lead: Lead;
    onLeadUpdate?: (lead: Lead) => void;
}

export default function LeadDetailModal({ isOpen, onClose, lead, onLeadUpdate }: LeadDetailModalProps) {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'meetings' | 'notes'>('overview');
    const [isLoading, setIsLoading] = useState(false);

    // Data States
    const [tasks, setTasks] = useState<Task[]>([]);
    const [events, setEvents] = useState<CalendarEvent[]>([]);

    // Task Creation State
    const [showTaskForm, setShowTaskForm] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskDueDate, setNewTaskDueDate] = useState('');

    // Meeting Creation State
    const [showMeetingForm, setShowMeetingForm] = useState(false);
    const [meetingTitle, setMeetingTitle] = useState('');
    const [meetingDate, setMeetingDate] = useState('');
    const [meetingTime, setMeetingTime] = useState('');
    // Notes State
    const [leadNotes, setLeadNotes] = useState(lead.notes || '');
    const [isSavingNotes, setIsSavingNotes] = useState(false);

    useEffect(() => {
        if (isOpen && lead.id) {
            fetchRelatedData();
        }
    }, [isOpen, lead.id, activeTab]);

    const fetchRelatedData = async () => {
        setIsLoading(true);
        try {
            // Fetch Tasks
            if (activeTab === 'tasks' || activeTab === 'overview') {
                const { tasks: fetchedTasks } = await taskService.getTasks({
                    relatedToLead: lead.id
                });
                setTasks(fetchedTasks);
            }

            // Fetch Meetings (Events)
            // Note: Assuming calendarService supports filtering by metadata or explicit column
            // For now, we manually check if we can filter client side from global events or if we need a new service method
            // We'll try to fetch all user events and filter client side for MVP to avoid strict schema dependency immediately,
            // or if we updated logic, use getEvents with filter.
            // But getEvents is user based. We'll stick to Tasks mainly for Phase 2 MVP.

        } catch (error) {
            console.error('Error fetching lead data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateTask = async () => {
        if (!newTaskTitle.trim() || !user) return;

        try {
            const { task, error } = await taskService.createTask(user.id, {
                title: newTaskTitle,
                dueDate: newTaskDueDate,
                relatedToLead: lead.id,
                priority: 'medium',
                assignedTo: user.id // Self assign by default
            });

            if (error) throw new Error(error);

            toast.success('Task created successfully');
            setNewTaskTitle('');
            setNewTaskDueDate('');
            setShowTaskForm(false);
            fetchRelatedData();
        } catch (error) {
            toast.error('Failed to create task');
        }
    };

    const handleToggleTask = async (taskId: string, currentStatus: string) => {
        try {
            const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
            // Optimistic update
            setTasks(tasks.map(t => t.id === taskId ? { ...t, status: newStatus as any } : t));

            await taskService.updateTask(taskId, { status: newStatus as any });
        } catch (error) {
            toast.error('Failed to update task');
            fetchRelatedData(); // Revert on error
        }
    };

    const handleScheduleMeeting = async () => {
        if (!meetingTitle.trim() || !meetingDate || !meetingTime || !user) return;

        try {
            const startTime = new Date(`${meetingDate}T${meetingTime}`);
            const { error } = await calendarService.createVideoCallEvent(
                user.id,
                meetingTitle,
                startTime,
                60, // Default duration
                [], // Attendees
                lead.id // Linked to this lead
            );

            if (error) throw new Error(error);

            toast.success('Meeting scheduled successfully');
            setMeetingTitle('');
            setMeetingDate('');
            setMeetingTime('');
            setShowMeetingForm(false);
            // Ideally fetch meetings here
        } catch (error) {
            toast.error('Failed to schedule meeting');
        }
    };

    const handleConvert = async () => {
        if (!user) return;
        const name = window.prompt('Enter Deal Name:', lead.businessName);
        if (!name) return;

        try {
            // STEP 1: Convert lead to contact
            // This creates a proper contact record and marks the lead as converted
            const { contactId, error: convertError } = await contactService.convertLeadToContact(lead.id, {
                createCompany: false, // Don't auto-create company (can be added later)
            });

            if (convertError || !contactId) {
                throw new Error(convertError || 'Failed to create contact from lead');
            }

            // STEP 2: Create deal with the new contact
            const { error: dealError } = await dealService.createDeal(user.id, {
                name,
                contactId: contactId, // ✅ FIXED: Now using real contact_id instead of lead.id
                value: lead.value,
                stage: 'qualified', // Start as qualified since lead was already qualified
                probability: 25, // 25% for qualified stage
                metadata: {
                    originalLeadId: lead.id,
                    convertedAt: new Date().toISOString()
                }
            });

            if (dealError) throw new Error(dealError);

            toast.success(`✅ Lead converted to contact and deal "${name}" created!`);

            // Lead status is already updated by convert_lead_to_contact() function
            if (onLeadUpdate) onLeadUpdate({ ...lead, status: 'converted' });
            onClose();
        } catch (error) {
            console.error('Lead conversion error:', error);
            toast.error('Failed to convert lead: ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    const handleSaveNotes = async () => {
        setIsSavingNotes(true);
        try {
            const { error } = await leadService.updateLead(lead.id, { notes: leadNotes });
            if (error) throw new Error(error);
            toast.success('Notes saved successfully');
            if (onLeadUpdate) onLeadUpdate({ ...lead, notes: leadNotes });
        } catch (error) {
            toast.error('Failed to save notes');
        } finally {
            setIsSavingNotes(false);
        }
    };

    const StatusBadge = ({ status }: { status: string }) => {
        const colors: any = {
            new: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
            contacted: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
            qualified: 'bg-green-500/10 text-green-500 border-green-500/20',
            lost: 'bg-red-500/10 text-red-500 border-red-500/20',
        };
        return (
            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${colors[status.toLowerCase()] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                {status.toUpperCase()}
            </span>
        );
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title=""
            maxWidth="max-w-4xl"
        >
            <div className="flex flex-col h-[80vh] -m-6">
                {/* Header */}
                <div className="px-4 sm:px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start gap-4 bg-slate-900">
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-1">
                            <h2 className="text-xl sm:text-2xl font-bold text-white truncate">{lead.businessName}</h2>
                            <StatusBadge status={lead.status || 'New'} />
                        </div>
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-slate-400">
                            {lead.industry && <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {lead.industry}</span>}
                            {lead.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {lead.location}</span>}
                            {lead.website && (
                                <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-teal-400 transition-colors">
                                    <Globe className="w-3 h-3" /> Website
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        {lead.email && (
                            <Button variant="outline" size="sm" onClick={() => window.open(`mailto:${lead.email}`)} className="flex-1 sm:flex-none">
                                <Mail className="w-4 h-4 sm:mr-2" />
                                <span className="hidden sm:inline">Email</span>
                            </Button>
                        )}
                        <Button variant="outline" className="border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10 flex-1 sm:flex-none" size="sm" onClick={() => toast('Quote management coming soon!', { icon: '📄' })}>
                            <FileText className="w-4 h-4 sm:mr-2" />
                            <span className="hidden sm:inline">Create Quote</span>
                        </Button>
                        <Button className="bg-teal-600 hover:bg-teal-500 flex-1 sm:flex-none" size="sm" onClick={handleConvert}>
                            Convert to Deal
                        </Button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-4 sm:px-6 border-b border-slate-800 bg-slate-900/50 flex gap-4 sm:gap-6 overflow-x-auto scrollbar-hide">
                    {['overview', 'tasks', 'meetings', 'notes'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`py-3 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab
                                ? 'border-teal-500 text-white'
                                : 'border-transparent text-slate-400 hover:text-slate-300'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950">

                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="p-6 space-y-4">
                                <h3 className="text-lg font-semibold text-white mb-4">Contact Info</h3>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 text-slate-300">
                                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                                            <Mail className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <span>{lead.email || 'No email'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-300">
                                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                                            <Phone className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <span>{lead.phone || 'No phone'}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-slate-300">
                                        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
                                            <Globe className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <span>{lead.website || 'No website'}</span>
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-6">
                                <h3 className="text-lg font-semibold text-white mb-4">AI Insights</h3>
                                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                                    <p className="text-purple-200 text-sm leading-relaxed">
                                        {lead.notes || "No AI analysis available yet. Generate insights from the Sales Agent."}
                                    </p>
                                </div>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'tasks' && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                                <h3 className="text-lg font-semibold text-white">Tasks</h3>
                                <Button size="sm" onClick={() => setShowTaskForm(true)} className="bg-teal-600 w-full sm:w-auto">
                                    <Plus className="w-4 h-4 mr-2" /> Add Task
                                </Button>
                            </div>

                            {/* Task Form */}
                            {showTaskForm && (
                                <Card className="p-4 mb-4 border-teal-500/30 bg-teal-900/10">
                                    <div className="space-y-3">
                                        <Input
                                            placeholder="What needs to be done?"
                                            value={newTaskTitle}
                                            onChange={(e) => setNewTaskTitle(e.target.value)}
                                            autoFocus
                                        />
                                        <div className="flex gap-3">
                                            <Input
                                                type="date"
                                                value={newTaskDueDate}
                                                onChange={(e) => setNewTaskDueDate(e.target.value)}
                                                className="w-48"
                                            />
                                            <div className="flex-1 flex justify-end gap-2">
                                                <Button variant="ghost" onClick={() => setShowTaskForm(false)}>Cancel</Button>
                                                <Button onClick={handleCreateTask}>Save Task</Button>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            )}

                            {/* Task List */}
                            <div className="space-y-2">
                                {tasks.length === 0 && !showTaskForm ? (
                                    <div className="text-center py-12 text-slate-500">
                                        <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                        <p>No tasks yet. Create one to get started.</p>
                                    </div>
                                ) : (
                                    tasks.map(task => (
                                        <div key={task.id} className="flex items-center gap-3 p-3 bg-slate-900/50 hover:bg-slate-900 rounded-lg border border-slate-800 group transition-colors">
                                            <button
                                                onClick={() => handleToggleTask(task.id, task.status)}
                                                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${task.status === 'completed' ? 'bg-teal-500 border-teal-500' : 'border-slate-600 hover:border-teal-500'}`}
                                            >
                                                {task.status === 'completed' && <CheckSquare className="w-3 h-3 text-white" />}
                                            </button>
                                            <span className={`flex-1 ${task.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                                                {task.title}
                                            </span>
                                            {task.dueDate && (
                                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {format(new Date(task.dueDate), 'MMM d')}
                                                </span>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'meetings' && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                                <h3 className="text-lg font-semibold text-white">Meetings</h3>
                                <Button size="sm" onClick={() => setShowMeetingForm(true)} className="bg-teal-600 w-full sm:w-auto">
                                    <Plus className="w-4 h-4 mr-2" /> Schedule Meeting
                                </Button>
                            </div>

                            {showMeetingForm && (
                                <Card className="p-4 mb-4 border-teal-500/30 bg-teal-900/10">
                                    <div className="space-y-3">
                                        <Input
                                            placeholder="Meeting Title"
                                            value={meetingTitle}
                                            onChange={(e) => setMeetingTitle(e.target.value)}
                                            autoFocus
                                        />
                                        <div className="flex gap-3">
                                            <Input
                                                type="date"
                                                value={meetingDate}
                                                onChange={(e) => setMeetingDate(e.target.value)}
                                                className="w-1/2"
                                            />
                                            <Input
                                                type="time"
                                                value={meetingTime}
                                                onChange={(e) => setMeetingTime(e.target.value)}
                                                className="w-1/2"
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2 pt-2">
                                            <Button variant="ghost" onClick={() => setShowMeetingForm(false)}>Cancel</Button>
                                            <Button onClick={handleScheduleMeeting}>Schedule</Button>
                                        </div>
                                    </div>
                                </Card>
                            )}

                            {/* Placeholder for list */}
                            <div className="text-center py-12 text-slate-500">
                                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>Scheduled meetings will appear on your main calendar.</p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'notes' && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                                <h3 className="text-base sm:text-lg font-semibold text-white">Lead Intelligence & Notes</h3>
                                <Button size="sm" onClick={handleSaveNotes} isLoading={isSavingNotes} className="bg-teal-600 w-full sm:w-auto">
                                    Save Changes
                                </Button>
                            </div>
                            <textarea
                                className="w-full h-[300px] bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 transition-all font-mono text-sm leading-relaxed"
                                placeholder="Record meeting outcomes, strategic observations, or lead requirements here..."
                                value={leadNotes}
                                onChange={(e) => setLeadNotes(e.target.value)}
                            />
                            <div className="flex items-center gap-2 text-xs text-slate-500 italic mt-2">
                                <Bot className="w-4 h-4 text-teal-400" />
                                <span>These notes are visible to all members of your team with access to this lead.</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}
