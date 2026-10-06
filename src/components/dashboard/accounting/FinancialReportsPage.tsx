'use client';

import { Input as AlphaCloneInput } from '@/components/ui/input';


import React, { useState, useEffect } from 'react';
import { generalLedgerService, TrialBalance, FinancialStatement } from '../../../services/accounting/generalLedgerService';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenant } from '../../../contexts/TenantContext';
import { generatePnLPDF, generateBalanceSheetPDF, generateTrialBalancePDF } from '../../../utils/pdfGenerator';
import toast from 'react-hot-toast';
import { FileDown } from 'lucide-react';
import CashFlowStatement from './CashFlowStatement';
import ModuleJumpSelect from '../common/ModuleJumpSelect';
import {
    MobileDataCard,
    ResponsiveTableDesktop,
    ResponsiveTableMobile,
} from '../../ui/ResponsiveTable';

type ReportType = 'trial_balance' | 'balance_sheet' | 'profit_loss' | 'cash_flow';

const REPORT_OPTIONS: { label: string; href: ReportType }[] = [
    { label: 'Trial Balance', href: 'trial_balance' },
    { label: 'Balance Sheet', href: 'balance_sheet' },
    { label: 'Profit & Loss', href: 'profit_loss' },
    { label: 'Cash Flow', href: 'cash_flow' },
];

