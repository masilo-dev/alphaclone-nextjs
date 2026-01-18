import React from 'react';
import { Button, Badge } from '../ui/UIComponents';
import { CreditCard, CheckCircle } from 'lucide-react';
import { User, Invoice } from '../../types';

interface FinanceTabProps {
    user: User;
    filteredInvoices: Invoice[];
    handlePayClick: (invoice: Invoice) => void;
    onCreateInvoice?: () => void;
}

const FinanceTab: React.FC<FinanceTabProps> = ({ user, filteredInvoices, handlePayClick, onCreateInvoice }) => {
    const totalRevenue = filteredInvoices.filter(i => i.status === 'Paid').reduce((acc, curr) => acc + curr.amount, 0);
    const outstanding = filteredInvoices.filter(i => i.status !== 'Paid').reduce((acc, curr) => acc + curr.amount, 0);
    const paidCount = filteredInvoices.filter(i => i.status === 'Paid').length;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <CreditCard className="w-6 h-6 text-teal-400" /> Financial Center
                </h2>
                {user.role === 'admin' && <Button onClick={onCreateInvoice}>Create Invoice</Button>}
            </div>

            {/* Financial Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                    <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Total Revenue</p>
                    <p className="text-2xl font-bold text-white">${totalRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                    <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Outstanding</p>
                    <p className="text-2xl font-bold text-orange-400">${outstanding.toLocaleString()}</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                    <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Paid Invoices</p>
                    <p className="text-2xl font-bold text-teal-400">{paidCount}</p>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-400">
                    <thead className="bg-slate-950 text-xs uppercase font-semibold text-slate-500">
                        <tr>
                            <th className="px-6 py-4">Invoice ID</th>
                            <th className="px-6 py-4">Project / Description</th>
                            <th className="px-6 py-4">Amount</th>
                            <th className="px-6 py-4">Due Date</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {filteredInvoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4 font-mono text-xs text-white">#{inv.id.toUpperCase()}</td>
                                <td className="px-6 py-4">
                                    <div className="text-white font-medium">{inv.projectName}</div>
                                    <div className="text-xs text-slate-500">{inv.description}</div>
                                </td>
                                <td className="px-6 py-4 text-white font-bold">${inv.amount.toLocaleString()}</td>
                                <td className="px-6 py-4">{inv.dueDate}</td>
                                <td className="px-6 py-4">
                                    <Badge variant={inv.status === 'Paid' ? 'success' : inv.status === 'Overdue' ? 'error' : 'warning'}>
                                        {inv.status}
                                    </Badge>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {inv.status !== 'Paid' && user.role === 'client' && (
                                        <Button size="sm" onClick={() => handlePayClick(inv)}>
                                            Pay Now
                                        </Button>
                                    )}
                                    {inv.status === 'Paid' && (
                                        <span className="text-green-500 text-xs font-bold flex items-center justify-end gap-1">
                                            <CheckCircle className="w-3 h-3" /> Paid
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {filteredInvoices.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                    No invoices found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FinanceTab;
