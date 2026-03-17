import React, { useState } from 'react';
import {
  Building2,
  Users,
  CreditCard,
  Settings,
  Palette,
  Mail,
  UserPlus,
  Trash2,
  Save,
  Loader2
} from 'lucide-react';
import { useTenant, useTenantRole } from '../../contexts/TenantContext';
import { tenantService } from '../../services/tenancy/TenantService';

type Tab = 'general' | 'team' | 'billing' | 'branding';

export default function TenantSettings() {
  const { currentTenant, refreshTenants } = useTenant();
  const userRole = useTenantRole();
  const [activeTab, setActiveTab] = useState<Tab>('general');

  const isAdmin = userRole === 'admin' || userRole === 'owner';

  if (!currentTenant) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-slate-400">No active business selected</p>
      </div>
    );
  }

  const tabs = [
    { id: 'general' as Tab, label: 'General', icon: Settings },
    { id: 'team' as Tab, label: 'Team', icon: Users },
    { id: 'billing' as Tab, label: 'Billing', icon: CreditCard },
    { id: 'branding' as Tab, label: 'Branding', icon: Palette },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Business Settings</h1>
        <p className="text-slate-400">Manage your business profile, team, and preferences</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors relative ${activeTab === tab.id
              ? 'text-teal-400'
              : 'text-slate-400 hover:text-slate-300'
              }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-400" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {activeTab === 'general' && <GeneralSettings tenant={currentTenant} isAdmin={isAdmin} onUpdate={refreshTenants} />}
        {activeTab === 'team' && <TeamSettings tenant={currentTenant} isAdmin={isAdmin} />}
        {activeTab === 'billing' && <BillingSettings tenant={currentTenant} isAdmin={isAdmin} />}
        {activeTab === 'branding' && <BrandingSettings tenant={currentTenant} isAdmin={isAdmin} onUpdate={refreshTenants} />}
      </div>
    </div>
  );
}

