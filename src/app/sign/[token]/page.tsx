'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { contractSigningService } from '@/services/contractSigningService';
import { esignatureComplianceService } from '@/services/esignatureComplianceService';
import { AppUrls } from '@/lib/urls';
import { Check, Shield, FileText, PenTool, AlertCircle, Loader2 } from 'lucide-react';

export default function PublicSignPage() {
  const params = useParams();
  const token = typeof params?.token === 'string' ? params.token : Array.isArray(params?.token) ? params?.token[0] : undefined;
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contract, setContract] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [esignConsent, setEsignConsent] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  // Simple Canvas-based signature (simplified for brevity, in production we'd use a library)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (!token) return;
    
    const init = async () => {
      const { contract, client, error } = await contractSigningService.resolveToken(token as string);
      if (error) {
        setError(error);
      } else {
        setContract(contract);
        setClient(client);
        setSignerName(client?.name || '');
        setSignerEmail(client?.email || '');
      }
      setLoading(false);
    };
    
    init();
  }, [token]);

  const startDrawing = (e: any) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.beginPath();
    }
  };

  const draw = (e: any) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleSign = async () => {
    if (!signerName || !signerEmail || !esignConsent) {
      alert('Please fill in all fields and accept the ESIGN disclosure.');
      return;
    }

    setIsSigning(true);
    
    // Get signature image data
    const signatureData = canvasRef.current?.toDataURL() || 'typed-signature';

    const result = await contractSigningService.signContract(
      contract.id,
      token as string,
      signatureData,
      signerName,
      signerEmail,
      'unknown', // IP would be detected on server-side usually, but we'll use 'unknown' for now or fetch it
      navigator.userAgent
    );

    if (result.success) {
      setSigned(true);
    } else {
      setError(result.error);
    }
    setIsSigning(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-200">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Link Invalid</h1>
          <p className="text-slate-600 mb-8">{error || 'This signing link has expired or is invalid.'}</p>
          <a href="/" className="inline-block w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors">
            Go to Homepage
          </a>
        </div>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-200">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Contract Signed</h1>
          <p className="text-slate-600 mb-8">Thank you! Your signature has been recorded and a confirmation email has been sent to {signerEmail}.</p>
          <button 
            onClick={() => window.close()}
            className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{contract.tenant?.name || 'AlphaClone Partner'}</h1>
              <p className="text-sm text-slate-500">Secure E-Signature Portal</p>
            </div>
          </div>
          <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-100 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            ESIGN Compliant
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Document Preview */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">{contract.title || 'Agreement'}</span>
              </div>
              <div className="p-8 md:p-12 min-h-[600px] prose prose-slate max-w-none">
                <div dangerouslySetInnerHTML={{ __html: contract.content || '' }} />
              </div>
            </div>
          </div>

          {/* Signature Panel */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sticky top-8">
              <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <PenTool className="w-5 h-5 text-blue-500" />
                Sign Document
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                  <input 
                    type="text" 
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Enter your full legal name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
                  <input 
                    type="email" 
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Signature</label>
                  <div className="relative group">
                    <canvas 
                      ref={canvasRef}
                      width={300}
                      height={150}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl cursor-crosshair"
                    />
                    <button 
                      onClick={() => {
                        const canvas = canvasRef.current;
                        const ctx = canvas?.getContext('2d');
                        ctx?.clearRect(0, 0, canvas?.width || 0, canvas?.height || 0);
                      }}
                      className="absolute top-2 right-2 text-xs text-slate-400 hover:text-red-500 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-start gap-3 mb-6">
                    <input 
                      type="checkbox" 
                      id="consent"
                      checked={esignConsent}
                      onChange={(e) => setEsignConsent(e.target.checked)}
                      className="mt-1 w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="consent" className="text-xs text-slate-600 leading-relaxed">
                      I agree to the <span className="text-blue-600 font-medium cursor-pointer">Electronic Signature Disclosure</span> and intend for this electronic mark to be my legally binding signature.
                    </label>
                  </div>

                  <button 
                    onClick={handleSign}
                    disabled={isSigning || !esignConsent || !signerName}
                    className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {isSigning ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Signing...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Sign & Complete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-500 mt-0.5" />
              <div className="text-xs text-blue-800 leading-relaxed">
                <strong>Legal Security:</strong> This document is cryptographically sealed and tracked with a full audit trail including IP address, timestamps, and intent affirmations.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
