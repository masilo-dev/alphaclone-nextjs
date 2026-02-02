import React from 'react';
import { Button, Badge } from '../ui/UIComponents';
import { CreditCard, CheckCircle, Download, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { User, Invoice } from '../../types';
import { paymentService } from '../../services/paymentService';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

    // Mock Expenses for MVP Polish
    const totalExpenses = 4500;
    const netProfit = totalRevenue - totalExpenses;

    // Prepare Chart Data
    const chartData = React.useMemo(() => {
        const last6Months = Array.from({ length: 6 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            return d.toLocaleString('default', { month: 'short' });
        }).reverse();

        return last6Months.map(month => ({
            name: month,
            revenue: Math.floor(Math.random() * 5000) + 1000 + (totalRevenue / 12), // Mock distribution + actual baseline
            expenses: Math.floor(Math.random() * 2000) + 500
        }));
    }, [totalRevenue]);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <CreditCard className="w-6 h-6 text-teal-400" /> Financial Center
                </h2>
                {(user.role === 'admin' || user.role === 'tenant_admin') && <Button onClick={onCreateInvoice}>Create Invoice</Button>}
            </div>



            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Financial Summary Cards */}
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                        <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Total Revenue</p>
                        <p className="text-2xl font-bold text-white">${totalRevenue.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                        <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Outstanding</p>
                        <p className="text-2xl font-bold text-orange-400">${outstanding.toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                        <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Expenses (Est)</p>
                        <p className="text-2xl font-bold text-red-400 flex items-center gap-2">
                            ${totalExpenses.toLocaleString()}
                            <span className="text-xs text-slate-500 font-normal bg-slate-800 px-1.5 py-0.5 rounded">Placeholder</span>
                        </p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <DollarSign className="w-12 h-12 text-teal-400" />
                        </div>
                        <p className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Net Profit</p>
                        <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                            ${netProfit.toLocaleString()}
                        </p>
                    </div>
                </div>

                {/* Chart Section */}
                <div className="lg:col-span-3 bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-teal-400" /> Revenue vs Expenses
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
                                    itemStyle={{ color: '#e2e8f0' }}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#14b8a6" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
                                <Area type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpenses)" name="Expenses" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
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
                                <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => paymentService.downloadInvoicePDF(inv.id)}
                                        title="Download PDF"
                                    >
                                        <Download className="w-4 h-4" />
                                    </Button>
                                    {inv.status !== 'Paid' && user.role === 'client' && (
                                        <Button size="sm" onClick={() => handlePayClick(inv)}>
                                            Pay Now
                                        </Button>
                                    )}
                                    {inv.status === 'Paid' && (
                                        <span className="text-green-500 text-xs font-bold flex items-center gap-1">
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
        </div >
    );
};

export default FinanceTab;
