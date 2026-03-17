
import React from 'react';
import Link from 'next/link';
import { AlertTriangle, Home } from 'lucide-react';
import { Button } from '../ui/UIComponents';

const NotFound: React.FC = () => {
   return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center px-4 relative overflow-hidden">
         {/* Background Decor */}
         <div className="absolute inset-0 bg-grid-pattern opacity-[0.05]" />
         <div className="absolute w-96 h-96 bg-red-500/10 rounded-full blur-[100px] pointer-events-none" />

         <div className="relative z-10">
            <div className="w-20 h-20 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
               <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-6xl font-bold text-white mb-4">404</h1>
            <h2 className="text-2xl text-slate-300 mb-6">Page Not Found</h2>
            <p className="text-slate-500 max-w-md mx-auto mb-8">
               The resource you are looking for might have been removed, had its name changed, or is temporarily unavailable.
            </p>
            <Link href="/">
               <Button className="bg-white text-slate-900 hover:bg-slate-200 font-bold gap-2">
                  <Home className="w-4 h-4" /> Return Home
               </Button>
            </Link>
         </div>
      </div>
   );
};

export default NotFound;
