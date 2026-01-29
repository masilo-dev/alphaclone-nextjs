'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { jsPDF } from 'jspdf';
import { FileText, Download, CheckCircle, Loader2 } from 'lucide-react';
import { SignaturePad } from '../../../components/contracts/SignaturePad';
import toast, { Toaster } from 'react-hot-toast';

export default function PublicContractPage() {
    const params = useParams();
    const id = params.id as string;

    const [contract, setContract] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [signing, setSigning] = useState(false);
    const [signed, setSigned] = useState(false);
    const [signatureData, setSignatureData] = useState<string | null>(null);

    useEffect(() => {
        if (id) {
            loadContract();
        }
    }, [id]);

    const loadContract = async () => {
        try {
            // Public fetch - RLS must allow reading by ID or this needs an Edge Function
            // For now, assuming table has public read policy OR we use an API route.
            const { data, error } = await supabase
                .from('contracts')
                .select('*, tenant:tenants(name)')
                .eq('id', id)
                .single();

            if (error) throw error;
            setContract(data);
            if (data.status === 'fully_signed' || data.status === 'client_signed') {
                setSigned(true);
            }
        } catch (error) {
            console.error('Error loading contract:', error);
            toast.error('Contract not found or access denied.');
        } finally {
            setLoading(false);
        }
    };

    const handleSign = async () => {
        if (!signatureData) {
            toast.error('Please sign the contract');
            return;
        }

        setSigning(true);
        try {
            const { error } = await supabase
                .from('contracts')
                .update({
                    client_signature: signatureData,
                    client_signed_at: new Date().toISOString(),
                    status: 'client_signed'
                })
                .eq('id', id);

            if (error) throw error;

            setSigned(true);
            toast.success('Contract signed successfully!');

            // Auto-download PDF
            setTimeout(() => generateAndDownloadPDF(contract, signatureData), 1000);

        } catch (error) {
            console.error('Signing error:', error);
            toast.error('Failed to save signature');
        } finally {
            setSigning(false);
        }
    };

    const generateAndDownloadPDF = (contractData: any, signature: string) => {
        const doc = new jsPDF();

        doc.setFontSize(20);
        doc.text('SIGNED CONTRACT', 105, 20, { align: 'center' });

        doc.setFontSize(12);
        doc.text(`Reference: ${contractData.id}`, 20, 40);
        doc.text(`Tenant: ${contractData.tenant?.name || 'AlphaClone Systems'}`, 20, 50);

        const splitText = doc.splitTextToSize(contractData.content || '', 170);
        doc.text(splitText, 20, 70);

        // Add Signature
        let yPos = 70 + (splitText.length * 5) + 20;
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }

        doc.text('Signed by Client:', 20, yPos);
        doc.addImage(signature, 'PNG', 20, yPos + 5, 60, 30);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, yPos + 40);

        doc.save(`${contractData.title.replace(/\s+/g, '_')}_Signed.pdf`);
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white"><Loader2 className="w-8 h-8 animate-spin text-teal-500" /></div>;
    }

    if (!contract) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">Contract not found</div>;
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 py-12 px-4">
            <Toaster position="top-center" />
            <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="bg-slate-950/50 p-6 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-teal-500/10 rounded-xl">
                            <FileText className="w-8 h-8 text-teal-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white">{contract.title}</h1>
                            <p className="text-sm text-slate-400">Provided by {contract.tenant?.name || 'AlphaClone'}</p>
                        </div>
                    </div>
                    {signed && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-400 rounded-lg border border-green-500/20">
                            <CheckCircle className="w-5 h-5" />
                            <span className="font-bold text-sm">Signed & Active</span>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-8 max-w-none prose prose-invert prose-slate">
                    <div className="whitespace-pre-wrap font-serif leading-relaxed text-slate-300">
                        {contract.content}
                    </div>
                </div>

                {/* Signature Section */}
                {!signed ? (
                    <div className="p-8 bg-slate-950/30 border-t border-slate-800">
                        <label className="block text-sm font-bold text-white mb-4 uppercase tracking-wider">Sign Below to Accept</label>
                        <div className="overflow-hidden bg-white rounded-xl">
                            <SignaturePad
                                onSave={(data) => setSignatureData(data)}
                                onClear={() => setSignatureData(null)}
                            />
                        </div>
                        <div className="flex justify-between mt-2">
                            <p className="text-xs text-slate-500">By signing, you agree to all terms.</p>
                        </div>
                        <button
                            onClick={handleSign}
                            disabled={signing || !signatureData}
                            className={`w-full mt-6 py-4 font-bold text-lg rounded-xl transition-all flex items-center justify-center gap-2 ${signatureData && !signing
                                    ? 'bg-teal-500 hover:bg-teal-400 text-slate-900 active:scale-[0.99]'
                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                }`}
                        >
                            {signing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign Contract'}
                        </button>
                    </div>
                ) : (
                    <div className="p-8 bg-slate-950/30 border-t border-slate-800 text-center">
                        <p className="text-slate-400 mb-6">This contract has been signed on {new Date(contract.client_signed_at).toLocaleDateString()}.</p>
                        <button
                            onClick={() => generateAndDownloadPDF(contract, contract.client_signature)}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-white transition-colors"
                        >
                            <Download className="w-5 h-5" /> Download PDF Copy
                        </button>
                    </div>
                )}
            </div>

            <div className="text-center mt-8 text-slate-500 text-sm">
                Securely powered by <span className="text-slate-400 font-semibold">AlphaClone Systems</span>
            </div>
        </div>
    );
}
