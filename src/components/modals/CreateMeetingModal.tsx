import React, { useState } from 'react';
import { X, Calendar, Clock, User, Mail, Video, Loader2 } from 'lucide-react';
import { meetingService, CreateMeetingData } from '../../../services/meetingService';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { dailyService } from '../../../services/dailyService';

interface CreateMeetingModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export const CreateMeetingModal: React.FC<CreateMeetingModalProps> = ({ onClose, onSuccess }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        attendeeName: '',
        attendeeEmail: '',
        date: '',
        time: '',
        duration: 30
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);

        try {
            // 1. Create Daily.co room
            const startTime = new Date(`${formData.date}T${formData.time}`);
            const { room, error: roomError } = await dailyService.createRoom(startTime.getTime() / 1000 + 3600); // Expires in 1 hour after start? Or logic inside service

            if (roomError || !room) {
                throw new Error('Failed to create video room');
            }

            // 2. Prepare meeting data
            const meetingData: CreateMeetingData = {
                hostId: user.id,
                hostName: user.name,
                hostEmail: user.email,
                attendeeName: formData.attendeeName,
                attendeeEmail: formData.attendeeEmail,
                title: formData.title,
                description: formData.description,
                startTime: startTime.toISOString(),
                duration: formData.duration,
                dailyRoomUrl: room.url
            };

            // 3. Create meeting & send confirmation (log email)
            const result = await meetingService.createMeetingWithConfirmation(meetingData);

            if (!result.success) {
                throw result.error;
            }

            toast.success('Meeting scheduled & invitation sent!');
            onSuccess();
            onClose();

        } catch (error) {
            console.error('Failed to create meeting:', error);
            toast.error('Failed to schedule meeting');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-slate-800">
                    <h2 className="text-xl font-semibold text-white">Schedule Video Meeting</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Meeting Title</label>
                        <input
                            required
                            type="text"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500 transition-colors"
                            placeholder="e.g. Project Review"
                        />
                    </div>

                    {/* Attendee Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Attendee Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                                <input
                                    required
                                    type="text"
                                    value={formData.attendeeName}
                                    onChange={e => setFormData({ ...formData, attendeeName: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-teal-500 transition-colors"
                                    placeholder="John Doe"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Attendee Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                                <input
                                    required
                                    type="email"
                                    value={formData.attendeeEmail}
                                    onChange={e => setFormData({ ...formData, attendeeEmail: e.target.value })}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-teal-500 transition-colors"
                                    placeholder="john@example.com"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Date & Time */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Date</label>
                            <input
                                required
                                type="date"
                                value={formData.date}
                                onChange={e => setFormData({ ...formData, date: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500 transition-colors"
                                min={new Date().toISOString().split('T')[0]}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Time</label>
                            <input
                                required
                                type="time"
                                value={formData.time}
                                onChange={e => setFormData({ ...formData, time: e.target.value })}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Duration */}
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Duration</label>
                        <select
                            value={formData.duration}
                            onChange={e => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500 transition-colors"
                        >
                            <option value={15}>15 minutes</option>
                            <option value={30}>30 minutes</option>
                            <option value={45}>45 minutes</option>
                            <option value={60}>1 hour</option>
                        </select>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-1">Description (Optional)</label>
                        <textarea
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500 transition-colors resize-none h-20"
                            placeholder="Meeting agenda..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-slate-800 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors font-medium border border-slate-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Scheduling...
                                </>
                            ) : (
                                <>
                                    <Video className="w-4 h-4" />
                                    Schedule Meeting
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
