import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { bufferNotificationDigestEvent } from '@/lib/email/notificationDigestEngine';
import { insertTenantNotification } from "@/lib/notifications/insertTenantNotification";
import webPush from "web-push";
import {
  getVapidEmail,
  getVapidPrivateKey,
  getVapidPublicKey,
} from "@/lib/push/vapidEnv";

const vapidPublicKey = getVapidPublicKey();
const vapidPrivateKey = getVapidPrivateKey();
let vapidReady = false;
if (vapidPublicKey && vapidPrivateKey) {
  try {
    webPush.setVapidDetails(getVapidEmail(), vapidPublicKey, vapidPrivateKey);
    vapidReady = true;
  } catch (error) {
    console.error("[notifyTenantOwners] invalid VAPID configuration:", error);
  }
}

/**
 * Fan-out in-app + email notifications to tenant owners/admins.
 */
export type TenantNotificationReport = {
  recipients: number;
  inAppCreated: number;
  emailsSent: number;
  emailsSkipped: number;
  emailsFailed: number;
  pushesSent: number;
  pushesFailed: number;
};

export async function notifyTenantOwners(options: {
  tenantId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  fallbackUserId?: string;
}): Promise<TenantNotificationReport> {
  const admin = createSupabaseAdminClient();
  const { data: members } = await admin
    .from("tenant_users")
    .select("user_id, role")
    .eq("tenant_id", options.tenantId)
    .in("role", ["owner", "admin", "tenant_admin", "super_admin"]);

  const userIds = [
    ...new Set([
      ...(members || []).map((m: { user_id: string }) => m.user_id),
      ...(options.fallbackUserId ? [options.fallbackUserId] : []),
    ]),
  ];

  const report: TenantNotificationReport = {
    recipients: userIds.length,
    inAppCreated: 0,
    emailsSent: 0,
    emailsSkipped: 0,
    emailsFailed: 0,
    pushesSent: 0,
    pushesFailed: 0,
  };

  for (const userId of userIds) {
    const [{ data: profile }, { data: preferences }] = await Promise.all([
      admin
        .from("profiles")
        .select("email, name")
        .eq("id", userId)
        .maybeSingle(),
      admin
        .from("notification_preferences")
        .select("email_enabled, push_enabled, in_app_enabled, event_types")
        .eq("tenant_id", options.tenantId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const eventSetting = (
      preferences?.event_types as Record<string, boolean> | null
    )?.[options.type];
    const inAppEnabled =
      preferences?.in_app_enabled !== false && eventSetting !== false;
    const emailEnabled =
      preferences?.email_enabled !== false && eventSetting !== false;
    const pushEnabled =
      preferences?.push_enabled !== false && eventSetting !== false;

    if (inAppEnabled) {
      const inserted = await insertTenantNotification(admin, {
        tenantId: options.tenantId,
        recipientUserId: userId,
        eventType: options.type,
        title: options.title,
        message: options.message,
        actionUrl: options.link || null,
        severity: 'medium',
        channel: 'in_app',
      });
      if (inserted.created) {
        report.inAppCreated += 1;
      } else if (inserted.error && inserted.error !== 'duplicate') {
        console.error("[notifyTenantOwners] in-app notification insert failed:", inserted.error);
      }
    }

    if (pushEnabled && vapidReady) {
      const { data: subscriptions } = await admin
        .from("push_subscriptions")
        .select("id, subscription, endpoint, keys")
        .eq("tenant_id", options.tenantId)
        .eq("user_id", userId);
      const payload = JSON.stringify({
        title: options.title,
        body: options.message,
        url: options.link || "/dashboard",
        icon: "/favicon-192x192.png",
        badge: "/favicon-96x96.png",
      });
      const results = await Promise.allSettled(
        (subscriptions || []).map((subscription: any) => {
          const target = subscription.subscription
            ? typeof subscription.subscription === "string"
              ? JSON.parse(subscription.subscription)
              : subscription.subscription
            : { endpoint: subscription.endpoint, keys: subscription.keys };
          return webPush.sendNotification(target, payload);
        }),
      );
      const expired: string[] = [];
      results.forEach((result, index) => {
        if (result.status === "fulfilled") report.pushesSent += 1;
        else {
          report.pushesFailed += 1;
          const statusCode = (result.reason as { statusCode?: number })
            ?.statusCode;
          if (statusCode === 404 || statusCode === 410)
            expired.push((subscriptions || [])[index].id);
        }
      });
      if (expired.length)
        await admin.from("push_subscriptions").delete().in("id", expired);
      if (results.length) {
        const { error: pushDeliveryError } = await admin
          .from("notification_deliveries")
          .insert({
            tenant_id: options.tenantId,
            user_id: userId,
            channel: "push",
            event_type: options.type,
            recipient: `${results.length} registered device(s)`,
            status: results.some((result) => result.status === "fulfilled")
              ? "sent"
              : "failed",
            error: results.every((result) => result.status === "rejected")
              ? "All push deliveries failed"
              : null,
          });
        if (pushDeliveryError) {
          console.error("[notifyTenantOwners] push delivery audit insert failed:", pushDeliveryError.message);
        }
      }
    }

    if (emailEnabled && profile?.email) {
      const { error: digestError } = await bufferNotificationDigestEvent({
        tenantId: options.tenantId,
        userId,
        recipientEmail: profile.email,
        eventType: options.type,
        eventCategory: 'owner_notification',
        source: 'system',
        sourceAction: options.type,
        severity: 'info',
        title: options.title,
        summary: options.message,
        metadata: { action_url: options.link || null },
      });
      if (digestError) {
        report.emailsFailed += 1;
        console.error('[notifyTenantOwners] digest buffer failed:', digestError.message);
      } else {
        report.emailsSkipped += 1;
      }
    } else {
      report.emailsSkipped += 1;
    }
  }

  return report;
}
