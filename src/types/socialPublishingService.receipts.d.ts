import type { SocialActionReceipt, SocialPlatform } from '@/lib/social/types';

declare module '@/lib/social/SocialPublishingService' {
  interface SocialPublishingService {
    createActionReceipt(params: {
      provider: SocialPlatform;
      providerReference: string | null;
      verified: boolean;
      verifiedAt: string | null;
      correlationId: string;
      liveUrl?: string | null;
    }): SocialActionReceipt;
  }
}

export {};
