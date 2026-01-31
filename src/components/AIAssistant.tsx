
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, X, Sparkles, Loader2, BrainCircuit, Globe, MapPin, Image as ImageIcon, Zap } from 'lucide-react';
import { chatWithAI } from '../services/unifiedAIService';
import { ChatMessage } from '../types';

interface AIAssistantProps {
  embedded?: boolean;
}

type AI_MODE = 'default' | 'thinking' | 'search' | 'maps' | 'fast';

const AIAssistant: React.FC<AIAssistantProps> = ({ embedded = false }) => {
  const [isOpen, setIsOpen] = useState(embedded);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'model',
      text: "Hello, I'm Alpha. I'm powered by Gemini 3 Pro. How can I assist you?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<AI_MODE>('default');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    const currentImage = selectedImage;
    setSelectedImage(null); // Clear image after sending
    setIsLoading(true);

    try {

      const response = await chatWithAI(
        messages.map(m => ({ role: m.role, text: m.text })),
        userMsg.text,
        currentImage || undefined
      );

      let text = response.text;

      // Append grounding info if present
      const groundingData = (response as any).grounding;
      if (groundingData && Array.isArray(groundingData)) {
        interface GroundingChunk {
          web?: { uri?: string; title?: string };
          maps?: { uri?: string; title?: string };
        }
        const links = groundingData.map((chunk: GroundingChunk) => {
          if (chunk.web?.uri) return `[${chunk.web.title}](${chunk.web.uri})`;
          if (chunk.maps?.uri) return `[${chunk.maps.title || 'Map Location'}](${chunk.maps.uri})`;
          return null;
        }).filter(Boolean).join('\n');
        if (links) text += `\n\nSources:\n${links}`;
      }

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: text,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "I encountered an error processing your request.",
        timestamp: new Date()
      }]);
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
    <div className={`
      flex flex-col bg-slate-800 border border-slate-700 shadow-2xl overflow-hidden
      ${embedded ? 'h-full w-full rounded-xl' : 'fixed bottom-6 right-6 w-[400px] h-[650px] rounded-2xl z-50'}
    `}>
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-slate-900/50 backdrop-blur flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-500/10 rounded-lg">
            <Bot className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-sm">Alpha Assistant</h3>
            <p className="text-[10px] text-slate-400">Powered by Gemini 3 Pro & 2.5 Flash</p>
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
        ].map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id as AI_MODE)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors
                  ${mode === m.id ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'}
               `}
          >
            <m.icon className="w-3.5 h-3.5" />
            {m.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`
              max-w-[85%] rounded-2xl p-3 text-sm leading-relaxed whitespace-pre-wrap
              ${msg.role === 'user'
                ? 'bg-teal-600 text-white rounded-br-none'
                : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-none'}
            `}>
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-none p-4 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-teal-400" />
              <span className="text-xs text-slate-400">
                {mode === 'thinking' ? 'Deep Thinking...' : 'Processing...'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-slate-800 border-t border-slate-700">
        {selectedImage && (
          <div className="mb-2 relative inline-block">
            <img src={selectedImage} alt="Preview" className="h-16 rounded-lg border border-slate-600" />
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
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-colors"
            title="Upload Image"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={mode === 'thinking' ? "Ask a complex question..." : "Ask Alpha anything..."}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-teal-500 pr-12"
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !selectedImage) || isLoading}
            className="absolute right-2 top-2 p-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-500 disabled:opacity-50 disabled:bg-slate-700 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
