
import React, { useState, useEffect } from 'react';
import { useTenant } from '../../../contexts/TenantContext';
import { fileUploadService } from '../../../services/fileUploadService';
import { Button } from '../../ui/UIComponents';
import { Loader2, Upload, Save, Building, Palette, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { Tenant } from '../../../services/tenancy/types';
import { tenantService } from '../../../services/tenancy/TenantService';
import { logoService } from '@/services/logoService';
import Image from 'next/image';

const BrandingSettings = () => {
    const { currentTenant, refreshTenants } = useTenant();
    const [loading, setLoading] = useState(false);
    const settingsBranding = (currentTenant?.settings?.branding || {}) as Record<string, unknown>;

    // Form State
    const [branding, setBranding] = useState<any>({
        brand_color_primary: currentTenant?.brand_color_primary || String(settingsBranding.brand_color_primary || settingsBranding.primaryColor || '#0d9488'),
        brand_color_secondary: currentTenant?.brand_color_secondary || String(settingsBranding.brand_color_secondary || settingsBranding.secondaryColor || '#0f172a'),
        logo_url: currentTenant?.logo_url || String(settingsBranding.logo_url || settingsBranding.logo || ''),
        legal_name: currentTenant?.legal_name || String(settingsBranding.legal_name || ''),
        tax_id: currentTenant?.tax_id || String(settingsBranding.tax_id || ''),
        business_address: currentTenant?.business_address || String(settingsBranding.business_address || settingsBranding.address || '')
    });

    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!currentTenant) return;
        const nextBranding = (currentTenant.settings?.branding || {}) as Record<string, unknown>;
        setBranding({
            brand_color_primary: currentTenant.brand_color_primary || String(nextBranding.brand_color_primary || nextBranding.primaryColor || '#0d9488'),
            brand_color_secondary: currentTenant.brand_color_secondary || String(nextBranding.brand_color_secondary || nextBranding.secondaryColor || '#0f172a'),
            logo_url: currentTenant.logo_url || String(nextBranding.logo_url || nextBranding.logo || ''),
            legal_name: currentTenant.legal_name || String(nextBranding.legal_name || ''),
            tax_id: currentTenant.tax_id || String(nextBranding.tax_id || ''),
            business_address: currentTenant.business_address || String(nextBranding.business_address || nextBranding.address || ''),
        });
    }, [currentTenant]);

    // Handle Logo Upload
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const { url, error } = await logoService.uploadLogo(file);
            if (error) throw new Error(error);

            setBranding({ ...branding, logo_url: url });
            toast.success('Logo updated successfully');
        } catch (err: any) {
            toast.error(err.message || 'Failed to upload logo');
        } finally {
            setIsUploading(false);
        }
    };

    // Save Changes
    const handleSave = async () => {
        if (!currentTenant?.id) return;
        setLoading(true);
        try {
            await tenantService.updateTenant(currentTenant.id, {
                legal_name: branding.legal_name,
                tax_id: branding.tax_id,
                business_address: branding.business_address,
                brand_color_primary: branding.brand_color_primary,
                brand_color_secondary: branding.brand_color_secondary,
                logo_url: branding.logo_url
            });
            await refreshTenants();
            toast.success("Branding settings updated");
        } catch (err) {
            console.error(err);
            toast.error("Failed to update settings");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Form Section */}
            <div className="space-y-6">
                <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Palette className="w-5 h-5 text-teal-400" />
                        Brand Identity
                    </h3>

                    {/* Logo */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-400 mb-2">Organization Logo</label>
                        <div className="flex items-center gap-4">
                            <div className="w-24 h-24 rounded-2xl bg-slate-950/50 border border-white/10 flex items-center justify-center overflow-hidden relative group">
                                {isUploading ? (
                                    <Loader2 className="w-6 h-6 text-teal-500 animate-spin" />
                                ) : branding.logo_url ? (
                                    <Image 
                                      src={branding.logo_url} 
                                      alt="Logo" 
                                      fill
                                      className="object-cover" 
                                      sizes="96px"
                                    />
                                ) : (
                                    <Building className="w-8 h-8 text-slate-700" />
                                )}
                                {!isUploading && (
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                    >
                                        <Upload className="w-5 h-5 text-white" />
                                    </button>
                                )}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleLogoUpload}
                                    accept="image/*"
                                    className="hidden"
                                />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 mt-2">Recommended: PNG or SVG, max 2MB.</p>
                            </div>
                        </div>
                    </div>

                    {/* Colors */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">Primary Color</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={branding.brand_color_primary}
                                    onChange={(e) => setBranding({ ...branding, brand_color_primary: e.target.value })}
                                    className="w-10 h-10 rounded-lg border-0 bg-transparent cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={branding.brand_color_primary}
                                    onChange={(e) => setBranding({ ...branding, brand_color_primary: e.target.value })}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">Secondary Color</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="color"
                                    value={branding.brand_color_secondary}
                                    onChange={(e) => setBranding({ ...branding, brand_color_secondary: e.target.value })}
                                    className="w-10 h-10 rounded-lg border-0 bg-transparent cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={branding.brand_color_secondary}
                                    onChange={(e) => setBranding({ ...branding, brand_color_secondary: e.target.value })}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Info className="w-5 h-5 text-teal-400" />
                        Legal Information
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Legal Business Name</label>
                            <input
                                type="text"
                                value={branding.legal_name}
                                onChange={(e) => setBranding({ ...branding, legal_name: e.target.value })}
                                className={`w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500/50 outline-none ${currentTenant?.legal_name ? 'opacity-60 cursor-not-allowed' : ''}`}
                                placeholder="Legal Entity Name"
                                disabled={!!currentTenant?.legal_name}
                            />
                            {currentTenant?.legal_name && (
                                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 italic">
                                    <Building className="w-3 h-3" /> Business identity is locked. Contact support to change.
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Tax ID / VAT Number</label>
                            <input
                                type="text"
                                value={branding.tax_id}
                                onChange={(e) => setBranding({ ...branding, tax_id: e.target.value })}
                                className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500/50 outline-none"
                                placeholder="e.g. US-123456789"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-1">Business Address</label>
                            <textarea
                                value={branding.business_address}
                                onChange={(e) => setBranding({ ...branding, business_address: e.target.value })}
                                className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500/50 outline-none min-h-[100px]"
                                placeholder="Full registered address..."
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} disabled={loading} className="bg-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-500/20">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Save Branding Settings
                    </Button>
                </div>
            </div>

            {/* Live Preview */}
            <div className="sticky top-6 h-fit">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Document Preview</h3>
                <div className="bg-white rounded-lg shadow-xl overflow-hidden aspect-[210/297] w-full max-w-md mx-auto relative text-slate-900 text-xs leading-relaxed">
                    {/* Header Background */}
                    <div className="h-4 w-full" style={{ backgroundColor: branding.brand_color_primary }}></div>

                    <div className="p-6">
                        {/* Header Content */}
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                {branding.logo_url ? (
                                    <div className="relative h-10 w-32 mb-2">
                                        <Image 
                                            src={branding.logo_url} 
                                            alt="Logo" 
                                            fill
                                            className="object-contain object-left" 
                                            sizes="128px"
                                        />
                                    </div>
                                ) : (
                                    <h1 className="text-xl font-bold mb-1" style={{ color: branding.brand_color_primary }}>
                                        {branding.legal_name || 'Organization Name'}
                                    </h1>
                                )}
                                <div className="text-slate-500">
                                    {branding.business_address || '123 Business St\nCity, Country'}
                                </div>
                            </div>
                            <div className="text-right">
                                <h2 className="text-2xl font-light text-slate-300">INVOICE</h2>
                                <div className="font-bold mt-1">#INV-001</div>
                            </div>
                        </div>

                        {/* Separator */}
                        <div className="h-0.5 w-full mb-6 opacity-20" style={{ backgroundColor: branding.brand_color_secondary }}></div>

                        <div className="space-y-3 text-xs text-slate-600 border border-dashed border-slate-200 rounded-lg p-4 bg-white/80">
                            <p className="text-xs uppercase tracking-wide text-slate-400 font-semibold">Sample line items (preview only)</p>
                            <div className="flex justify-between border-b border-slate-100 pb-2">
                                <span>Service description</span>
                                <span className="font-mono">0.00</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 pb-2">
                                <span>Subtotal</span>
                                <span className="font-mono">0.00</span>
                            </div>
                            <div className="flex justify-between font-medium text-slate-800">
                                <span>Total due</span>
                                <span className="font-mono">0.00</span>
                            </div>
                        </div>

                        {/* Footer Preview */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100 bg-slate-50">
                            <div className="text-center text-xs text-slate-400">
                                {branding.legal_name} • {branding.tax_id && `Tax ID: ${branding.tax_id}`}
                                <div className="mt-1 font-medium text-slate-300">Generated by AlphaClone Systems</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BrandingSettings;

