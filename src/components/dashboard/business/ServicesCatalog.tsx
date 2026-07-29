'use client';

import React, { useState } from 'react';
import { 
    Plus, Search, Edit2, Trash2, Package, DollarSign, 
    ChevronRight, Save, X, Layers, Briefcase, Clock 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useServicesCatalog, ServiceItem } from '../../../hooks/useServicesCatalog';
import { Button, Card, Input } from '../../ui/UIComponents';
import toast from 'react-hot-toast';

export const ServicesCatalog: React.FC = () => {
    const { services, addService, updateService, deleteService } = useServicesCatalog();
    const [searchTerm, setSearchTerm] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<Omit<ServiceItem, 'id'>>({
        name: '',
        description: '',
        defaultPrice: 0,
        unit: 'flat'
    });

    const filteredServices = services.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

<<<<<<< HEAD
    const handleSubmit = async (e: React.FormEvent) => {
=======
    const handleSubmit = (e: React.FormEvent) => {
>>>>>>> origin/main
        e.preventDefault();
        if (!form.name) {
            toast.error("Service name is required");
            return;
        }

<<<<<<< HEAD
        try {
            if (editingId) {
                await updateService(editingId, form);
                toast.success("Service updated");
                setEditingId(null);
            } else {
                await addService(form);
                toast.success("Service added to catalog");
                setIsAdding(false);
            }
            setForm({ name: '', description: '', defaultPrice: 0, unit: 'flat' });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to save service';
            toast.error(message);
        }
=======
        if (editingId) {
            updateService(editingId, form);
            toast.success("Service updated");
            setEditingId(null);
        } else {
            addService(form);
            toast.success("Service added to catalog");
            setIsAdding(false);
        }

        setForm({ name: '', description: '', defaultPrice: 0, unit: 'flat' });
>>>>>>> origin/main
    };

    const startEdit = (service: ServiceItem) => {
        setEditingId(service.id);
        setForm({
            name: service.name,
            description: service.description,
            defaultPrice: service.defaultPrice,
            unit: service.unit
        });
        setIsAdding(true);
    };

    const cancelEdit = () => {
        setIsAdding(false);
        setEditingId(null);
        setForm({ name: '', description: '', defaultPrice: 0, unit: 'flat' });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                        <Package className="text-teal-500 w-5 h-5" /> Services Catalog
                    </h2>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                        Reusable line items for fast invoicing
                    </p>
                </div>
                {!isAdding && (
                    <Button 
                        onClick={() => setIsAdding(true)} 
                        className="bg-teal-600 hover:bg-teal-500 text-white gap-2 h-10 px-6"
                    >
                        <Plus size={16} /> Add Service
                    </Button>
                )}
            </div>

            <AnimatePresence mode="wait">
                {isAdding ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        <Card className="p-6 bg-slate-900/60 border-teal-500/20">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Service Name</label>
                                        <Input 
                                            value={form.name} 
                                            onChange={e => setForm({...form, name: e.target.value})}
                                            placeholder="e.g. Website Design"
                                            className="bg-slate-950 border-slate-800"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Unit</label>
                                        <select 
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-teal-500"
                                            value={form.unit}
                                            onChange={e => setForm({...form, unit: e.target.value})}
                                        >
                                            <option value="flat">Flat Rate</option>
                                            <option value="hour">Per Hour</option>
                                            <option value="day">Per Day</option>
                                            <option value="month">Per Month</option>
                                            <option value="project">Per Project</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Description</label>
                                    <textarea 
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:border-teal-500 min-h-[100px]"
                                        value={form.description}
                                        onChange={e => setForm({...form, description: e.target.value})}
                                        placeholder="What does this service include?"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Default Price</label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                        <input 
                                            type="number"
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-slate-200 focus:outline-none focus:border-teal-500"
                                            value={form.defaultPrice}
                                            onChange={e => setForm({...form, defaultPrice: parseFloat(e.target.value) || 0})}
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <Button type="submit" className="flex-1 bg-teal-600 hover:bg-teal-500">
                                        {editingId ? 'Update Service' : 'Save to Catalog'}
                                    </Button>
                                    <Button variant="outline" onClick={cancelEdit} className="border-slate-800 text-slate-400">
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        </Card>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-4"
                    >
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                            <input 
                                type="text"
                                placeholder="Search services..."
                                className="w-full bg-slate-900/40 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-teal-500/50 transition-all"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredServices.map((service) => (
                                <Card key={service.id} className="group p-5 bg-slate-900/40 border-white/5 hover:bg-white/[0.03] transition-all relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-teal-500/20 group-hover:bg-teal-500 transition-all" />
                                    
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-black text-white uppercase tracking-tight">{service.name}</h3>
                                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1 mt-1">
                                                <Clock className="w-3 h-3" /> {service.unit}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => startEdit(service)}
                                                className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-teal-400 hover:bg-teal-400/10 transition-all"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button 
<<<<<<< HEAD
                                                onClick={async () => {
                                                    if (!confirm("Are you sure?")) return;
                                                    try {
                                                        await deleteService(service.id);
                                                        toast.success("Service removed");
                                                    } catch (err: unknown) {
                                                        const message = err instanceof Error ? err.message : 'Failed to delete';
                                                        toast.error(message);
                                                    }
=======
                                                onClick={() => {
                                                    if (confirm("Are you sure?")) deleteService(service.id);
>>>>>>> origin/main
                                                }}
                                                className="p-2 bg-white/5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 transition-all"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <p className="text-sm text-slate-400 line-clamp-2 mb-4 h-10">
                                        {service.description || 'No description provided.'}
                                    </p>
                                    
                                    <div className="flex justify-between items-center pt-4 border-t border-white/5">
                                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Base Rate</span>
                                        <span className="text-lg font-black text-teal-400">${service.defaultPrice.toLocaleString()}</span>
                                    </div>
                                </Card>
                            ))}

                            {filteredServices.length === 0 && (
                                <div className="col-span-full py-12 text-center bg-slate-900/20 rounded-3xl border border-dashed border-slate-800">
                                    <Package className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">
                                        {searchTerm ? "No services match your search" : "Your catalog is empty"}
                                    </p>
                                    {!searchTerm && (
                                        <button 
                                            onClick={() => setIsAdding(true)}
                                            className="text-teal-400 text-xs font-black uppercase tracking-widest mt-4 hover:text-teal-300 underline underline-offset-4"
                                        >
                                            Add your first service
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
