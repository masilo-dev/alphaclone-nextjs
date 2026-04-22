'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, ChevronDown, ChevronUp, ExternalLink, Server, Bot } from 'lucide-react';
import { Button } from '../../ui/UIComponents';

type Step = { n: number; title: string; body: string };

const ZOOM_STEPS: Step[] = [
  {
    n: 1,
    title: 'Choose how Zoom should appear',
    body:
      'For a fully custom in-app video layout, plan on the Zoom Video SDK (see Zoom documentation). To ship faster with standard Zoom meeting UI, use the Meeting SDK or Meeting API with join links.',
  },
  {
    n: 2,
    title: 'Create a Zoom app in the developer portal',
    body:
      'Register a Server-to-Server OAuth app or OAuth app as required by your integration path. Keep the client secret only on the server or in Supabase Vault.',
  },
  {
    n: 3,
    title: 'Implement OAuth and meeting creation',
    body:
      'Add server routes to complete OAuth and to create meetings or Video SDK sessions. Persist join metadata on video_calls (video_provider, zoom join URLs, session name). Host start URLs must never be exposed to guests.',
  },
  {
    n: 4,
    title: 'Wire the join page',
    body:
      'Extend the existing /meet token flow so the server can return either Daily credentials or Zoom session details, depending on video_provider.',
  },
  {
    n: 5,
    title: 'Validate end-to-end',
    body:
      'Create a test meeting from the dashboard, join as host and as guest, and confirm recordings and quotas match your plan.',
  },
];

const MCP_STEPS: Step[] = [
  {
    n: 1,
    title: 'Connect from Settings or Marketplace',
    body:
      'Under Settings, Integrations, choose Claude Desktop (MCP) or Manus AI (MCP) and open the setup guide. Complete the DPA if prompted, copy your connection URL, and add it in Claude Desktop or Manus. Status shows Connected when an MCP API key exists for your workspace.',
  },
  {
    n: 2,
    title: 'Expose a secure MCP server',
    body:
      'Implement HTTP endpoints and tools with strict tenant checks. Issue tokens only after user consent; store refresh tokens server-side.',
  },
  {
    n: 3,
    title: 'Configure the external client',
    body:
      'In Claude Desktop or Manus, point the MCP configuration at your HTTPS endpoint and register redirect URLs that match your OAuth implementation.',
  },
];

export function VideoMeetingsAndMcpSetup() {
  const [openZoom, setOpenZoom] = useState(true);
  const [openMcp, setOpenMcp] = useState(false);
  const [openDaily, setOpenDaily] = useState(true);

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/80 flex items-center gap-2">
        <Video className="w-5 h-5 text-teal-400" />
        <div>
          <h2 className="text-sm font-semibold text-white">Video meetings and MCP</h2>
          <p className="text-xs text-slate-500">
            Setup order for admins. Built-in Daily video remains the default until Zoom is fully connected.
          </p>
        </div>
      </div>

      <div className="divide-y divide-slate-800">
        <button
          type="button"
          onClick={() => setOpenDaily((v) => !v)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
        >
          <span className="text-sm font-medium text-slate-200">Built-in video (Daily.co)</span>
          {openDaily ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </button>
        <AnimatePresence initial={false}>
          {openDaily && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 text-xs text-slate-400 space-y-2 leading-relaxed">
                <p>
                  Production meetings today use Daily.co rooms created by the server and joined through your branded
                  links. No extra configuration is required here beyond the Daily API key in deployment environment
                  variables.
                </p>
                <p className="text-slate-500">
                  Technical reference: <code className="text-slate-400">src/VIDEO_ARCHITECTURE.md</code>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setOpenZoom((v) => !v)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
        >
          <span className="text-sm font-medium text-slate-200">Zoom (Meeting API or Video SDK)</span>
          {openZoom ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </button>
        <AnimatePresence initial={false}>
          {openZoom && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3">
                <ol className="space-y-3">
                  {ZOOM_STEPS.map((s) => (
                    <li key={s.n} className="flex gap-3 text-xs text-slate-400 leading-relaxed">
                      <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-teal-500/15 border border-teal-500/25 text-teal-400 font-bold flex items-center justify-center text-[10px]">
                        {s.n}
                      </span>
                      <div>
                        <p className="text-slate-200 font-medium mb-0.5">{s.title}</p>
                        <p>{s.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => window.open('https://developers.zoom.us/docs/video-sdk/', '_blank', 'noopener,noreferrer')}
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                    Zoom Video SDK docs
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() =>
                      window.open('https://developers.zoom.us/docs/meeting-sdk/', '_blank', 'noopener,noreferrer')
                    }
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1" />
                    Meeting SDK docs
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Repository guide (engineers): <code className="text-slate-400">src/docs/MCP_AND_ZOOM_INTEGRATION.md</code>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setOpenMcp((v) => !v)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
        >
          <span className="text-sm font-medium text-slate-200 flex items-center gap-2">
            <Bot className="w-4 h-4 text-violet-400" />
            Claude and Manus (MCP)
          </span>
          {openMcp ? (
            <ChevronUp className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          )}
        </button>
        <AnimatePresence initial={false}>
          {openMcp && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3">
                <div className="flex items-start gap-2 text-xs text-teal-400/90 bg-teal-500/10 border border-teal-500/20 rounded-lg p-3">
                  <Server className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>
                    The MCP HTTP endpoint is <code className="text-slate-300">/api/mcp/sse?api_key=...</code> (the setup
                    guide copies the full URL; workspace is resolved from the key). OAuth dynamic clients can use{' '}
                    <code className="text-slate-300">/.well-known/oauth-authorization-server</code> and{' '}
                    <code className="text-slate-300">/api/oauth/token</code> per your deployment docs.
                  </p>
                </div>
                <ol className="space-y-3">
                  {MCP_STEPS.map((s) => (
                    <li key={s.n} className="flex gap-3 text-xs text-slate-400 leading-relaxed">
                      <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-violet-500/15 border border-violet-500/25 text-violet-300 font-bold flex items-center justify-center text-[10px]">
                        {s.n}
                      </span>
                      <div>
                        <p className="text-slate-200 font-medium mb-0.5">{s.title}</p>
                        <p>{s.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
