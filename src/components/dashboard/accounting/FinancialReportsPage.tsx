'use client';

import React, { useState, useEffect } from 'react';
import { generalLedgerService, TrialBalance, FinancialStatement } from '../../../services/accounting/generalLedgerService';
import { useAuth } from '../../../contexts/AuthContext';
import { useTenant } from '../../../contexts/TenantContext';

type ReportType = 'trial_balance' | 'balance_sheet' | 'profit_loss';

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

    const handleRefreshGL = async () => {
        if (!confirm('Refresh General Ledger materialized view? This may take a few moments.')) return;

        const { success, error: err } = await generalLedgerService.refreshGeneralLedger();

        if (err) {
            alert(`Error refreshing GL: ${err}`);
        } else {
            alert('General Ledger refreshed successfully!');
            loadReport();
        }
    };

    const renderTrialBalance = () => {
        if (!trialBalance) return null;

        return (
            <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Trial Balance</h2>
                            <p className="text-gray-600 mt-1">As of {new Date(tbAsOfDate).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-3">
                            <input
                                type="date"
                                value={tbAsOfDate}
                                onChange={(e) => setTbAsOfDate(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg"
                            />
                            <button
                                onClick={loadReport}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Generate
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Code</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account Name</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Debit</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {trialBalance.accounts.map((account) => (
                                    <tr key={account.accountCode}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {account.accountCode}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {account.accountName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono">
                                            {account.debitBalance > 0 ? `$${account.debitBalance.toFixed(2)}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono">
                                            {account.creditBalance > 0 ? `$${account.creditBalance.toFixed(2)}` : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                                <tr>
                                    <td colSpan={2} className="px-6 py-4 text-right font-bold text-gray-900">TOTALS:</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-bold">
                                        ${trialBalance.totalDebits.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-bold">
                                        ${trialBalance.totalCredits.toFixed(2)}
                                    </td>
                                </tr>
                                <tr>
                                    <td colSpan={4} className="px-6 py-3 text-center">
                                        {trialBalance.isBalanced ? (
                                            <span className="text-green-600 font-semibold">✓ Books are balanced</span>
                                        ) : (
                                            <span className="text-red-600 font-semibold">
                                                ⚠ Books are NOT balanced (difference: ${Math.abs(trialBalance.totalDebits - trialBalance.totalCredits).toFixed(2)})
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
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
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Balance Sheet</h2>
                            <p className="text-gray-600 mt-1">As of {new Date(bsAsOfDate).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-3">
                            <input
                                type="date"
                                value={bsAsOfDate}
                                onChange={(e) => setBsAsOfDate(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg"
                            />
                            <button
                                onClick={loadReport}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Generate
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Assets */}
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 mb-4 border-b-2 border-gray-300 pb-2">ASSETS</h3>
                            {balanceSheet.assets.map((account) => (
                                <div key={account.accountId} className="flex justify-between py-2 border-b border-gray-100">
                                    <span className="text-sm text-gray-700">{account.accountName}</span>
                                    <span className="text-sm font-mono">${account.balance.toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between py-3 mt-2 border-t-2 border-gray-300 font-bold">
                                <span>Total Assets</span>
                                <span className="font-mono">${balanceSheet.totalAssets.toFixed(2)}</span>
                            </div>
                        </div>

                        {/* Liabilities & Equity */}
                        <div>
                            <h3 className="text-lg font-bold text-gray-900 mb-4 border-b-2 border-gray-300 pb-2">LIABILITIES</h3>
                            {balanceSheet.liabilities.map((account) => (
                                <div key={account.accountId} className="flex justify-between py-2 border-b border-gray-100">
                                    <span className="text-sm text-gray-700">{account.accountName}</span>
                                    <span className="text-sm font-mono">${account.balance.toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between py-2 mt-2 font-semibold text-gray-800">
                                <span>Total Liabilities</span>
                                <span className="font-mono">${balanceSheet.totalLiabilities.toFixed(2)}</span>
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 mb-4 mt-6 border-b-2 border-gray-300 pb-2">EQUITY</h3>
                            {balanceSheet.equity.map((account) => (
                                <div key={account.accountId} className="flex justify-between py-2 border-b border-gray-100">
                                    <span className="text-sm text-gray-700">{account.accountName}</span>
                                    <span className="text-sm font-mono">${account.balance.toFixed(2)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between py-2 border-b border-gray-100">
                                <span className="text-sm text-gray-700">Net Income (Current Period)</span>
                                <span className="text-sm font-mono">${balanceSheet.netIncome.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between py-2 mt-2 font-semibold text-gray-800">
                                <span>Total Equity</span>
                                <span className="font-mono">${balanceSheet.totalEquity.toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between py-3 mt-4 border-t-2 border-gray-300 font-bold">
                                <span>Total Liabilities & Equity</span>
                                <span className="font-mono">${totalLiabilitiesAndEquity.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t-2 border-gray-300 text-center">
                        {isBalanced ? (
                            <span className="text-green-600 font-semibold">
                                ✓ Balance Sheet is balanced (Assets = Liabilities + Equity)
                            </span>
                        ) : (
                            <span className="text-red-600 font-semibold">
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
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Profit & Loss Statement</h2>
                            <p className="text-gray-600 mt-1">
                                {new Date(plStartDate).toLocaleDateString()} - {new Date(plEndDate).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                                <input
                                    type="date"
                                    value={plStartDate}
                                    onChange={(e) => setPlStartDate(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-600 mb-1">End Date</label>
                                <input
                                    type="date"
                                    value={plEndDate}
                                    onChange={(e) => setPlEndDate(e.target.value)}
                                    className="px-3 py-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                            <button
                                onClick={loadReport}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 self-end"
                            >
                                Generate
                            </button>
                        </div>
                    </div>

                    {/* Revenue */}
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 border-b-2 border-gray-300 pb-2">REVENUE</h3>
                        {profitLoss.revenue.map((account) => (
                            <div key={account.accountId} className="flex justify-between py-2 border-b border-gray-100">
                                <span className="text-sm text-gray-700">{account.accountName}</span>
                                <span className="text-sm font-mono">${account.balance.toFixed(2)}</span>
                            </div>
                        ))}
                        {profitLoss.otherIncome.length > 0 && (
                            <>
                                <div className="mt-4 mb-2 text-sm font-semibold text-gray-700">Other Income:</div>
                                {profitLoss.otherIncome.map((account) => (
                                    <div key={account.accountId} className="flex justify-between py-2 border-b border-gray-100">
                                        <span className="text-sm text-gray-700 pl-4">{account.accountName}</span>
                                        <span className="text-sm font-mono">${account.balance.toFixed(2)}</span>
                                    </div>
                                ))}
                            </>
                        )}
                        <div className="flex justify-between py-3 mt-2 border-t-2 border-gray-300 font-bold">
                            <span>Total Revenue</span>
                            <span className="font-mono text-green-600">${profitLoss.totalRevenue.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Expenses */}
                    <div className="mb-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 border-b-2 border-gray-300 pb-2">EXPENSES</h3>
                        {profitLoss.expenses.map((account) => (
                            <div key={account.accountId} className="flex justify-between py-2 border-b border-gray-100">
                                <span className="text-sm text-gray-700">{account.accountName}</span>
                                <span className="text-sm font-mono">${account.balance.toFixed(2)}</span>
                            </div>
                        ))}
                        {profitLoss.otherExpense.length > 0 && (
                            <>
                                <div className="mt-4 mb-2 text-sm font-semibold text-gray-700">Other Expenses:</div>
                                {profitLoss.otherExpense.map((account) => (
                                    <div key={account.accountId} className="flex justify-between py-2 border-b border-gray-100">
                                        <span className="text-sm text-gray-700 pl-4">{account.accountName}</span>
                                        <span className="text-sm font-mono">${account.balance.toFixed(2)}</span>
                                    </div>
                                ))}
                            </>
                        )}
                        <div className="flex justify-between py-3 mt-2 border-t-2 border-gray-300 font-bold">
                            <span>Total Expenses</span>
                            <span className="font-mono text-red-600">${profitLoss.totalExpenses.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Net Income */}
                    <div className="border-t-4 border-gray-900 pt-4">
                        <div className="flex justify-between py-3 text-xl font-bold">
                            <span>NET INCOME</span>
                            <span className={`font-mono ${profitLoss.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {profitLoss.netIncome >= 0 ? '+' : '-'}${Math.abs(profitLoss.netIncome).toFixed(2)}
                            </span>
                        </div>
                        <p className="text-sm text-gray-600 text-center mt-2">
                            {profitLoss.netIncome >= 0 ? '🎉 Profitable' : '⚠️ Operating at a loss'}
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
                    <p className="text-gray-600 mt-1">View accounting reports and financial statements</p>
                </div>
                <button
                    onClick={handleRefreshGL}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                    Refresh GL
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                    {error}
                </div>
            )}

            {/* Report Selector */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                <div className="flex gap-4">
                    <button
                        onClick={() => setSelectedReport('trial_balance')}
                        className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                            selectedReport === 'trial_balance'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        Trial Balance
                    </button>
                    <button
                        onClick={() => setSelectedReport('balance_sheet')}
                        className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                            selectedReport === 'balance_sheet'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        Balance Sheet
                    </button>
                    <button
                        onClick={() => setSelectedReport('profit_loss')}
                        className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                            selectedReport === 'profit_loss'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                        Profit & Loss
                    </button>
                </div>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="flex items-center justify-center h-64">
                    <div className="text-gray-600">Generating report...</div>
                </div>
            )}

            {/* Report Content */}
            {!loading && (
                <>
                    {selectedReport === 'trial_balance' && renderTrialBalance()}
                    {selectedReport === 'balance_sheet' && renderBalanceSheet()}
                    {selectedReport === 'profit_loss' && renderProfitLoss()}
                </>
            )}
        </div>
    );
}
