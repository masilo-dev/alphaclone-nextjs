import React, { useState, useEffect } from 'react';
import { Shield, Lock, AlertTriangle, CheckCircle, Globe, Download } from 'lucide-react';
import { securityScannerService, ScanResult } from '../../../services/securityScannerService';
import { Button, Card } from '../../ui/UIComponents';
import { useCurrentTenantId } from '../../../contexts/TenantContext';
import { paymentService } from '../../../services/paymentService';
import { userService } from '../../../services/userService';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';

const SecurityDashboard: React.FC = () => {
    const tenantId = useCurrentTenantId();
    const [url, setUrl] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const [result, setResult] = useState<ScanResult | null>(null);
    const [isPremium, setIsPremium] = useState(false);

    useEffect(() => {
        if (tenantId) {
            loadLastScan();
        }
    }, [tenantId]);

    const loadLastScan = async () => {
        if (!tenantId) return;
        const { data, error } = await supabase
            .from('security_scans')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (data) {
            setResult({
                url: data.url,
                timestamp: new Date(data.created_at),
                score: data.score,
                grade: data.grade,
                checks: data.details.checks,
                issues: data.details.issues
            });
        }
    };

    const handlePurchase = async (type: 'one-time' | 'subscription') => {
        setIsScanning(true);
        try {
            const user = await userService.getCurrentUser();
            if (!user) {
                toast.error('Please login to purchase a report');
                return;
            }

            const amount = type === 'one-time' ? 1.00 : 5.00;
            const description = type === 'one-time'
                ? `Security Audit Report for ${url}`
                : `Monthly Security Monitoring for ${url}`;

            // 1. Create Invoice
            const { invoice, error: invError } = await paymentService.createInvoice({
                user_id: user.id,
                amount: amount,
                currency: 'usd',
                description: description,
                items: [{
                    description: description,
                    quantity: 1,
                    unit_price: amount,
                    amount: amount
                }],
                due_date: new Date(Date.now() + 86400000).toISOString() // Tomorrow
            });

            if (invError || !invoice) throw new Error(invError?.message || 'Failed to create invoice');

            // 2. In production, we would trigger Stripe here
            // Since this is a dev/test environment, we simulate success
            toast.success('Processing payment...');

            setTimeout(async () => {
                await paymentService.markInvoicePaid(invoice.id, 'mock_stripe_id');
                setIsPremium(true);
                setIsScanning(false);
                toast.success('Payment Successful! Report Unlocked.');
            }, 2000);

        } catch (error: any) {
            console.error('Purchase failed:', error);
            toast.error(error.message || 'Payment failed');
            setIsScanning(false);
        }
    };

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) return;

        setIsScanning(true);
        setResult(null);

        try {
            const scanResult = await securityScannerService.scanWebsite(url);
            setResult(scanResult);
            if (tenantId) {
                await securityScannerService.saveScanResult(tenantId, scanResult);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsScanning(false);
        }
    };

    const getGradeColor = (grade: string) => {
        switch (grade) {
            case 'A': return 'text-green-500';
            case 'B': return 'text-teal-400';
            case 'C': return 'text-yellow-500';
            case 'D': return 'text-orange-500';
            case 'F': return 'text-red-500';
            default: return 'text-slate-400';
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Security Center</h1>
                    <p className="text-slate-400">Monitor website security, SSL status, and trust reputation.</p>
                </div>
                {result && (
                    <Button variant="outline" onClick={() => window.print()}>
                        <Download className="w-4 h-4 mr-2" />
                        Export Report
                    </Button>
                )}
            </div>

            {/* Scanner Input */}
            <Card className="p-8 border-slate-700 bg-slate-800/50 backdrop-blur-md">
                <form onSubmit={handleScan} className="max-w-3xl mx-auto">
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="flex-1 w-full">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Website URL to Scan</label>
                            <div className="relative">
                                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type="text"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="example.com"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-12 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-teal-500/50 placeholder-slate-600"
                                />
                            </div>
                        </div>
                        <Button
                            type="submit"
                            size="lg"
                            className="bg-teal-600 hover:bg-teal-500 w-full md:w-auto h-[50px]"
                            isLoading={isScanning}
                            disabled={!url}
                        >
                            {isScanning ? 'Scanning...' : 'Run Security Scan'}
                        </Button>
                    </div>
                </form>
            </Card>

            {/* Results */}
            {result && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-slide-up">
                    {/* Score Card */}
                    <Card className="p-8 border-slate-700 bg-slate-800/50 backdrop-blur-md text-center flex flex-col justify-center items-center">
                        <h3 className="text-lg font-medium text-slate-400 mb-4">Security Grade</h3>
                        <div className={`text-8xl font-black mb-4 ${getGradeColor(result.grade)}`}>
                            {result.grade}
                        </div>
                        <div className="text-2xl font-bold text-white mb-2">{result.score}/100</div>
                        <p className="text-slate-500 text-sm">Valid as of {result.timestamp.toLocaleTimeString()}</p>
                    </Card>

                    {/* Detailed Checks - Locked Behind Paywall */}
                    <div className="lg:col-span-2 relative">
                        {/* Blur Overlay if not Premium */}
                        {!isPremium && (
                            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm z-10 rounded-xl flex flex-col items-center justify-center text-center p-8 border border-slate-700/50">
                                <Lock className="w-12 h-12 text-teal-500 mb-4" />
                                <h3 className="text-2xl font-bold text-white mb-2">Unlock Full Security Report</h3>
                                <p className="text-slate-400 max-w-md mb-8">
                                    Get detailed vulnerability insights, SSL validation, and actionable remediation steps.
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg">
                                    <button
                                        onClick={() => handlePurchase('one-time')}
                                        className="group relative p-6 bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-teal-500 rounded-xl transition-all text-left"
                                    >
                                        <div className="absolute top-0 right-0 bg-teal-500 text-slate-900 text-xs font-bold px-3 py-1 rounded-bl-xl rounded-tr-lg">
                                            BEST VALUE
                                        </div>
                                        <h4 className="font-bold text-white text-lg mb-1">$1.00 <span className="text-sm text-slate-400 font-normal">/ Report</span></h4>
                                        <p className="text-sm text-slate-400">One-time full audit + PDF download</p>
                                    </button>
                                    <button
                                        onClick={() => handlePurchase('subscription')}
                                        className="p-6 bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-teal-500 rounded-xl transition-all text-left"
                                    >
                                        <h4 className="font-bold text-white text-lg mb-1">$5.00 <span className="text-sm text-slate-400 font-normal">/ Monthly</span></h4>
                                        <p className="text-sm text-slate-400">Daily auto-scans & monitoring</p>
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${!isPremium ? 'opacity-20 pointer-events-none select-none' : ''}`}>
                            <CheckCard
                                title="SSL/TLS Encryption"
                                status={result.checks.ssl.status}
                                details={result.checks.ssl.details}
                                icon={Lock}
                            />
                            <CheckCard
                                title="Security Headers"
                                status={result.checks.headers.status}
                                details={result.checks.headers.details}
                                icon={Shield}
                            />
                            <CheckCard
                                title="Malware & Phishing"
                                status={result.checks.malware.status}
                                details={result.checks.malware.details}
                                icon={AlertTriangle}
                            />
                            <CheckCard
                                title="Email Trust (DNS)"
                                status={result.checks.mail.status}
                                details={result.checks.mail.details}
                                icon={CheckCircle}
                            />
                        </div>
                    </div>

                    {/* Issues List - Only show if Premium */}
                    {isPremium && result.issues.length > 0 && (
                        <Card className="lg:col-span-3 p-6 border-red-500/20 bg-red-500/5 animate-fade-in">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                                <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
                                Critical Issues Found
                            </h3>
                            <ul className="space-y-3">
                                {result.issues.map((issue: string, idx: number) => (
                                    <li key={idx} className="flex items-center text-red-200 bg-red-500/10 px-4 py-2 rounded-lg">
                                        <div className="w-2 h-2 rounded-full bg-red-500 mr-3" />
                                        {issue}
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    )}
                </div>
            )}

            {!result && !isScanning && (
                <div className="text-center py-20 opacity-50">
                    <Shield className="w-24 h-24 mx-auto text-slate-700 mb-6" />
                    <h3 className="text-xl font-medium text-slate-400">Ready to Scan</h3>
                    <p className="text-slate-600">Enter a domain above to perform a comprehensive security audit.</p>
                </div>
            )}
        </div>
    );
};

const CheckCard: React.FC<{
    title: string;
    status: 'pass' | 'fail' | 'warning';
    details: string;
    icon: any;
}> = ({ title, status, details, icon: Icon }) => {
    const getColor = () => {
        if (status === 'pass') return 'bg-green-500/10 border-green-500/20 text-green-400';
        if (status === 'fail') return 'bg-red-500/10 border-red-500/20 text-red-400';
        return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400';
    };

    return (
        <div className={`p-6 rounded-xl border ${getColor()} transition-all`}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${status === 'pass' ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-lg text-white">{title}</h4>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${status === 'pass' ? 'bg-green-500 text-slate-900' :
                    status === 'fail' ? 'bg-red-500 text-white' :
                        'bg-yellow-500 text-slate-900'
                    }`}>
                    {status}
                </div>
            </div>
            <p className="text-slate-300 text-sm leading-relaxed">
                {details}
            </p>
        </div>
    );
}

export default SecurityDashboard;
