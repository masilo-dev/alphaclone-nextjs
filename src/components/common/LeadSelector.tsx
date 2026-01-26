import React, { useEffect, useState } from 'react';
import { Search, ChevronDown, UserPlus, ExternalLink } from 'lucide-react';
import { leadService, Lead } from '../../services/leadService';

interface LeadSelectorProps {
    onSelect: (lead: Lead) => void;
    filter?: 'all' | 'qualified' | 'unqualified';
    placeholder?: string;
    className?: string;
}

const LeadSelector: React.FC<LeadSelectorProps> = ({
    onSelect,
    filter = 'all',
    placeholder = 'Select a lead...',
    className = ''
}) => {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadLeads();
    }, [filter]);

    const loadLeads = async () => {
        setLoading(true);
        const { leads: data, error } = await leadService.getLeads();
        if (!error) {
            let filteredLeads = data;
            if (filter === 'qualified') {
                filteredLeads = data.filter(l => l.stage === 'qualified' || l.status === 'Qualified');
            } else if (filter === 'unqualified') {
                filteredLeads = data.filter(l => l.stage === 'lead' || !l.stage);
            }
            setLeads(filteredLeads);
        }
        setLoading(false);
    };

    const filteredLeads = leads.filter(lead =>
        lead.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.industry?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelect = (lead: Lead) => {
        setSelectedLead(lead);
        setIsOpen(false);
        setSearchQuery('');
        onSelect(lead);
    };

    return (
        <div className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white hover:bg-slate-700 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-slate-400" />
                    <span className="text-sm">
                        {selectedLead ? selectedLead.businessName : placeholder}
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Dropdown Content */}
                    <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-20 max-h-96 overflow-hidden flex flex-col">
                        {/* Search */}
                        <div className="p-3 border-b border-slate-800">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search leads..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-teal-500"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Leads List */}
                        <div className="overflow-y-auto flex-1">
                            {loading ? (
                                <div className="p-4 text-center text-slate-400 text-sm">
                                    Loading leads...
                                </div>
                            ) : filteredLeads.length === 0 ? (
                                <div className="p-4 text-center">
                                    <p className="text-slate-400 text-sm mb-2">No leads found</p>
                                    <a
                                        href="/dashboard/sales-agent"
                                        className="text-teal-400 text-xs hover:underline flex items-center justify-center gap-1"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        Go to Sales Agent
                                    </a>
                                </div>
                            ) : (
                                filteredLeads.map((lead) => (
                                    <button
                                        key={lead.id}
                                        onClick={() => handleSelect(lead)}
                                        className="w-full px-4 py-3 hover:bg-slate-800 transition-colors text-left border-b border-slate-800 last:border-0"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-white font-medium text-sm truncate">
                                                    {lead.businessName}
                                                </h4>
                                                <p className="text-slate-400 text-xs truncate">
                                                    {lead.email || lead.phone || 'No contact info'}
                                                </p>
                                            </div>
                                            {lead.industry && (
                                                <span className="ml-2 px-2 py-1 bg-slate-800 text-slate-400 text-[10px] rounded-full whitespace-nowrap">
                                                    {lead.industry}
                                                </span>
                                            )}
                                        </div>
                                        {lead.location && (
                                            <p className="text-slate-500 text-[10px] mt-1">
                                                {lead.location}
                                            </p>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-3 border-t border-slate-800 bg-slate-950">
                            <p className="text-slate-500 text-[10px] text-center">
                                {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''} available
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default LeadSelector;
