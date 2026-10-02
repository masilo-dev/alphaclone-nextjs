import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { sendPushToUser } from '@/lib/push/sendPushToUser';
import { insertTenantNotification } from '@/lib/notifications/insertTenantNotification';

export async function POST(req: NextRequest) {
  try {
    const input = z
      .object({
        tenantId: z.string().uuid(),
      })
      .parse(await req.json());

    const { user, admin } = await requireTenantAccess(input.tenantId);

    // 1. In-app test notification
    const inAppResult = await insertTenantNotification(admin, {
      tenantId: input.tenantId,
      recipientUserId: user.id,
      recipientRole: 'tenant_member',
      entityType: 'test',
      eventType: 'system.test_push',
      title: 'AlphaClone Device Alert Test',
      message: 'Mobile alerts are configured and active for this device.',
      severity: 'medium',
      channel: 'in_app',
      actionUrl: '/dashboard/settings/pwa',
    });

    // 2. Web push notification to user devices
    const pushResult = await sendPushToUser(
      user.id,
      {
        title: 'AlphaClone Device Alert',
        body: 'Push alerts are working! You will receive urgent updates on this phone.',
        url: '/dashboard',
        tag: 'test-push',
      },
      input.tenantId
    );

    return NextResponse.json({
      success: true,
      inAppCreated: inAppResult.created,
      pushesSent: pushResult.sent,
      failed: pushResult.failed,
      expiredCleaned: pushResult.expiredCleaned,
      message:
        pushResult.sent > 0
          ? `Alert delivered to ${pushResult.sent} device(s).`
          : 'In-app notification created. No active web push subscription found for this browser.',
    });
  } catch (err: unknown) {
    return routeErrorResponse(err, 'Failed to send test push notification', req);
  }
}
