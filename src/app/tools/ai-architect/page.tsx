'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Input, Card, Badge } from '@/components/ui/UIComponents';
import { Zap, Shield, Database, Layout, Sparkles, ArrowRight, CheckCircle2, Building2, User } from 'lucide-react';
import { aiArchitectService, ArchitectSpecs } from '@/services/ai/aiArchitectService';
import Link from 'next/link';

export default function AIArchitectPage() {
  const [step, setStep] = useState<'form' | 'loading' | 'blueprint'>('form');
  const [formData, setFormData] = useState({
    businessName: '',
    businessType: 'Agency',
    goals: ''
  });
  const [blueprint, setBlueprint] = useState<ArchitectSpecs | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep('loading');
    
    // Simulate generation for premium feel or call service
    const specs = await aiArchitectService.generateSpecs(
      formData.businessName,
      formData.businessType,
      formData.goals
    );
    
    setBlueprint(specs);
    setStep('blueprint');
  };

  return (
    <div className="min-h-screen bg-[#020D1A] text-slate-200 selection:bg-teal-500/30">
      {/* Cinematic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-teal-500/5 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-600/5 blur-[120px]" />
      </div>

      <nav className="relative z-50 border-b border-slate-800/50 bg-[#020D1A]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-black tracking-tighter text-white">ALPHACLONE</span>
          </Link>
          <Link href="/auth/login" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
            Sign In
          </Link>
        </div>
      </nav>

      <main className="relative z-10 max-w-4xl mx-auto px-4 py-20">
        <AnimatePresence mode="wait">
          {step === 'form' && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-12"
            >
              <div className="text-center space-y-4">
                <Badge variant="blue" className="px-4 py-1.5 mb-4">SYSTEM DESIGNER V1.0</Badge>
                <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white leading-tight">
                  ARCHITECT YOUR <span className="text-teal-400">UNIFIED OS</span>
                </h1>
                <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                  Describe your workflow. Our AI will build an enterprise-grade infrastructure blueprint tailored to your exact scale.
                </p>
              </div>

              <Card className="p-8 border-slate-700/50 bg-slate-900/40 backdrop-blur-2xl shadow-2xl">
                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Input
                      label="Business Name"
                      placeholder="e.g. Nexus Digital"
                      value={formData.businessName}
                      onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                      required
                    />
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-slate-300">Target Persona</label>
                      <div className="flex gap-4">
                        {['Freelancer', 'Agency', 'Startup'].map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setFormData({ ...formData, businessType: type })}
                            className={`flex-1 py-3 rounded-xl border transition-all flex items-center justify-center gap-2 text-sm font-bold ${
                              formData.businessType === type
                                ? 'bg-teal-500 border-teal-500 text-slate-950 shadow-lg shadow-teal-500/20'
                                : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-600'
                            }`}
                          >
                            {type === 'Freelancer' ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Input
                    label="What are your core growth bottlenecks?"
                    textarea
                    placeholder="e.g. Too much tool-hopping, lead follow-up is slow, invoicing is manual..."
                    value={formData.goals}
                    onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
                    required
                  />

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-black tracking-tight h-16 text-xl shadow-xl shadow-teal-500/20"
                  >
                    GENERATE BLUEPRINT <ArrowRight className="ml-2 w-6 h-6" />
                  </Button>
                </form>
              </Card>
            </motion.div>
          )}

          {step === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-[60vh] flex flex-col items-center justify-center space-y-8"
            >
              <div className="relative">
                <div className="w-24 h-24 border-4 border-teal-500/20 rounded-full animate-spin border-t-teal-500" />
                <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-teal-400 animate-pulse" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-white tracking-tight">ARCHITECTING SYSTEMS...</h2>
                <p className="text-slate-500 font-mono text-sm animate-pulse">ALPHACLONE CORE ENGINE INITIALIZING • MAPPING WORKFLOWS</p>
              </div>
            </motion.div>
          )}

          {step === 'blueprint' && blueprint && (
            <motion.div
              key="blueprint"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-12"
            >
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm font-bold mb-4">
                  <CheckCircle2 className="w-4 h-4" /> BLUEPRINT READY
                </div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white">
                  SYSTEM BLUEPRINT: <span className="text-teal-400 uppercase">{blueprint.businessName}</span>
                </h1>
                <p className="text-lg text-slate-400 font-medium">Recommended Complexity: <span className="text-white uppercase font-black">{blueprint.complexity}</span></p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6 space-y-4 border-teal-500/10">
                  <div className="flex items-center gap-3 text-teal-400">
                    <Database className="w-6 h-6" />
                    <h3 className="font-black tracking-tight">UNIFIED CRM</h3>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">{blueprint.blueprint.crm}</p>
                </Card>

                <Card className="p-6 space-y-4 border-blue-500/10">
                  <div className="flex items-center gap-3 text-blue-400">
                    <Zap className="w-6 h-6" />
                    <h3 className="font-black tracking-tight">AI SALES AGENTS</h3>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">{blueprint.blueprint.aiAgents}</p>
                </Card>

                <Card className="p-6 space-y-4 border-indigo-500/10">
                  <div className="flex items-center gap-3 text-indigo-400">
                    <Layout className="w-6 h-6" />
                    <h3 className="font-black tracking-tight">AUTOMATIONS</h3>
                  </div>
                  <ul className="space-y-3">
                    {blueprint.blueprint.automations.map((a, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card className="p-6 space-y-4 border-slate-700">
                  <div className="flex items-center gap-3 text-slate-200">
                    <Shield className="w-6 h-6" />
                    <h3 className="font-black tracking-tight">SECURE BILLING</h3>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">{blueprint.blueprint.billing}</p>
                </Card>
              </div>

              <div className="bg-gradient-to-br from-teal-500/20 to-blue-600/20 border border-teal-500/30 rounded-[2rem] p-10 text-center space-y-8 backdrop-blur-3xl shadow-2xl relative overflow-hidden">
                <div className="relative z-10 space-y-6">
                  <h2 className="text-3xl font-black text-white tracking-tight">{blueprint.conversionHook}</h2>
                  <p className="text-slate-400 max-w-xl mx-auto">
                    We've mapped your entire {blueprint.complexity} infrastructure. Click below to launch this system in your own private AlphaClone instance.
                  </p>
                  <Button
                    size="lg"
                    onClick={() => {
                      const params = new URLSearchParams({
                        register: 'true',
                        type: formData.businessType.toLowerCase(),
                        businessName: formData.businessName,
                        plan: blueprint.complexity
                      });
                      window.location.href = `/auth/login?${params.toString()}`;
                    }}
                    className="bg-white hover:bg-slate-100 text-[#020D1A] font-black h-16 px-12 text-xl"
                  >
                    DEPLOY SYSTEM NOW <ArrowRight className="ml-2 w-6 h-6" />
                  </Button>
                </div>
                {/* Visual decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 blur-[100px] -z-0" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 blur-[100px] -z-0" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
