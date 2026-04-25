
"use client";

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Send, Bot, X, Sparkles, Loader2, BrainCircuit, Globe, MapPin, Image as ImageIcon, Zap, Mail, ExternalLink } from 'lucide-react';
import { chatWithAI } from '../services/unifiedAIService';
import { ChatMessage, EmailDraft } from '../types';
import { supabase } from '../lib/supabase';
import dynamic from 'next/dynamic';

const ComposeEmailModal = dynamic(
  () => import('./dashboard/business/ComposeEmailModal'),
  { ssr: false }
);

interface AIAssistantProps {
  embedded?: boolean;
}

type AI_MODE = 'default' | 'thinking' | 'search' | 'maps' | 'fast' | 'email';

const EMAIL_SYSTEM_PROMPT = `You are an expert email writing assistant. The user wants you to draft a professional email.
Respond ONLY with a valid JSON object — no markdown, no code fences, no explanation — using this exact structure:
{"to":"<recipient email address if stated, otherwise empty string>","subject":"<concise professional subject line>","body":"<complete email body, plain text only, no asterisks, no bullet dashes, no markdown formatting>"}`;

const EMAIL_INTENT_RE = /\b(write|draft|compose|send|create|prepare)\b.{0,40}\b(email|e-mail|outreach|follow.?up)\b/i;

