'use client';

import React, { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellOff, Smartphone, Check } from 'lucide-react';
import { User } from '@/types';
import { usePWA } from '@/contexts/PWAContext';
import { useTenant } from '@/contexts/TenantContext';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { usePwaPreferences } from '@/hooks/usePwaPreferences';
import {
  PWA_MAX_BOTTOM_SLOTS,
  PWA_MODULE_CATALOG,
  resolveBottomNavItems,
} from '@/config/pwaMobileNav';
import {
  NativeScreen,
  NativeScreenHeader,
  NativeSection,
  NativeListTile,
  NativeSwitch,
} from './native/NativeUi';

interface PwaSettingsScreenProps {
  user: User;
  onBack?: () => void;
}

export default function PwaSettingsScreen({ user, onBack }: PwaSettingsScreenProps) {
  const router = useRouter();
  const { currentTenant } = useTenant();
  const { isPWA } = usePWA();
  const { prefs, updatePrefs } = usePwaPreferences();
  const { pushSupported, isSubscribed, subscribeToPush, unsubscribeFromPush } = usePushNotifications();
  const [busy, setBusy] = useState(false);

  const handleBack = () => {
    if (onBack) onBack();
    else router.push('/dashboard');
  };

  const toggleModule = (moduleId: string) => {
    const current = prefs.bottomNavModuleIds;
    if (current.includes(moduleId)) {
      updatePrefs({ bottomNavModuleIds: current.filter((id) => id !== moduleId) });
      return;
    }
    if (current.length >= PWA_MAX_BOTTOM_SLOTS) return;
    updatePrefs({ bottomNavModuleIds: [...current, moduleId] });
  };

  const handlePushToggle = useCallback(
    async (enabled: boolean) => {
      setBusy(true);
      try {
        updatePrefs({ pushEnabled: enabled });
        if (enabled) {
          await subscribeToPush();
        } else {
          await unsubscribeFromPush();
        }
      } finally {
        setBusy(false);
      }
    },
    [subscribeToPush, unsubscribeFromPush, updatePrefs],
  );

  const preview = resolveBottomNavItems(user.role, prefs.bottomNavModuleIds, { isPwa: true });
  const permission =
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';

  return (
    <NativeScreen>
      <NativeScreenHeader title="Mobile app" onBack={handleBack} />

      <div className="px-4 py-4">
        <div className="native-hero-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/15 flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-teal-400" />
          </div>
          <div className="min-w-0">
            <p className="type-card-description font-semibold text-white">AlphaClone</p>
            <p className="type-card-description text-white/45 mt-0.5">
              {isPWA ? 'Installed app' : 'Mobile mode'} · {preview.map((p) => p.label).join(' · ')}
            </p>
          </div>
        </div>
      </div>

      <NativeSection title="Notifications">
        <NativeListTile
          icon={prefs.pushEnabled && isSubscribed ? <Bell className="w-5 h-5 text-teal-400" /> : <BellOff className="w-5 h-5 text-slate-500" />}
          title="Phone alerts"
          subtitle={
            !pushSupported
              ? 'Not supported by this browser'
              : permission === 'denied'
                ? 'Blocked in browser permissions'
                : isSubscribed
                  ? 'Active on this device'
                  : 'Tap toggle to activate'
          }
          trailing={
            <NativeSwitch
              checked={prefs.pushEnabled && (isSubscribed || permission === 'granted')}
              onChange={(v) => void handlePushToggle(v)}
              disabled={!pushSupported || permission === 'denied' || busy}
            />
          }
        />
        {permission === 'denied' ? (
          <div className="px-4 py-2.5 bg-amber-500/10 border-t border-amber-500/20 text-xs text-amber-300">
            Notifications are blocked. Open browser or system site settings and allow notifications for AlphaClone.
          </div>
        ) : null}

        {/* Test Alert Button */}
        {pushSupported && permission !== 'denied' ? (
          <div className="p-3 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-slate-400">Verify device delivery</span>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (!currentTenant?.id) {
                  alert('No active organization found.');
                  return;
                }
                setBusy(true);
                try {
                  const res = await fetch('/api/notifications/test-push', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tenantId: currentTenant.id }),
                  });
                  const data = await res.json();
                  alert(data.message || (data.success ? 'Test alert sent!' : 'Delivery test failed.'));
                } catch {
                  alert('Failed to send test push.');
                } finally {
                  setBusy(false);
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 text-xs font-semibold transition-colors"
            >
              Send test alert
            </button>
          </div>
        ) : null}
      </NativeSection>

      <NativeSection title="Alert categories">
        {(
          [
            { key: 'leads', label: 'Leads & CRM updates', sub: 'New leads, score changes & outreach' },
            { key: 'projects', label: 'Projects & tasks', sub: 'Milestones, assignments & blockers' },
            { key: 'billing', label: 'Invoices & payments', sub: 'Paid invoices and payment reminders' },
            { key: 'contracts', label: 'Contracts & signatures', sub: 'Executed agreements & sign requests' },
            { key: 'messages', label: 'Messages & Bonnie tasks', sub: 'Direct chats and automated reports' },
          ] as const
        ).map((cat) => (
          <NativeListTile
            key={cat.key}
            title={cat.label}
            subtitle={cat.sub}
            trailing={
              <NativeSwitch
                checked={prefs.categories?.[cat.key] ?? true}
                onChange={(v) =>
                  updatePrefs({
                    categories: {
                      ...(prefs.categories || {}),
                      [cat.key]: v,
                    },
                  })
                }
                disabled={!prefs.pushEnabled}
              />
            }
          />
        ))}
      </NativeSection>

      <NativeSection title={`Bottom bar · ${prefs.bottomNavModuleIds.length}/${PWA_MAX_BOTTOM_SLOTS}`}>
        {PWA_MODULE_CATALOG.map((mod) => {
          const selected = prefs.bottomNavModuleIds.includes(mod.id);
          const atCapacity = !selected && prefs.bottomNavModuleIds.length >= PWA_MAX_BOTTOM_SLOTS;
          const Icon = mod.icon;
          return (
            <NativeListTile
              key={mod.id}
              bareIcon
              icon={
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${selected ? mod.tileBg : mod.tileBgMuted}`}
                >
                  <Icon className="w-4 h-4 text-white" />
                </div>
              }
              title={mod.label}
              subtitle={mod.hrefForRole(user.role).replace('/dashboard/', '')}
              selected={selected}
              onClick={selected || !atCapacity ? () => toggleModule(mod.id) : undefined}
              trailing={
                selected ? (
                  <span className="w-6 h-6 rounded-full bg-teal-500 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-white" />
                  </span>
                ) : (
                  <span
                    className={`w-6 h-6 rounded-full border-2 ${
                      atCapacity ? 'border-white/10 opacity-30' : 'border-white/20'
                    }`}
                  />
                )
              }
            />
          );
        })}
      </NativeSection>

      <p className="px-6 pb-8 type-card-description text-white/35 leading-relaxed">
        Pick up to five destinations for your bottom bar. More opens the full menu.
      </p>
    </NativeScreen>
  );
}