export function FinancialReportsPage() {
    const { user } = useAuth();
    const { currentTenant } = useTenant();
    const [selectedReport, setSelectedReport] = useState<ReportType>('trial_balance');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Trial Balance
    const [trialBalance, setTrialBalance] = useState<TrialBalance | null>(null);
    const [tbAsOfDate, setTbAsOfDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // Balance Sheet
    const [balanceSheet, setBalanceSheet] = useState<FinancialStatement | null>(null);
    const [bsAsOfDate, setBsAsOfDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // P&L
    const [profitLoss, setProfitLoss] = useState<FinancialStatement | null>(null);
    const [plStartDate, setPlStartDate] = useState<string>(
        new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
    );
    const [plEndDate, setPlEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (currentTenant) {
            loadReport();
        }
    }, [currentTenant, selectedReport]);

    const loadReport = async () => {
        setLoading(true);
        setError(null);

        try {
            if (selectedReport === 'trial_balance') {
                const { trialBalance: tb, error: err } = await generalLedgerService.getTrialBalance(tbAsOfDate);
                if (err) throw new Error(err);
                setTrialBalance(tb);
            } else if (selectedReport === 'balance_sheet') {
                const { statement, error: err } = await generalLedgerService.getBalanceSheetData(bsAsOfDate);
                if (err) throw new Error(err);
                setBalanceSheet(statement);
            } else if (selectedReport === 'profit_loss') {
                const { statement, error: err } = await generalLedgerService.getProfitLossData(plStartDate, plEndDate);
                if (err) throw new Error(err);
                setProfitLoss(statement);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        await loadReport();
    };

    const [isExporting, setIsExporting] = useState(false);

    const handleExportPDF = async () => {
        if (!currentTenant) return;
        setIsExporting(true);
        const toastId = toast.loading('Generating PDF report...');

        try {
            if (selectedReport === 'profit_loss' && profitLoss) {
                const doc = generatePnLPDF(profitLoss, currentTenant, plStartDate, plEndDate);
                doc.save(`Profit_Loss_${plStartDate}_to_${plEndDate}.pdf`);
                toast.success('Profit & Loss statement exported', { id: toastId });
            } else if (selectedReport === 'balance_sheet' && balanceSheet) {
                const doc = generateBalanceSheetPDF(balanceSheet, currentTenant, bsAsOfDate);
                doc.save(`Balance_Sheet_${bsAsOfDate}.pdf`);
                toast.success('Balance Sheet exported', { id: toastId });
            } else if (selectedReport === 'trial_balance' && trialBalance) {
                const doc = generateTrialBalancePDF(trialBalance, currentTenant, tbAsOfDate);
                doc.save(`Trial_Balance_${tbAsOfDate}.pdf`);
                toast.success('Trial Balance exported', { id: toastId });
            } else {
                toast.error('Please generate the report first', { id: toastId });
            }
        } catch (err: any) {
            console.error('Export error:', err);
            toast.error('Failed to export PDF: ' + err.message, { id: toastId });
        } finally {
            setIsExporting(false);
        }
    };

    const renderTrialBalance = () => {
        if (!trialBalance) return null;

        return (
            <div className="space-y-6">
                <div className="bg-[var(--ws-surface-secondary)] rounded-lg shadow-sm p-4 md:p-6">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-[var(--ws-text-primary)]">Trial Balance</h2>
                            <p className="text-[var(--ws-text-secondary)] mt-1">As of {new Date(tbAsOfDate).toLocaleDateString()}</p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <AlphaCloneInput
                                type="date"
                                value={tbAsOfDate}
                                onChange={(e) => setTbAsOfDate(e.target.value)}
                                className="px-3 py-2"
                            />
                            <button
                                onClick={loadReport}
                                className="px-4 py-2 bg-blue-600 text-[var(--ws-text-primary)] rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Generate
                            </button>
                        </div>
                    </div>

                    <ResponsiveTableMobile>
                        {trialBalance.accounts.map((account) => (
                            <MobileDataCard key={account.accountCode} className="border-[var(--ws-border)] bg-[var(--ws-surface-secondary)]/80">
                                <div className="flex justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="type-card-description text-[var(--ws-text-muted)] font-mono">{account.accountCode}</p>
                                        <p className="type-card-description font-medium text-[var(--ws-text-primary)] truncate">{account.accountName}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 type-ui font-mono">
                                    <div>
                                        <span className="type-caption text-[var(--ws-text-muted)] block">Debit</span>
                                        <span className="text-[var(--ws-text-primary)]">{account.debitBalance > 0 ? `$${account.debitBalance.toFixed(2)}` : '—'}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="type-caption text-[var(--ws-text-muted)] block">Credit</span>
                                        <span className="text-[var(--ws-text-primary)]">{account.creditBalance > 0 ? `$${account.creditBalance.toFixed(2)}` : '—'}</span>
                                    </div>
                                </div>
                            </MobileDataCard>
                        ))}
                        <MobileDataCard className="border-slate-600 bg-[var(--ws-panel)]">
                            <div className="grid grid-cols-2 gap-2 type-ui font-mono font-bold text-[var(--ws-text-primary)]">
                                <div>
                                    <span className="type-caption text-[var(--ws-text-muted)] block font-sans font-normal">Total Debits</span>
                                    ${trialBalance.totalDebits.toFixed(2)}
                                </div>
                                <div className="text-right">
                                    <span className="type-caption text-[var(--ws-text-muted)] block font-sans font-normal">Total Credits</span>
                                    ${trialBalance.totalCredits.toFixed(2)}
                                </div>
                            </div>
                            <p className="text-center type-card-description pt-1">
                                {trialBalance.isBalanced ? (
                                    <span className="text-green-400 font-semibold">✓ Books are balanced</span>
                                ) : (
                                    <span className="text-red-400 font-semibold">
                                        ⚠ Difference: ${Math.abs(trialBalance.totalDebits - trialBalance.totalCredits).toFixed(2)}
                                    </span>
                                )}
                            </p>
                        </MobileDataCard>
                    </ResponsiveTableMobile>

                    <ResponsiveTableDesktop>
                        <table className="min-w-[560px] w-full divide-y divide-slate-700">
                            <thead className="bg-[var(--ws-panel)]">
                                <tr>
                                    <th className="px-4 md:px-6 py-3 text-left type-caption font-medium text-[var(--ws-text-muted)] uppercase">Account Code</th>
                                    <th className="px-4 md:px-6 py-3 text-left type-caption font-medium text-[var(--ws-text-muted)] uppercase">Account Name</th>
                                    <th className="px-4 md:px-6 py-3 text-right type-caption font-medium text-[var(--ws-text-muted)] uppercase">Debit</th>
                                    <th className="px-4 md:px-6 py-3 text-right type-caption font-medium text-[var(--ws-text-muted)] uppercase">Credit</th>
                                </tr>
                            </thead>
                            <tbody className="bg-[var(--ws-surface-secondary)] divide-y divide-slate-700">
                                {trialBalance.accounts.map((account) => (
                                    <tr key={account.accountCode}>
                                        <td className="px-4 md:px-6 py-4 whitespace-nowrap type-table-cell font-medium text-[var(--ws-text-primary)]">
                                            {account.accountCode}
                                        </td>
                                        <td className="px-4 md:px-6 py-4 whitespace-nowrap type-table-cell text-[var(--ws-text-secondary)]">
                                            {account.accountName}
                                        </td>
                                        <td className="px-4 md:px-6 py-4 whitespace-nowrap type-table-cell text-right font-mono text-[var(--ws-text-primary)]">
                                            {account.debitBalance > 0 ? `$${account.debitBalance.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="px-4 md:px-6 py-4 whitespace-nowrap type-table-cell text-right font-mono text-[var(--ws-text-primary)]">
                                            {account.creditBalance > 0 ? `$${account.creditBalance.toFixed(2)}` : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-[var(--ws-panel)] border-t-2 border-slate-600">
                                <tr>
                                    <td colSpan={2} className="px-4 md:px-6 py-4 text-right font-bold text-[var(--ws-text-primary)]">TOTALS:</td>
                                    <td className="px-4 md:px-6 py-4 whitespace-nowrap type-table-cell text-right font-mono font-bold text-[var(--ws-text-primary)]">
                                        ${trialBalance.totalDebits.toFixed(2)}
                                    </td>
                                    <td className="px-4 md:px-6 py-4 whitespace-nowrap type-table-cell text-right font-mono font-bold text-[var(--ws-text-primary)]">
                                        ${trialBalance.totalCredits.toFixed(2)}
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={4} className="px-4 md:px-6 py-3 text-center">
                                        {trialBalance.isBalanced ? (
                                            <span className="text-green-400 font-semibold">✓ Books are balanced</span>
                                        ) : (
                                            <span className="text-red-400 font-semibold">
                                                ⚠ Books are NOT balanced (difference: ${Math.abs(trialBalance.totalDebits - trialBalance.totalCredits).toFixed(2)})
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </ResponsiveTableDesktop>
                </div>
            </div>
        );
    };

    const renderBalanceSheet = () => {
        if (!balanceSheet) return null;

        const totalLiabilitiesAndEquity = balanceSheet.totalLiabilities + balanceSheet.totalEquity;
        const isBalanced = Math.abs(balanceSheet.totalAssets - totalLiabilitiesAndEquity) < 0.01;

        return (
            <div className="space-y-6">
                <div className="bg-[var(--ws-surface-secondary)] rounded-lg shadow-sm p-4 md:p-6">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-[var(--ws-text-primary)]">Balance Sheet</h2>
                            <p className="text-[var(--ws-text-secondary)] mt-1">As of {new Date(bsAsOfDate).toLocaleDateString()}</p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <AlphaCloneInput
                                type="date"
                                value={bsAsOfDate}
                                onChange={(e) => setBsAsOfDate(e.target.value)}
                                className="px-3 py-2"
                            />
                            <button
                                onClick={loadReport}
                                className="px-4 py-2 bg-blue-600 text-[var(--ws-text-primary)] rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Generate
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Assets */}
                        <div>
                            <h3 className="text-lg font-bold text-[var(--ws-text-primary)] mb-4 border-b-2 border-slate-600 pb-2">ASSETS</h3>
                            {balanceSheet.assets.map((account) => (
                                <div key={account.accountId} className="flex justify-between py-2 border-b border-[var(--ws-border)]">
                                    <span className="type-ui text-[var(--ws-text-secondary)]">{account.accountName}</span>
                                    <span className="type-ui font-mono text-[var(--ws-text-primary)]">${account.balance.toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between py-3 mt-2 border-t-2 border-slate-600 font-bold">
                                <span className="text-[var(--ws-text-primary)]">Total Assets</span>
                                <span className="font-mono text-[var(--ws-text-primary)]">${balanceSheet.totalAssets.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Liabilities & Equity */}
                        <div>
                            <h3 className="text-lg font-bold text-[var(--ws-text-primary)] mb-4 border-b-2 border-slate-600 pb-2">LIABILITIES</h3>
                            {balanceSheet.liabilities.map((account) => (
                                <div key={account.accountId} className="flex justify-between py-2 border-b border-[var(--ws-border)]">
                                    <span className="type-ui text-[var(--ws-text-secondary)]">{account.accountName}</span>
                                    <span className="type-ui font-mono text-[var(--ws-text-primary)]">${account.balance.toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between py-2 mt-2 font-semibold text-[var(--ws-text-secondary)]">
                                <span>Total Liabilities</span>
                                <span className="font-mono">${balanceSheet.totalLiabilities.toFixed(2)}</span>
                            </div>

                            <h3 className="text-lg font-bold text-[var(--ws-text-primary)] mb-4 mt-6 border-b-2 border-slate-600 pb-2">EQUITY</h3>
                            {balanceSheet.equity.map((account) => (
                                <div key={account.accountId} className="flex justify-between py-2 border-b border-[var(--ws-border)]">
                                    <span className="type-ui text-[var(--ws-text-secondary)]">{account.accountName}</span>
                                    <span className="type-ui font-mono text-[var(--ws-text-primary)]">${account.balance.toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between py-2 border-b border-[var(--ws-border)]">
                                <span className="type-ui text-[var(--ws-text-secondary)]">Net Income (Current Period)</span>
                                <span className="type-ui font-mono text-[var(--ws-text-primary)]">${balanceSheet.netIncome.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between py-2 mt-2 font-semibold text-[var(--ws-text-secondary)]">
                                <span>Total Equity</span>
                                <span className="font-mono">${balanceSheet.totalEquity.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between py-3 mt-4 border-t-2 border-slate-600 font-bold">
                                <span className="text-[var(--ws-text-primary)]">Total Liabilities & Equity</span>
                                <span className="font-mono text-[var(--ws-text-primary)]">${totalLiabilitiesAndEquity.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t-2 border-slate-600 text-center">
                        {isBalanced ? (
                            <span className="text-green-400 font-semibold">
                                ✓ Balance Sheet is balanced (Assets = Liabilities + Equity)
                            </span>
                        ) : (
                            <span className="text-red-400 font-semibold">
                                ⚠ Balance Sheet NOT balanced (difference: ${Math.abs(balanceSheet.totalAssets - totalLiabilitiesAndEquity).toFixed(2)})
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderProfitLoss = () => {
        if (!profitLoss) return null;

        return (
            <div className="space-y-6">
                <div className="bg-[var(--ws-surface-secondary)] rounded-lg shadow-sm p-4 md:p-6">
                    <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-[var(--ws-text-primary)]">Profit & Loss Statement</h2>
                            <p className="text-[var(--ws-text-secondary)] mt-1">
                                {new Date(plStartDate).toLocaleDateString()} - {new Date(plEndDate).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <div>
                                <label className="block type-label text-[var(--ws-text-muted)] mb-1">Start Date</label>
                                <AlphaCloneInput
                                    type="date"
                                    value={plStartDate}
                                    onChange={(e) => setPlStartDate(e.target.value)}
                                    className="px-3 py-2"
                                />
                            </div>
                            <div>
                                <label className="block type-label text-[var(--ws-text-muted)] mb-1">End Date</label>
                                <AlphaCloneInput
                                    type="date"
                                    value={plEndDate}
                                    onChange={(e) => setPlEndDate(e.target.value)}
                                    className="px-3 py-2"
                                />
                            </div>
                            <button
                                onClick={loadReport}
                                className="px-4 py-2 bg-blue-600 text-[var(--ws-text-primary)] rounded-lg hover:bg-blue-700 self-end transition-colors"
                            >
                                Generate
                            </button>
                        </div>
                    </div>

                    {/* Revenue */}
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-[var(--ws-text-primary)] mb-4 border-b-2 border-slate-600 pb-2">REVENUE</h3>
                        {profitLoss.revenue.map((account) => (
                            <div key={account.accountId} className="flex justify-between py-2 border-b border-[var(--ws-border)]">
                                <span className="type-ui text-[var(--ws-text-secondary)]">{account.accountName}</span>
                                <span className="type-ui font-mono text-[var(--ws-text-primary)]">${account.balance.toFixed(2)}</span>
                            </div>
                        ))}
                        {profitLoss.otherIncome.length > 0 && (
                            <>
                                <div className="mt-4 mb-2 type-ui font-semibold text-[var(--ws-text-secondary)]">Other Income:</div>
                                {profitLoss.otherIncome.map((account) => (
                                    <div key={account.accountId} className="flex justify-between py-2 border-b border-[var(--ws-border)]">
                                        <span className="type-ui text-[var(--ws-text-secondary)] pl-4">{account.accountName}</span>
                                        <span className="type-ui font-mono text-[var(--ws-text-primary)]">${account.balance.toFixed(2)}</span>
                                    </div>
                                ))}
                            </>
                        )}
                        <div className="flex justify-between py-3 mt-2 border-t-2 border-slate-600 font-bold">
                            <span className="text-[var(--ws-text-primary)]">Total Revenue</span>
                            <span className="font-mono text-green-400">${profitLoss.totalRevenue.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Expenses */}
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-[var(--ws-text-primary)] mb-4 border-b-2 border-slate-600 pb-2">EXPENSES</h3>
                        {profitLoss.expenses.map((account) => (
                            <div key={account.accountId} className="flex justify-between py-2 border-b border-[var(--ws-border)]">
                                <span className="type-ui text-[var(--ws-text-secondary)]">{account.accountName}</span>
                                <span className="type-ui font-mono text-[var(--ws-text-primary)]">${account.balance.toFixed(2)}</span>
                            </div>
                        ))}
                        {profitLoss.otherExpense.length > 0 && (
                            <>
                                <div className="mt-4 mb-2 type-ui font-semibold text-[var(--ws-text-secondary)]">Other Expenses:</div>
                                {profitLoss.otherExpense.map((account) => (
                                    <div key={account.accountId} className="flex justify-between py-2 border-b border-[var(--ws-border)]">
                                        <span className="type-ui text-[var(--ws-text-secondary)] pl-4">{account.accountName}</span>
                                        <span className="type-ui font-mono text-[var(--ws-text-primary)]">${account.balance.toFixed(2)}</span>
                                    </div>
                                ))}
                            </>
                        )}
                        <div className="flex justify-between py-3 mt-2 border-t-2 border-slate-600 font-bold">
                            <span className="text-[var(--ws-text-primary)]">Total Expenses</span>
                            <span className="font-mono text-red-400">${profitLoss.totalExpenses.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Net Income */}
                    <div className="border-t-4 border-slate-600 pt-4">
                        <div className="flex justify-between py-3 text-xl font-bold">
                            <span className="text-[var(--ws-text-primary)]">NET INCOME</span>
                            <span className={`font-mono ${profitLoss.netIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {profitLoss.netIncome >= 0 ? '+' : '-'}${Math.abs(profitLoss.netIncome).toFixed(2)}
                            </span>
                        </div>
                        <p className="type-card-description text-[var(--ws-text-secondary)] text-center mt-2">
                            {profitLoss.netIncome >= 0 ? 'Profitable' : 'Operating at a loss'}
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 md:p-6 ac-scroll-full ac-enterprise-module">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--ws-text-primary)]">Financial Statements</h1>
                    <p className="text-[var(--ws-text-secondary)] mt-1">Review the core reports that explain cash, performance, and balance health.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={handleExportPDF}
                        disabled={loading || isExporting}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-[var(--ws-text-primary)] rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        <FileDown className="w-4 h-4" />
                        Export Statement
                    </button>
                    <button
                        onClick={handleRefresh}
                        className="px-4 py-2 bg-[var(--ws-surface-tertiary)] text-[var(--ws-text-primary)] rounded-lg hover:bg-slate-600 transition-colors"
                    >
                        Refresh Figures
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-900/20 border border-red-500 text-red-400 px-4 py-3 rounded-lg mb-4">
                    {error}
                </div>
            )}

            {/* Report Selector */}
            <div className="ac-workspace-panel rounded-lg p-4 mb-6">
                <ModuleJumpSelect
                    options={REPORT_OPTIONS}
                    currentHref={selectedReport}
                    label="Statement type"
                    onNavigate={(href) => setSelectedReport(href as ReportType)}
                    className="mb-3"
                />
                <div className="hidden md:flex flex-wrap gap-4">
                    <button
                        onClick={() => setSelectedReport('trial_balance')}
                        className={`px-6 py-3 rounded-lg font-semibold transition-colors ${selectedReport === 'trial_balance'
                            ? 'bg-blue-600 text-[var(--ws-text-primary)]'
                            : 'bg-[var(--ws-surface-tertiary)] text-[var(--ws-text-secondary)] hover:bg-slate-600'
                            }`}
                    >
                        Trial Balance
                    </button>
                    <button
                        onClick={() => setSelectedReport('balance_sheet')}
                        className={`px-6 py-3 rounded-lg font-semibold transition-colors ${selectedReport === 'balance_sheet'
                            ? 'bg-blue-600 text-[var(--ws-text-primary)]'
                            : 'bg-[var(--ws-surface-tertiary)] text-[var(--ws-text-secondary)] hover:bg-slate-600'
                            }`}
                    >
                        Balance Sheet
                    </button>
                    <button
                        onClick={() => setSelectedReport('profit_loss')}
                        className={`px-6 py-3 rounded-lg font-semibold transition-colors ${selectedReport === 'profit_loss'
                            ? 'bg-teal-600 text-[var(--text-inverse)]'
                            : 'bg-[var(--ws-surface-tertiary)] text-[var(--ws-text-secondary)] hover:bg-slate-600'
                            }`}
                    >
                        Profit & Loss
                    </button>
                    <button
                        onClick={() => setSelectedReport('cash_flow')}
                        className={`px-6 py-3 rounded-lg font-semibold transition-colors ${selectedReport === 'cash_flow'
                            ? 'bg-teal-600 text-[var(--text-inverse)]'
                            : 'bg-[var(--ws-surface-tertiary)] text-[var(--ws-text-secondary)] hover:bg-slate-600'
                            }`}
                    >
                        Cash Flow
                    </button>
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="ac-workspace-panel rounded-lg flex items-center justify-center h-64">
                    <div className="text-[var(--ws-text-secondary)]">Preparing statement...</div>
                </div>
            )}

            {/* Report Content */}
            {!loading && (
                <>
                    {selectedReport === 'trial_balance' && renderTrialBalance()}
                    {selectedReport === 'balance_sheet' && renderBalanceSheet()}
                    {selectedReport === 'profit_loss' && renderProfitLoss()}
                    {selectedReport === 'cash_flow' && <CashFlowStatement />}
                </>
            )}
        </div>
    );
}

export default FinancialReportsPage;
