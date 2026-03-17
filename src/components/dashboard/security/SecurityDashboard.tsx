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
    const [scanHistory, setScanHistory] = useState<any[]>([]);

    useEffect(() => {
        if (tenantId) {
            loadLastScan();
        }
    }, [tenantId]);

    const loadLastScan = async () => {
        if (!tenantId) return;
        await loadScanHistory();
    };

    const loadScanHistory = async () => {
        if (!tenantId) return;
        const { scans } = await securityScannerService.getScanHistory(tenantId);
        setScanHistory(scans);

        if (scans.length > 0 && !result) {
            const last = scans[0];
            setResult({
                url: last.url,
                timestamp: new Date(last.created_at),
                score: last.score,
                grade: last.grade,
                checks: last.details.checks,
                issues: last.details.issues
            });
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
                await loadScanHistory();
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

                    {/* Detailed Checks */}
                    <div className="lg:col-span-2 relative">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                    {/* Issues List */}
                    {result.issues.length > 0 && (
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

                    {/* Scan History */}
                    <Card className="lg:col-span-3 p-6 border-slate-700 bg-slate-800/50">
                        <h3 className="text-xl font-bold text-white mb-4">Scan History</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-slate-500 text-sm border-b border-slate-700">
                                        <th className="pb-3 pr-4">URL</th>
                                        <th className="pb-3 px-4">Score</th>
                                        <th className="pb-3 px-4">Grade</th>
                                        <th className="pb-3 pl-4">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm text-slate-300">
                                    {scanHistory.map((scan) => (
                                        <tr key={scan.id} className="border-b border-slate-800/50 hover:bg-slate-700/20 cursor-pointer" onClick={() => {
                                            setResult({
                                                url: scan.url,
                                                timestamp: new Date(scan.created_at),
                                                score: scan.score,
                                                grade: scan.grade,
                                                checks: scan.details.checks,
                                                issues: scan.details.issues
                                            });
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}>
                                            <td className="py-4 pr-4 font-medium">{scan.url}</td>
                                            <td className="py-4 px-4">{scan.score}</td>
                                            <td className="py-4 px-4">
                                                <span className={`font-bold ${getGradeColor(scan.grade)}`}>{scan.grade}</span>
                                            </td>
                                            <td className="py-4 pl-4 text-slate-500">
                                                {new Date(scan.created_at).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                    {scanHistory.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="py-8 text-center text-slate-500 italic">No previous scans found</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
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
