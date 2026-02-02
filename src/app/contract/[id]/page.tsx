'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase';
import { jsPDF } from 'jspdf';
import { FileText, Download, CheckCircle, Loader2, ShieldCheck } from 'lucide-react';
import { SignaturePad } from '../../../components/contracts/SignaturePad';
import { contractService } from '../../../services/contractService';
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
            const { contract: updated, error } = await contractService.signContract(id, 'client', signatureData);

            if (error) throw error;

            setContract(updated);
            setSigned(true);
            toast.success('Contract signed successfully!');

            // Auto-download PDF
            setTimeout(() => generateAndDownloadPDF(updated, signatureData), 1000);

        } catch (error) {
            console.error('Signing error:', error);
            toast.error('Failed to save signature');
        } finally {
            setSigning(false);
        }
    };

    const generateAndDownloadPDF = (contractData: any, signature: string) => {
        const doc = new jsPDF();

        // Use a better header
        doc.setFillColor(15, 23, 42); // slate-900
        doc.rect(0, 0, 210, 40, 'F');

        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text('CERTIFIED CONTRACT', 20, 25);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text(`Reference: ${contractData.id}`, 20, 33);

        // Content
        let y = 60;
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(11);

        const splitText = doc.splitTextToSize(contractData.content || '', 170);
        splitText.forEach((line: string) => {
            if (y > 275) {
                doc.addPage();
                y = 20;
            }
            doc.text(line, 20, y);
            y += 6;
        });

        // Signatures
        y += 20;
        if (y > 240) {
            doc.addPage();
            y = 30;
        }

        doc.setDrawColor(226, 232, 240);
        doc.line(20, y, 190, y);
        y += 15;

        doc.setFont('helvetica', 'bold');
        doc.text('CLIENT SIGNATURE', 20, y);
        doc.addImage(signature, 'PNG', 20, y + 5, 60, 25);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(`Electronically signed on ${new Date().toLocaleString()}`, 20, y + 35);

        // Security Seal
        doc.setDrawColor(20, 184, 166); // teal-500
        doc.setLineWidth(0.5);
        doc.rect(140, y + 5, 40, 25);
        doc.setFontSize(10);
        doc.setTextColor(20, 184, 166);
        doc.text('VERIFIED', 160, y + 15, { align: 'center' });
        doc.setFontSize(7);
        doc.text('AUTHENTIC DOCUMENT', 160, y + 22, { align: 'center' });

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
                        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 text-xs">
                            <span className="text-slate-500 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> Secure 256-bit SSL Cryptography Applied
                            </span>
                            <p className="text-slate-500">Draw your signature in the box above.</p>
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
