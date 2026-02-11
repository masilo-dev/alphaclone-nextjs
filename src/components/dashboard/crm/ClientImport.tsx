import React, { useState } from 'react';
import { Upload, X, FileText, Check, AlertCircle } from 'lucide-react';
import { Button, Modal } from '../../ui/UIComponents';
import { toast } from 'react-hot-toast';

interface ClientImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete: () => void;
}

export const ClientImportModal: React.FC<ClientImportModalProps> = ({ isOpen, onClose, onImportComplete }) => {
    const [dragActive, setDragActive] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const handleFile = (file: File) => {
        if (file.type === "text/csv" || file.name.endsWith('.csv') || file.name.endsWith('.xlsx')) {
            setFile(file);
        } else {
            toast.error("Please upload a CSV or Excel file");
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setIsUploading(true);

        // Simulating upload for now as the backend endpoint might not exist
        // In a real implementation, you would post the file to an API endpoint
        setTimeout(() => {
            setIsUploading(false);
            toast.success("Clients imported successfully (Simulation)");
            onImportComplete();
            onClose();
            setFile(null);
        }, 1500);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Import Clients" maxWidth="max-w-xl">
            <div className="space-y-4">
                <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragActive ? 'border-violet-500 bg-violet-500/10' : 'border-slate-700 hover:border-slate-600 bg-slate-900/50'
                        }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                >
                    <input
                        type="file"
                        className="hidden"
                        id="file-upload"
                        accept=".csv,.xlsx"
                        onChange={handleChange}
                    />

                    {!file ? (
                        <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                                <Upload className="w-6 h-6 text-slate-400" />
                            </div>
                            <div>
                                <p className="font-medium text-slate-300">Click to upload or drag and drop</p>
                                <p className="text-xs text-slate-500 mt-1">CSV or Excel files only</p>
                            </div>
                        </label>
                    ) : (
                        <div className="flex items-center justify-between bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-emerald-500" />
                                </div>
                                <div className="text-left">
                                    <p className="text-sm font-medium text-white max-w-[200px] truncate">{file.name}</p>
                                    <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                                </div>
                            </div>
                            <button
                                onClick={(e) => { e.preventDefault(); setFile(null); }}
                                className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
                    <div className="text-sm text-blue-300">
                        <p className="font-bold mb-1">CSV Format Required</p>
                        <p>Your file should have columns: Name, Email, Phone, Company, Stage, Value.</p>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button
                        variant="primary"
                        onClick={handleUpload}
                        disabled={!file || isUploading}
                        isLoading={isUploading}
                    >
                        Import Clients
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
