import React, { useState, useEffect } from 'react';
import { Modal, Button, Input } from '../ui/UIComponents';
import { dailyService } from '../../services/dailyService';
import { User } from '../../types';
import { Calendar, Clock, User as UserIcon, Shield, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    user: User;
    onSchedule: () => void;
}

const ScheduleMeetingModal: React.FC<Props> = ({ isOpen, onClose, user, onSchedule }) => {
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [attendees, setAttendees] = useState<string[]>([]);
    const isAdmin = user.role === 'admin';
    const [maxParticipants, setMaxParticipants] = useState(isAdmin ? 10 : 3);
    const [recordingEnabled, setRecordingEnabled] = useState(false);
    const [cancellationPolicyHours, setCancellationPolicyHours] = useState(3);
    const [allowClientCancellation, setAllowClientCancellation] = useState(true);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);


    useEffect(() => {
        if (isOpen) {
            // Reset form
            setTitle('');
            setDate('');
            setTime('');
            setAttendees([]);
            setMaxParticipants(isAdmin ? 10 : 3);
            setRecordingEnabled(false);
            setCancellationPolicyHours(3);
            setAllowClientCancellation(true);
            setShowAdvanced(false);

            const loadUsers = async () => {
                if (isAdmin) {
                    // Admin can schedule with any user
                    const { userService } = await import('../../services/userService');
                    const { users } = await userService.getUsers();
                    setProfiles(users.filter(u => u.id !== user.id));
                } else {
                    // Client can schedule with admin
                    const { userService } = await import('../../services/userService');
                    const { users } = await userService.getUsers();
                    const admins = users.filter(u => u.role === 'admin');
                    setProfiles(admins);
                    // Auto-select first admin as attendee for clients
                    if (admins.length > 0) {
                        setAttendees([admins[0].id]);
                    }
                }
            };
            loadUsers();
        }
    }, [isOpen, user.id, isAdmin]);

    const handleSubmit = async () => {
        if (!title.trim()) {
            toast.error('Please enter a meeting title');
            return;
        }

        if (!date || !time) {
            toast.error('Please select date and time');
            return;
        }

        // Validate 3-hour policy for clients
        if (!isAdmin) {
            const scheduledDateTime = new Date(`${date}T${time}`);
            const now = new Date();
            const hoursUntilMeeting = (scheduledDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

            if (hoursUntilMeeting < 3) {
                toast.error('Meetings must be scheduled at least 3 hours in advance');
                return;
            }
        }

        setLoading(true);
        try {
            // Create the video call
            const { call, error } = await dailyService.createVideoCall({
                hostId: user.id,
                title,
                participants: attendees,
                maxParticipants,
                recordingEnabled,
                cancellationPolicyHours,
                allowClientCancellation: isAdmin ? allowClientCancellation : true,
            });

            if (error || !call) {
                toast.error(error || 'Failed to schedule meeting');
                return;
            }

            // If date/time is provided, create calendar event
            if (date && time) {
                const { supabase } = await import('../../lib/supabase');
                const scheduledAt = new Date(`${date}T${time}`);
                const endTime = new Date(scheduledAt.getTime() + 60 * 60 * 1000); // 1 hour duration

                await supabase.from('calendar_events').insert({
                    user_id: user.id,
                    title,
                    description: `Video meeting: ${title}`,
                    start_time: scheduledAt.toISOString(),
                    end_time: endTime.toISOString(),
                    type: 'meeting',
                    video_room_id: call.room_id,
                    attendees: [user.id, ...attendees],
                });

                // Link calendar event to video call
                await supabase
                    .from('video_calls')
                    .update({ calendar_event_id: call.id })
                    .eq('id', call.id);
            }

            toast.success('Meeting scheduled successfully!');
            onSchedule();
            onClose();
        } catch (err) {
            console.error('Failed to schedule meeting:', err);
            toast.error('Failed to schedule meeting');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isAdmin ? "Schedule Meeting" : "Book Appointment"}
        >
            <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-2">
                {/* Meeting Title */}
                <div>
                    <label className="block text-sm font-bold text-white mb-2">
                        {isAdmin ? 'Meeting Title' : 'What do you need help with?'}
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={isAdmin ? "e.g. Project Review" : "e.g. Project Discussion"}
                        className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base"
                        required
                    />
                </div>

                {/* Date and Time - Clearer Layout */}
                <div className="space-y-3">
                    <label className="block text-sm font-bold text-white">
                        <Calendar className="w-4 h-4 inline mr-2" />
                        When?
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Date</label>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Time</label>
                            <input
                                type="time"
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base"
                                required
                            />
                        </div>
                    </div>
                    {!isAdmin && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-200">
                            ⏰ Book at least 3 hours in advance
                        </div>
                    )}
                </div>

                {/* Participants - Simplified */}
                <div>
                    <label className="block text-sm font-bold text-white mb-2">
                        <UserIcon className="w-4 h-4 inline mr-2" />
                        {isAdmin ? 'Select Participants' : 'Book With'}
                    </label>

                    {isAdmin ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto bg-slate-800/50 border-2 border-slate-700 rounded-lg p-3">
                            {profiles.map(p => (
                                <label key={p.id} className="flex items-center gap-3 p-2 hover:bg-slate-700/50 rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={attendees.includes(p.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setAttendees([...attendees, p.id]);
                                            } else {
                                                setAttendees(attendees.filter(id => id !== p.id));
                                            }
                                        }}
                                        className="w-4 h-4 rounded bg-slate-700 border-slate-600"
                                    />
                                    <span className="text-white text-sm">{p.name}</span>
                                    <span className="text-slate-400 text-xs">({p.email})</span>
                                </label>
                            ))}
                        </div>
                    ) : (
                        <select
                            value={attendees[0] || ''}
                            onChange={(e) => setAttendees([e.target.value])}
                            className="w-full px-4 py-3 bg-slate-800 border-2 border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base"
                        >
                            <option value="">Choose an admin...</option>
                            {profiles.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Advanced Settings */}
                {isAdmin && (
                    <div className="border-t border-slate-800 pt-4">
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="flex items-center gap-2 text-sm text-teal-400 hover:text-teal-300 mb-3"
                        >
                            <Settings className="w-4 h-4" />
                            {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
                        </button>

                        {showAdvanced && (
                            <div className="space-y-4 pl-6 border-l-2 border-teal-500/20">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Max Participants
                                    </label>
                                    <input
                                        type="number"
                                        value={maxParticipants}
                                        onChange={(e) => setMaxParticipants(parseInt(e.target.value) || 10)}
                                        min="2"
                                        max="50"
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Cancellation Policy (hours before meeting)
                                    </label>
                                    <input
                                        type="number"
                                        value={cancellationPolicyHours}
                                        onChange={(e) => setCancellationPolicyHours(parseInt(e.target.value) || 3)}
                                        min="0"
                                        max="72"
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-teal-500"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">
                                        Clients can cancel up to this many hours before the meeting
                                    </p>
                                </div>

                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="recordingEnabled"
                                        checked={recordingEnabled}
                                        onChange={(e) => setRecordingEnabled(e.target.checked)}
                                        className="w-4 h-4 rounded bg-slate-800 border-slate-700"
                                    />
                                    <label htmlFor="recordingEnabled" className="text-sm text-slate-300">
                                        Enable Recording
                                    </label>
                                </div>

                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="allowClientCancellation"
                                        checked={allowClientCancellation}
                                        onChange={(e) => setAllowClientCancellation(e.target.checked)}
                                        className="w-4 h-4 rounded bg-slate-800 border-slate-700"
                                    />
                                    <label htmlFor="allowClientCancellation" className="text-sm text-slate-300">
                                        <Shield className="w-4 h-4 inline mr-1" />
                                        Allow Client Cancellation
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-5 border-t-2 border-slate-800">
                    <Button variant="ghost" onClick={onClose} disabled={loading} className="px-6">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading || !title || !date || !time}
                        className="bg-teal-600 hover:bg-teal-500 px-8 py-3 text-base font-semibold"
                    >
                        {loading ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                {isAdmin ? 'Scheduling...' : 'Booking...'}
                            </>
                        ) : (
                            <>
                                {isAdmin ? 'Schedule Meeting' : 'Book Appointment'}
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default ScheduleMeetingModal;
