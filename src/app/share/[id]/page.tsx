import { publicShareService } from '@/services/publicShareService';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Shared Document | AlphaClone Systems',
    description: 'Secure temporary public document sharing link.',
};

export default async function PublicSharePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const share = await publicShareService.getShare(id);

    if (!share) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-100 font-sans">
                <div className="max-w-md w-full bg-slate-900/60 border border-slate-800 rounded-2xl p-8 backdrop-blur-xl shadow-2xl text-center space-y-6">
                    <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/30 rounded-full flex items-center justify-center mx-auto text-rose-400">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold tracking-tight text-white">Link Expired</h1>
                        <p className="text-slate-400 text-sm leading-relaxed">
                            This document share link is invalid or has expired after its 48-hour window. Please contact the sender to generate a new link.
                        </p>
                    </div>
                    <div className="pt-4 border-t border-slate-800/80">
                        <p className="text-xs text-slate-500 text-center">AlphaClone Systems Secure Sharing</p>
                    </div>
                </div>
            </div>
        );
    }

    const formattedExpiry = new Date(share.expires_at).toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    });

    const isPdf = share.original_name?.toLowerCase().endsWith('.pdf') || true;

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col p-4 sm:p-6 text-slate-100 font-sans">
            {/* Header */}
            <div className="max-w-6xl w-full mx-auto flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20">
                        <span className="font-bold text-slate-950 text-lg">A</span>
                    </div>
                    <div>
                        <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">AlphaClone</span>
                        <span className="text-xs block text-slate-400">Secure Document Share</span>
                    </div>
                </div>
                <div className="text-xs sm:text-sm text-slate-400 bg-slate-900/50 border border-slate-800/60 rounded-full px-4 py-1.5 backdrop-blur-sm">
                    Expires: <span className="text-teal-400 font-medium">{formattedExpiry}</span>
                </div>
            </div>

            {/* Main Card */}
            <div className="max-w-6xl w-full mx-auto flex-1 flex flex-col bg-slate-900/40 border border-slate-800 rounded-3xl backdrop-blur-xl shadow-2xl overflow-hidden">
                {/* File Title Bar */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 border-b border-slate-800/60 bg-slate-950/20 gap-4">
                    <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-teal-500/10 border border-teal-500/20 rounded-2xl flex items-center justify-center text-teal-400 shrink-0">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white leading-tight break-all">
                                {share.original_name || 'shared_document.pdf'}
                            </h1>
                            <p className="text-xs text-slate-400 mt-1">
                                Securely hosted on AlphaClone Systems. Available for inline reading and download.
                            </p>
                        </div>
                    </div>

                    <a
                        href={`/api/public/shares/${share.id}/download?download=true`}
                        download
                        className="w-full sm:w-auto bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-slate-950 font-bold px-6 py-3 rounded-xl transition duration-200 shadow-lg shadow-teal-500/15 flex items-center justify-center space-x-2 text-sm uppercase tracking-wider shrink-0"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>Download Document</span>
                    </a>
                </div>

                {/* PDF Viewer Body */}
                <div className="flex-1 bg-slate-950/40 p-4 min-h-[500px] flex flex-col">
                    {isPdf ? (
                        <iframe
                            src={`/api/public/shares/${share.id}/download`}
                            className="w-full flex-1 rounded-2xl border border-slate-800 bg-slate-900 shadow-inner"
                            title="Shared Document Viewer"
                            style={{ height: 'calc(100vh - 280px)', minHeight: '550px' }}
                        />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                            <p className="text-slate-400 mb-4">Preview not available for this file type.</p>
                            <a
                                href={`/api/public/shares/${share.id}/download?download=true`}
                                download
                                className="bg-slate-800 hover:bg-slate-700 text-white font-semibold px-6 py-2.5 rounded-lg border border-slate-700 transition"
                            >
                                Download to View
                            </a>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="max-w-6xl w-full mx-auto text-center mt-6 text-xs text-slate-500 space-y-1">
                <p>© {new Date().getFullYear()} AlphaClone Systems. All rights reserved.</p>
                <p>Protected by end-to-end transport layer security. Expires after 24 hours.</p>
            </div>
        </div>
    );
}
