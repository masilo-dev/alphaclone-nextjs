
import React from 'react';
import { Sparkles } from 'lucide-react';

const AIStudio: React.FC = () => {
   return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-fade-in">
         <div className="w-20 h-20 bg-teal-500/10 rounded-full flex items-center justify-center mb-6">
            <Sparkles className="w-10 h-10 text-teal-400 animate-pulse" />
         </div>
         <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">AI Studio Coming Soon</h1>
         <p className="text-slate-400 max-w-lg mx-auto text-lg mb-8">
            We're putting the finishing touches on our advanced AI media generation suite.
            Stay tuned for professional image editing and video generation capabilities.
         </p>
         <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-full border border-slate-800 text-sm text-slate-500">
            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            Under Development
         </div>
      </div>
   );
};

export default AIStudio;
