'use client';

import React, { useState } from 'react';
import { Shield, CheckCircle, FileText, AlertCircle, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { MCPAuthService } from '@/services/mcp/MCPAuthService';
import toast from 'react-hot-toast';

interface EnterpriseDPAProps {
  tenantId: string;
  userId: string;
  onAccepted: () => void;
}

const EnterpriseDPA: React.FC<EnterpriseDPAProps> = ({ tenantId, userId, onAccepted }) => {
  const [isAccepting, setIsAccepting] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);

  const handleAccept = async () => {
    if (!hasAgreed) {
      toast.error('Please agree to the terms before continuing.');
      return;
    }

    setIsAccepting(true);
    try {
      const { success, error } = await MCPAuthService.recordDPAAcceptance(tenantId, userId);
      if (success) {
        toast.success('DPA Accepted Successfully');
        onAccepted();
      } else {
        toast.error(error || 'Failed to record acceptance');
      }
    } catch (err) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden max-w-2xl mx-auto shadow-2xl">
      <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-indigo-500/10 to-teal-500/10">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-6 h-6 text-teal-400" />
          <h2 className="text-xl font-bold text-white">Enterprise Data Processing Agreement</h2>
        </div>
        <p className="text-slate-400 text-sm">Required for all Enterprise-tier AI integrations.</p>
      </div>

      <div className="p-6">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 h-64 overflow-y-auto mb-6 text-slate-300 text-xs leading-relaxed space-y-4 custom-scrollbar">
          <h3 className="text-white font-bold text-sm underline">1. Subject Matter and Duration</h3>
          <p>
            This Data Processing Agreement ("DPA") applies to the processing of personal data by AlphaClone (the "Processor") on behalf of the customer (the "Controller") in connection with the Model Context Protocol (MCP) and external AI Agent integrations.
          </p>
          
          <h3 className="text-white font-bold text-sm underline">2. Nature and Purpose of Processing</h3>
          <p>
            The Processor will process data for the purpose of providing CRM automation, lead management, and project tracking via AI agents as requested by the Controller. This includes reading CRM records and inserting new operational data.
          </p>

          <h3 className="text-white font-bold text-sm underline">3. Technical and Organizational Measures</h3>
          <p>
            The Processor implements robust security measures, including multi-tenant isolation, encrypted storage, and restricted AI access permissions (No-Delete policy). All AI actions are audited and visible in the Controller's activity feed.
          </p>

          <h3 className="text-white font-bold text-sm underline">4. AI Agent Liability</h3>
          <p>
            The Controller acknowledges that connecting external AI agents (e.g., Claude, Manus) involves a "User-in-the-loop" model. The Controller is responsible for the actions initiated by the AI agents configured via the Controller's unique connection keys.
          </p>

          <h3 className="text-white font-bold text-sm underline">5. Data Deletion</h3>
          <p>
            Upon termination of the service, the Processor shall delete all personal data processed on behalf of the Controller, unless required by law to retain such data.
          </p>
        </div>

        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex items-center mt-0.5">
              <input
                type="checkbox"
                className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-700 bg-slate-900 transition-all checked:bg-teal-500"
                checked={hasAgreed}
                onChange={(e) => setHasAgreed(e.target.checked)}
              />
              <CheckCircle className="absolute h-3.5 w-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100 left-0.5" />
            </div>
            <span className="text-slate-300 text-sm select-none group-hover:text-white transition-colors">
              I represent that I have the authority to bind the organization and I agree to the terms of the Enterprise Data Processing Agreement (DPA v1.0).
            </span>
          </label>

          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={handleAccept}
              disabled={!hasAgreed || isAccepting}
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
                hasAgreed && !isAccepting
                  ? 'bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-900/20'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isAccepting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Accept & Activate Integration
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-4 bg-slate-950/50 border-t border-slate-800 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-amber-400" />
        <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">
          Acceptance will be cryptographically logged for compliance.
        </p>
      </div>
    </div>
  );
};

export default EnterpriseDPA;