function GeneralSettings({ tenant, isAdmin, onUpdate }: any) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(tenant.name);
  const [description, setDescription] = useState(tenant.settings?.description || '');
  const [billingEmail, setBillingEmail] = useState(tenant.settings?.billing_email || '');

  const handleSave = async () => {
    try {
      setIsSaving(true);

      await tenantService.updateTenant(tenant.id, {
        name,
        settings: {
          ...tenant.settings,
          description,
          billing_email: billingEmail
        }
      });

      await onUpdate();
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBillingEmailChange = (email: string) => {
    // Local state update if needed, but for now we are using the main save
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Business Information</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Business Name
            </label>
            {isEditing && isAdmin ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
              />
            ) : (
              <p className="text-white">{tenant.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Business URL
            </label>
            <div className="flex items-center gap-2">
              <code className="px-3 py-2 bg-slate-900/50 border border-slate-600 rounded text-slate-300">
                {tenant.slug}.alphaclone.com
              </code>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              URL cannot be changed after creation
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Billing Email
            </label>
            {isEditing && isAdmin ? (
              <input
                type="email"
                value={billingEmail}
                onChange={(e) => setBillingEmail(e.target.value)}
                placeholder="invoices@example.com"
                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
              />
            ) : (
              <p className="text-white">{billingEmail || 'Same as admin email'}</p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              Invoices and payment receipts will be sent here
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Description
            </label>
            {isEditing && isAdmin ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
                placeholder="Tell us about your business..."
              />
            ) : (
              <p className="text-slate-400">{description || 'No description yet'}</p>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="mt-6 flex gap-3">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setName(tenant.name);
                    setDescription(tenant.settings?.description || '');
                    setBillingEmail(tenant.settings?.billing_email || '');
                  }}
                  disabled={isSaving}
                  className="px-4 py-2 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                Edit Information
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamSettings({ tenant, isAdmin }: any) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'client'>('member');
  const [isInviting, setIsInviting] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    loadTeamMembers();
  }, [tenant.id]);

  const loadTeamMembers = async () => {
    try {
      setIsLoading(true);
      const members = await tenantService.getTenantUsers(tenant.id);
      setTeamMembers(members);
    } catch (error) {
      console.error('Failed to load team:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;

    try {
      setIsInviting(true);

      // TODO: Implement invitation sending
      // await tenantService.createInvitation(tenant.id, inviteEmail, inviteRole, userId);

      setInviteEmail('');
      alert('Invitation sent!');
    } catch (error) {
      console.error('Failed to send invitation:', error);
      alert('Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Invite Section */}
      {isAdmin && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-teal-400" />
            Invite Team Members
          </h2>

          <div className="flex gap-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="flex-1 px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
            />

            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
              className="px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
            >
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="client">Client</option>
            </select>

            <button
              onClick={handleInvite}
              disabled={isInviting || !inviteEmail.trim()}
              className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isInviting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Send Invite
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-slate-500 mt-2">
            They'll receive an email invitation to join your business
          </p>
        </div>
      )}

      {/* Team Members List */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Team Members ({teamMembers.length})</h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : teamMembers.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No team members yet</p>
        ) : (
          <div className="space-y-3">
            {teamMembers.map((member: any) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold">
                    {member.user?.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div className="text-white font-medium">{member.user?.name || 'Unknown'}</div>
                    <div className="text-sm text-slate-400">{member.user?.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${member.role === 'admin'
                    ? 'bg-purple-500/20 text-purple-300'
                    : member.role === 'member'
                      ? 'bg-blue-500/20 text-blue-300'
                      : 'bg-slate-600 text-slate-300'
                    }`}>
                    {member.role}
                  </span>

                  {isAdmin && member.role !== 'owner' && (
                    <button className="p-2 text-slate-400 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BillingSettings({ tenant, isAdmin }: any) {
  const currentPlan = tenant.subscription_plan || 'free';
  const isCanceled = tenant.cancel_at_period_end;
  const isPaidPlan = currentPlan !== 'free';
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handleSubscriptionAction = async (action: 'cancel_at_period_end' | 'resume') => {
    if (!confirm(action === 'cancel_at_period_end'
      ? 'Are you sure you want to cancel? You will retain access until the end of the current billing period.'
      : 'Resume your subscription?')) return;

    try {
      setLoadingAction(action);
      const response = await fetch('/api/stripe/manage-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id, action }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to update subscription');

      // Reload page to reflect changes (or use a refresh context if available)
      window.location.reload();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Current Plan</h2>

        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold text-white capitalize">{currentPlan}</div>
              {isCanceled && (
                <span className="px-2 py-1 bg-amber-500/10 text-amber-500 text-xs rounded-full border border-amber-500/20">
                  Cancels at period end
                </span>
              )}
            </div>
            <div className="text-slate-400">
              {currentPlan === 'free' ? 'Free forever' : `$${currentPlan === 'starter' ? 25 : currentPlan === 'pro' ? 89 : 200}/month`}
            </div>
          </div>

          {isAdmin && (
            <div className="flex gap-2">
              {isPaidPlan && (
                isCanceled ? (
                  <button
                    onClick={() => handleSubscriptionAction('resume')}
                    disabled={!!loadingAction}
                    className="px-4 py-2 bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 border border-teal-500/20 rounded-lg transition-colors flex items-center gap-2"
                  >
                    {loadingAction === 'resume' && <Loader2 className="w-4 h-4 animate-spin" />}
                    Resume Subscription
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubscriptionAction('cancel_at_period_end')}
                    disabled={!!loadingAction}
                    className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2"
                  >
                    {loadingAction === 'cancel_at_period_end' && <Loader2 className="w-4 h-4 animate-spin" />}
                    Cancel Subscription
                  </button>
                )
              )}
              <button className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors">
                {currentPlan === 'free' ? 'Upgrade Plan' : 'Change Plan'}
              </button>
            </div>
          )}
        </div>

        <div className="text-sm text-slate-400 border-t border-slate-700 pt-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-slate-500 mb-1">Billing Status</p>
              <p className="text-white font-medium capitalize">{tenant.subscription_status || 'Active'}</p>
            </div>
            <div>
              <p className="text-slate-500 mb-1">Current Period Ends</p>
              <p className="text-white font-medium">
                {tenant.current_period_end
                  ? new Date(tenant.current_period_end).toLocaleDateString()
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Payment Method</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-700 rounded">
                <CreditCard className="w-6 h-6 text-slate-300" />
              </div>
              <div>
                <p className="text-white font-medium">Stripe Secure Payment</p>
                <p className="text-xs text-slate-400">Managed via Stripe</p>
              </div>
            </div>
            <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm">
              Update Card
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BrandingSettings({ tenant, isAdmin, onUpdate }: any) {
  const [logoUrl, setLogoUrl] = useState(tenant.logo_url || '');
  const [brandColor, setBrandColor] = useState(tenant.settings?.brand_color || '#14b8a6');

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Brand Customization</h2>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Logo URL
            </label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              disabled={!isAdmin}
              placeholder="https://example.com/logo.png"
              className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Brand Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                disabled={!isAdmin}
                className="w-16 h-10 rounded cursor-pointer disabled:opacity-50"
              />
              <input
                type="text"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                disabled={!isAdmin}
                className="flex-1 px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500 disabled:opacity-50"
              />
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="mt-6">
            <button className="px-6 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors flex items-center gap-2">
              <Save className="w-4 h-4" />
              Save Branding
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