function parseEmailDraft(raw: string): EmailDraft | null {
  try {
    // Strip markdown code fences if the model wrapped the JSON
    const cleaned = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    if (typeof parsed.subject === 'string' && typeof parsed.body === 'string') {
      return {
        to: typeof parsed.to === 'string' ? parsed.to : '',
        subject: parsed.subject,
        body: parsed.body,
      };
    }
  } catch {
    // Not a JSON email draft — treat as plain text
  }
  return null;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ embedded = false }) => {
  const [isOpen, setIsOpen] = useState(embedded);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'model',
      text: "Hello, I'm Alpha. I'm powered by advanced AI (Claude & GPT-4). How can I assist you?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<AI_MODE>('default');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [composeDraft, setComposeDraft] = useState<EmailDraft | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then((result) => {
      if (result.data.user) setUserId(result.data.user.id);
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    const currentImage = selectedImage;
    setSelectedImage(null);
    setIsLoading(true);

    const isEmailRequest = mode === 'email' || EMAIL_INTENT_RE.test(userMsg.text);

    let modelMatch: string | undefined;
    switch (mode) {
      case 'thinking':
        modelMatch = 'gpt-4-turbo';
        break;
      case 'fast':
        modelMatch = 'gpt-4o-mini';
        break;
      case 'search':
      case 'maps':
        modelMatch = 'gpt-4-turbo';
        break;
      default:
        modelMatch = undefined;
    }

    try {
      const response = await chatWithAI(
        messages.map(m => ({ role: m.role, text: m.text })),
        userMsg.text,
        currentImage || undefined,
        modelMatch,
        isEmailRequest ? EMAIL_SYSTEM_PROMPT : undefined
      );

      let text = response.text;
      let emailDraft: EmailDraft | undefined;

      if (isEmailRequest) {
        const draft = parseEmailDraft(text);
        if (draft) {
          emailDraft = draft;
          text = `Email drafted. Subject: "${draft.subject}"`;
        }
      }

      // Append grounding sources if present
      const groundingData = (response as any).grounding;
      if (!emailDraft && groundingData && Array.isArray(groundingData)) {
        interface GroundingChunk {
          web?: { uri?: string; title?: string };
          maps?: { uri?: string; title?: string };
        }
        const links = groundingData
          .map((chunk: GroundingChunk) => {
            if (chunk.web?.uri) return `[${chunk.web.title}](${chunk.web.uri})`;
            if (chunk.maps?.uri) return `[${chunk.maps.title || 'Map Location'}](${chunk.maps.uri})`;
            return null;
          })
          .filter(Boolean)
          .join('\n');
        if (links) text += `\n\nSources:\n${links}`;
      }

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text,
        timestamp: new Date(),
        ...(emailDraft ? { emailDraft } : {}),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'model',
          text: 'I encountered an error processing your request.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleOpen = () => !embedded && setIsOpen(!isOpen);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen && !embedded) {
    return (
      <button
        onClick={toggleOpen}
        className="fixed bottom-6 right-6 p-4 bg-teal-600 hover:bg-teal-500 text-white rounded-full shadow-2xl hover:shadow-teal-500/20 transition-all z-50 group"
      >
        <Sparkles className="w-6 h-6 group-hover:scale-110 transition-transform" />
      </button>
    );
  }

  return (
    <>
      <div
        className={`
          flex flex-col bg-slate-800 border border-slate-700 shadow-2xl overflow-hidden
          ${embedded ? 'h-full w-full rounded-xl' : 'fixed bottom-6 right-6 w-[400px] h-[650px] rounded-2xl z-50'}
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-700 bg-slate-900/50 backdrop-blur flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500/10 rounded-lg">
              <Bot className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">Alpha Assistant</h3>
              <p className="text-[10px] text-slate-400">Powered by Claude & GPT-4</p>
            </div>
          </div>
          {!embedded && (
            <button onClick={toggleOpen} className="text-slate-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Mode Selector */}
        <div className="flex overflow-x-auto p-2 bg-slate-900 border-b border-slate-700 gap-2 no-scrollbar">
          {[
            { id: 'default', icon: Bot, label: 'Pro' },
            { id: 'thinking', icon: BrainCircuit, label: 'Reasoning' },
            { id: 'search', icon: Globe, label: 'Search' },
            { id: 'maps', icon: MapPin, label: 'Maps' },
            { id: 'fast', icon: Zap, label: 'Lite' },
            { id: 'email', icon: Mail, label: 'Email' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id as AI_MODE)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors
                ${mode === m.id
                  ? m.id === 'email'
                    ? 'bg-blue-600 text-white'
                    : 'bg-teal-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}
              `}
            >
              <m.icon className="w-3.5 h-3.5" />
              {m.label}
            </button>
          ))}
        </div>

        {/* Email mode hint */}
        {mode === 'email' && (
          <div className="px-4 py-2 bg-blue-950/40 border-b border-blue-900/40 text-[11px] text-blue-300">
            Describe the email you need. Alpha will draft it and you can send it directly.
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.emailDraft ? (
                <div className="max-w-[90%] w-full bg-slate-800 border border-blue-800/60 rounded-2xl rounded-bl-none overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/30 border-b border-blue-800/40">
                    <Mail className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[11px] font-medium text-blue-300 uppercase tracking-wide">Email Draft</span>
                  </div>
                  <div className="p-3 space-y-2">
                    {msg.emailDraft.to && (
                      <div className="text-xs text-slate-400">
                        <span className="text-slate-500">To:</span>{' '}
                        <span className="text-slate-200">{msg.emailDraft.to}</span>
                      </div>
                    )}
                    <div className="text-xs">
                      <span className="text-slate-500">Subject:</span>{' '}
                      <span className="text-slate-100 font-medium">{msg.emailDraft.subject}</span>
                    </div>
                    <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap border-t border-slate-700 pt-2 max-h-36 overflow-y-auto">
                      {msg.emailDraft.body}
                    </div>
                  </div>
                  <div className="px-3 pb-3">
                    <button
                      onClick={() => setComposeDraft(msg.emailDraft!)}
                      className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open in Composer
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`
                    max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed whitespace-pre-wrap
                    ${msg.role === 'user'
                      ? 'bg-teal-600 text-white rounded-br-none'
                      : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-none'}
                  `}
                >
                  {msg.text}
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-none p-4 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
                <span className="text-xs text-slate-400">
                  {mode === 'thinking' ? 'Deep Thinking...' : mode === 'email' ? 'Drafting email...' : 'Processing...'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 bg-slate-800 border-t border-slate-700">
          {selectedImage && (
            <div className="mb-2 relative inline-block h-16 w-16 overflow-hidden rounded-lg border border-slate-600">
              <Image
                src={selectedImage}
                alt="Preview"
                fill
                className="object-cover"
                unoptimized
              />
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 bg-slate-700 rounded-full p-0.5 border border-slate-500 hover:bg-slate-600"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          )}
          <div className="flex gap-2 relative">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageSelect}
              accept="image/*"
              className="hidden"
            />
            {mode !== 'email' && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-colors"
                title="Upload Image"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
            )}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={
                mode === 'thinking'
                  ? 'Ask a complex question...'
                  : mode === 'email'
                  ? 'Describe the email, e.g. "Write an outreach to Sarah at Acme about our pricing"'
                  : 'Ask Alpha anything...'
              }
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-teal-500 pr-12"
            />
            <button
              onClick={handleSend}
              disabled={(!input.trim() && !selectedImage) || isLoading}
              className={`absolute right-2 top-2 p-1.5 text-white rounded-lg transition-colors disabled:opacity-50 disabled:bg-slate-700
                ${mode === 'email' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-teal-600 hover:bg-teal-500'}
              `}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {composeDraft && userId && (
        <ComposeEmailModal
          isOpen={true}
          onClose={() => setComposeDraft(null)}
          userId={userId}
          initialTo={composeDraft.to}
          initialSubject={composeDraft.subject}
          initialBody={composeDraft.body}
        />
      )}
    </>
  );
};

export default AIAssistant;
