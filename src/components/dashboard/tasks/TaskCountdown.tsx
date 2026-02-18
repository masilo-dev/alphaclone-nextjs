'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Clock, AlertCircle } from 'lucide-react';

interface TaskCountdownProps {
    dueDate: string;
    onOverdue?: () => void;
    showAlarm?: boolean;
}

export const TaskCountdown: React.FC<TaskCountdownProps> = ({
    dueDate,
    onOverdue,
    showAlarm = true
}) => {
    const [timeLeft, setTimeLeft] = useState<{
        days: number;
        hours: number;
        minutes: number;
        seconds: number;
        isOverdue: boolean;
    }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isOverdue: false });

    const alarmRef = useRef<HTMLAudioElement | null>(null);
    const hasFiredOverdue = useRef(false);

    useEffect(() => {
        const calculateTimeLeft = () => {
            const target = new Date(dueDate).getTime();
            const now = new Date().getTime();
            const difference = target - now;

            if (difference <= 0) {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isOverdue: true });
                if (!hasFiredOverdue.current) {
                    hasFiredOverdue.current = true;
                    onOverdue?.();
                    if (showAlarm) {
                        playAlarm();
                    }
                }
                return;
            }

            setTimeLeft({
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60),
                isOverdue: false
            });
        };

        const playAlarm = () => {
            if (!alarmRef.current) {
                alarmRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                alarmRef.current.volume = 0.4;
            }
            alarmRef.current.play().catch(err => console.error("Audio play failed:", err));
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 1000);

        return () => clearInterval(timer);
    }, [dueDate, onOverdue, showAlarm]);

    if (timeLeft.isOverdue) {
        return (
            <div className="flex items-center gap-1.5 text-red-400 animate-pulse font-mono text-[10px] font-black uppercase tracking-wider bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                <AlertCircle className="w-3 h-3" />
                Overdue
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5 text-teal-400 font-mono text-[10px] font-black uppercase tracking-wider bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
            <Clock className="w-3 h-3" />
            {timeLeft.days > 0 && `${timeLeft.days}d `}
            {timeLeft.hours.toString().padStart(2, '0')}:
            {timeLeft.minutes.toString().padStart(2, '0')}:
            {timeLeft.seconds.toString().padStart(2, '0')}
        </div>
    );
};
