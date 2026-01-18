import React, { useState } from 'react';
import { Building2, ChevronDown, Check, Plus, Loader2 } from 'lucide-react';
import { useTenant } from '../../contexts/TenantContext';
import { useRouter } from 'next/navigation';

export default function TenantSwitcher() {
  const { currentTenant, userTenants, switchTenant, isLoading } = useTenant();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const router = useRouter();

  const handleSwitchTenant = async (tenantId: string) => {
    if (tenantId === currentTenant?.id) {
      setIsOpen(false);
      return;
    }

    try {
      setIsSwitching(true);
      await switchTenant(tenantId);
      // Page will reload automatically
    } catch (error) {
      console.error('Failed to switch tenant:', error);
      setIsSwitching(false);
    }
  };

  const handleCreateNew = () => {
    setIsOpen(false);
    router.push('/onboarding/create-business');
  };

  if (isLoading || !currentTenant) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg">
        <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
        <span className="text-sm text-slate-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors w-full max-w-xs"
      >
        <Building2 className="w-5 h-5 text-teal-400" />
        <div className="flex-1 text-left">
          <div className="text-sm font-medium text-white truncate">
            {currentTenant.name}
          </div>
          {userTenants.length > 1 && (
            <div className="text-xs text-slate-400">
              {userTenants.length} organizations
            </div>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute top-full left-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-700">
              <h3 className="text-sm font-semibold text-white">Switch Organization</h3>
              <p className="text-xs text-slate-400 mt-1">
                Select an organization to view its data
              </p>
            </div>

            {/* Tenant List */}
            <div className="max-h-96 overflow-y-auto">
              {userTenants.map((tenant) => {
                const isActive = tenant.id === currentTenant?.id;
                const tenantRole = tenant.role;

                return (
                  <button
                    key={tenant.id}
                    onClick={() => handleSwitchTenant(tenant.id)}
                    disabled={isSwitching}
                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-700/50 transition-colors ${isActive ? 'bg-slate-700/30' : ''
                      } ${isSwitching ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {/* Tenant Avatar/Icon */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold ${isActive
                      ? 'bg-gradient-to-br from-teal-500 to-teal-600 text-white'
                      : 'bg-slate-700 text-slate-300'
                      }`}>
                      {tenant.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Tenant Info */}
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-slate-300'
                          }`}>
                          {tenant.name}
                        </span>
                        {isActive && (
                          <Check className="w-4 h-4 text-teal-400 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${tenantRole === 'admin'
                          ? 'bg-purple-500/20 text-purple-300'
                          : tenantRole === 'member'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-slate-600 text-slate-300'
                          }`}>
                          {tenantRole}
                        </span>
                        <span className="text-xs text-slate-500 truncate">
                          {tenant.slug}
                        </span>
                      </div>
                    </div>

                    {/* Switching Indicator */}
                    {isSwitching && tenant.id !== currentTenant?.id && (
                      <Loader2 className="w-4 h-4 text-slate-400 animate-spin flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Create New Button */}
            <div className="border-t border-slate-700 p-2">
              <button
                onClick={handleCreateNew}
                disabled={isSwitching}
                className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-teal-400 hover:bg-slate-700/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                <span className="font-medium">Create New Organization</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
