'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Maximize2, Volume2, Shield, Zap, Globe, Cpu } from 'lucide-react';

const VideoExplainer = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const videoRef = React.useRef<HTMLVideoElement>(null);

    const handlePlay = () => {
        setIsPlaying(true);
        if (videoRef.current) {
            videoRef.current.play();
        }
    };

    return (
        <section id="ecosystem" className="py-24 bg-slate-950/50 relative overflow-hidden hidden lg:block">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] bg-blue-500/5 blur-[120px] -z-10 rounded-full" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Introduction to AlphaClone Systems</h2>
                    <p className="text-slate-400 text-lg max-w-2xl mx-auto font-medium">
                        The 10-minute walkthrough of the world&apos;s most advanced Multi-Tenant Business OS.
                        Experience how we unify CRM, Projects, AI, and Security into one platform.
                    </p>
                </div>

                <div className="relative max-w-5xl mx-auto group">
                    {/* Video Frame */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="relative aspect-video bg-slate-900 rounded-[2rem] overflow-hidden border border-slate-800 shadow-2xl shadow-blue-500/10"
                    >
                        {/* Video Element */}
                        <video
                            ref={videoRef}
                            className={`w-full h-full object-cover transition-opacity duration-500 ${isPlaying ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
                            controls={isPlaying}
                            src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"
                            poster="/dashboard-preview.jpg"
                        >
                            Your browser does not support the video tag.
                        </video>

                        {/* Mock Video Placeholder (Cover) */}
                        {!isPlaying && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-900 group-hover:bg-slate-800/50 transition-colors cursor-pointer z-10" onClick={handlePlay}>
                                <div className="relative">
                                    <motion.div
                                        animate={{ scale: [1, 1.1, 1] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                        className="w-24 h-24 bg-teal-500 rounded-full flex items-center justify-center shadow-2xl shadow-teal-500/40 relative z-10"
                                    >
                                        <Play className="w-10 h-10 text-slate-950 fill-slate-950 ml-1" />
                                    </motion.div>
                                    <div className="absolute -inset-8 bg-teal-500/20 rounded-full blur-2xl font-bold text-white" />
                                </div>

                                {/* Video Preview Overlay */}
                                <div className="absolute inset-x-0 bottom-0 p-12 bg-gradient-to-t from-slate-950 to-transparent">
                                    <div className="flex justify-between items-end">
                                        <div className="space-y-4">
                                            <div className="flex gap-2">
                                                <span className="px-3 py-1 bg-teal-500/20 text-teal-400 text-[10px] font-bold rounded-full uppercase tracking-tighter border border-teal-500/30">Official Introduction</span>
                                                <span className="px-3 py-1 bg-white/5 text-white/50 text-[10px] font-bold rounded-full uppercase tracking-tighter border border-white/10">Full Platform Tour</span>
                                            </div>
                                            <h3 className="text-2xl font-bold text-white">AlphaClone Systems: The Unified Operating System</h3>
                                        </div>
                                        <div className="text-slate-500 text-sm font-mono">10:00</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Glass Player Controls (Visual only, hidden when playing) */}
                        {!isPlaying && (
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] h-14 bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center px-6 justify-between opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                                <div className="flex items-center gap-6">
                                    <Play className="w-5 h-5 text-white" />
                                    <Volume2 className="w-5 h-5 text-white" />
                                    <div className="text-white text-xs font-mono">00:00 / 10:00</div>
                                </div>
                                <div className="flex-1 max-w-sm h-1 bg-white/10 rounded-full mx-8">
                                    <div className="w-1/3 h-full bg-teal-500 rounded-full shadow-[0_0_10px_rgba(20,184,166,0.5)]" />
                                </div>
                                <Maximize2 className="w-5 h-5 text-white" />
                            </div>
                        )}
                    </motion.div>

                    {/* Floating Context Cards */}
                    <motion.div
                        style={{ y: -20 }}
                        whileHover={{ y: -30 }}
                        className="absolute -right-8 top-1/4 w-64 bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 p-6 rounded-2xl shadow-2xl z-20 hidden lg:block"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-teal-500/10 rounded-xl flex items-center justify-center">
                                <Zap className="w-5 h-5 text-teal-400" />
                            </div>
                            <div>
                                <div className="text-white font-bold text-sm">High Performance</div>
                                <div className="text-[10px] text-slate-500 font-bold uppercase">Optimized Turbo Build</div>
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed italic">
                            "AlphaClone brought our team efficiency up by 67% in the first quarter."
                        </p>
                    </motion.div>

                    <motion.div
                        style={{ y: 20 }}
                        whileHover={{ y: 10 }}
                        className="absolute -left-8 bottom-1/4 w-60 bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 p-6 rounded-2xl shadow-2xl z-20 hidden lg:block"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                                <Shield className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <div className="text-white font-bold text-sm">Enterprise Grade</div>
                                <div className="text-[10px] text-slate-500 font-bold uppercase">End-to-End Encryption</div>
                            </div>
                        </div>
                        <div className="flex gap-1.5 mt-2">
                            <div className="flex-1 h-1.5 bg-blue-500/20 rounded-full overflow-hidden">
                                <div className="w-3/4 h-full bg-blue-500" />
                            </div>
                            <div className="text-[9px] text-blue-400 font-bold">READY</div>
                        </div>
                    </motion.div>
                </div>

                {/* Platform Highlights */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-24">
                    {[
                        { label: "Omnichannel CRM", value: "Integrated" },
                        { label: "AI Sales Agents", value: "Autopilot" },
                        { label: "Financial Engine", value: "Automated" },
                        { label: "Project Command", value: "Unified" }
                    ].map((item, i) => (
                        <div key={i} className="text-center group">
                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1 group-hover:text-teal-500 transition-colors">
                                {item.label}
                            </div>
                            <div className="text-2xl font-bold text-white">{item.value}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default VideoExplainer;
