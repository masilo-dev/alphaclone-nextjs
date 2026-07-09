'use client';

import CampaignBuilder from '@/components/dashboard/business/CampaignBuilder';

interface EmailCampaignsPageProps {
  userId: string;
}

/**
 * Primary email campaigns experience — multi-provider delivery (not Zoho-only).
 * Zoho Mail is one optional sender alongside Brevo, SendGrid, and Resend.
 */
export default function EmailCampaignsPage({ userId }: EmailCampaignsPageProps) {
  return <CampaignBuilder userId={userId} />;
}
