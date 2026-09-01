import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  sendEmailServer,
  type SendEmailServerResult,
} from "@/lib/email/sendEmailServer";
import { mapEventTypeToNotificationType } from "@/lib/notifications/notificationType";
import { buildValidatedPublicUrl } from "@/lib/urls";
import { escapeHtml } from '@/lib/email/escapeHtml';
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
      const notificationType = mapEventTypeToNotificationType(options.type);
      const { error } = await admin.from("notifications").insert({
        user_id: userId,
        tenant_id: options.tenantId,
        type: notificationType,
        title: options.title,
        message: options.message,
        action_url: options.link || null,
        read: false,
        metadata: { event_type: options.type },
      });
      if (error) {
        console.error("[notifyTenantOwners] in-app notification insert failed:", error.message);
      } else {
        report.inAppCreated += 1;
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
      const actionUrl = options.link
        ? buildValidatedPublicUrl(options.link)
        : undefined;
      const result: SendEmailServerResult = await sendEmailServer({
        tenantId: options.tenantId,
        to: profile.email,
        subject: options.title,
        html: `
                    <div style="font-family:sans-serif;padding:20px;color:#333;">
                        <h2 style="color:#0d9488;">${escapeHtml(options.title)}</h2>
                        <p>${escapeHtml(options.message)}</p>
                        ${actionUrl ? `<p><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#0d9488;color:#fff;text-decoration:none;">View details</a></p>` : ""}
                    </div>
                `,
        isPlatformNotification: true,
      }).catch(
        (err): SendEmailServerResult => ({
          success: false,
          error: err instanceof Error ? err.message : String(err),
        }),
      );

      const { error: emailDeliveryError } = await admin.from("notification_deliveries").insert({
        tenant_id: options.tenantId,
        user_id: userId,
        channel: "email",
        event_type: options.type,
        recipient: profile.email,
        status: result.success ? "sent" : "failed",
        provider_message_id: result.emailId || null,
        error: result.error || null,
      });
      if (emailDeliveryError) {
        console.error("[notifyTenantOwners] email delivery audit insert failed:", emailDeliveryError.message);
      }
      if (result.success) report.emailsSent += 1;
      else {
        report.emailsFailed += 1;
        console.error("[notifyTenantOwners] email failed:", result.error);
      }
    } else {
      report.emailsSkipped += 1;
    }
  }

  return report;
}
