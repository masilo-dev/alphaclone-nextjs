'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Mic, X, Check, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface VoiceCaptureFABProps {
    onCapture: (text: string) => void;
}

const VoiceCaptureFAB: React.FC<VoiceCaptureFABProps> = ({ onCapture }) => {
    const [isActive, setIsActive] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const pulseRef = useRef<number>(0);

    const toggleVoice = () => {
        if (!isActive) {
            setIsActive(true);
            startListening();
        } else {
            stopListening();
        }
    };

    const startListening = () => {
        setIsListening(true);
        setTranscript('');
        // Real API would use Web Speech API or Deepgram
        // Simulation for high-performance demo
        if ('vibrate' in navigator) navigator.vibrate(20);

        const phases = [
            "Initializing neural sync...",
            "Listening for operational parameters...",
            "Analyzing vocal signature..."
        ];

        let i = 0;
        const interval = setInterval(() => {
            if (i < phases.length) {
                setTranscript(phases[i]);
                i++;
            } else {
                clearInterval(interval);
                // Final simulated result based on project context
                setTranscript("Finalize the Q3 cloud migration audit by Friday...");
            }
        }, 800);

        pulseRef.current = window.setTimeout(() => {
            stopListening();
        }, 4000);
    };

    const stopListening = () => {
        setIsListening(false);
        setIsProcessing(true);
        if ('vibrate' in navigator) navigator.vibrate([10, 50]);

        setTimeout(() => {
            setIsProcessing(false);
        }, 1500);
    };

    const handleConfirm = () => {
        onCapture(transcript);
        setIsActive(false);
        setTranscript('');
        toast.success("Intelligence Captured");
    };

    if (!isActive) {
        return (
            <button
                onClick={toggleVoice}
                className="lg:hidden fixed bottom-6 left-6 z-50 w-14 h-14 bg-slate-900 border border-teal-500/50 text-teal-400 rounded-full shadow-2xl shadow-teal-500/20 flex items-center justify-center active:scale-95 transition-transform group"
            >
                <Mic className="w-6 h-6 group-hover:scale-110 transition-transform" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse border-2 border-slate-900"></div>
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-end justify-center pb-24 px-4 sm:items-center sm:pb-0">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setIsActive(false)} />

            <div className="relative w-full max-w-sm bg-slate-950 border border-teal-500/30 rounded-[2.5rem] p-8 shadow-[0_0_100px_-20px_rgba(20,184,166,0.5)] overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-teal-500 to-transparent animate-shimmer" />

                <div className="flex flex-col items-center text-center space-y-6">
                    <div className="relative">
                        <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${isListening ? 'bg-teal-500 shadow-[0_0_40px_rgba(20,184,166,0.6)] scale-110' : 'bg-slate-900 border border-white/10'
                            }`}>
                            {isListening ? (
                                <div className="absolute inset-0 rounded-full border-4 border-teal-400 animate-ping opacity-20"></div>
                            ) : null}
                            {isProcessing ? (
                                <Loader2 className="w-10 h-10 text-teal-400 animate-spin" />
                            ) : (
                                <Mic className={`w-10 h-10 ${isListening ? 'text-white' : 'text-slate-500'}`} />
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em]">
                            {isListening ? 'Neural Link Active' : isProcessing ? 'Processing Intel' : 'Capture Verified'}
                        </h3>
                        <p className={`text-lg font-bold min-h-[3rem] transition-all duration-300 ${isListening ? 'text-teal-400/70 italic' : 'text-white'}`}>
                            {transcript || 'Awaiting synchronization...'}
                        </p>
                    </div>

                    <div className="flex items-center gap-4 w-full">
                        <button
                            onClick={() => setIsActive(false)}
                            className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                        >
                            Abort
                        </button>
                        {!isListening && !isProcessing && transcript && (
                            <button
                                onClick={handleConfirm}
                                className="flex-1 py-4 bg-gradient-to-r from-teal-600 to-teal-400 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-teal-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <Check className="w-4 h-4" /> Initialize
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center gap-2 overflow-hidden">
                    <Sparkles className="w-3 h-3 text-teal-500/50" />
                    <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.4em]">Advanced Vocal Recognition v4.2</span>
                </div>
            </div>
        </div>
    );
};

export default VoiceCaptureFAB;
