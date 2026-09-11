import { ZohoService } from './ZohoService';

export type ZohoMailingList = {
  listKey: string;
  name: string;
  contactCount: number;
  unsubscribeCount: number;
  bounceCount: number;
  owner: string;
  createdAt: string;
  isPublic: boolean;
};

export type ZohoCampaignSummary = {
  campaignKey: string;
  name: string;
  status: string;
  createdAt: string;
  previewUrl?: string;
  sentTime?: string;
};

export type ZohoCampaignReport = {
  campaignKey: string;
  sentCount?: number;
  openCount?: number;
  clickCount?: number;
  bounceCount?: number;
  unsubscribeCount?: number;
  openRate?: number;
  clickRate?: number;
};

export type CreateCampaignInput = {
  campaignName: string;
  fromEmail: string;
  fromName?: string;
  subject: string;
  contentUrl: string;
  listKeys: string[];
  topicId?: string;
};

function pickField(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== null && String(val).trim()) return String(val);
  }
  return '';
}

function normalizeList(row: Record<string, unknown>): ZohoMailingList {
  return {
    listKey: pickField(row, 'listkey', 'list_key'),
    name: pickField(row, 'listname', 'list_name', 'name'),
    contactCount: Number(pickField(row, 'noofcontacts', 'contact_count') || 0),
    unsubscribeCount: Number(pickField(row, 'noofunsubcnt', 'unsubscribe_count') || 0),
    bounceCount: Number(pickField(row, 'noofbouncecnt', 'bounce_count') || 0),
    owner: pickField(row, 'owner'),
    createdAt: pickField(row, 'created_date', 'date', 'created_date_string'),
    isPublic: String(row.is_public || '').toLowerCase() === 'true',
  };
}

function normalizeCampaign(row: Record<string, unknown>): ZohoCampaignSummary {
  const fields = row as Record<string, string>;
  const flMap: Record<string, string> = {};
  if (Array.isArray(row)) {
    // XML-style fl array — skip
  }
  if (typeof row === 'object' && row !== null) {
    for (const [k, v] of Object.entries(row)) {
      if (k.startsWith('fl val=')) continue;
      flMap[k] = String(v ?? '');
    }
  }
  return {
    campaignKey: pickField(row, 'campaign_key', 'campaignKey', 'campaignkey'),
    name: pickField(row, 'campaign_name', 'campaignname', 'name'),
    status: pickField(row, 'campaign_status', 'status'),
    createdAt: pickField(row, 'created_time', 'created_date_string', 'created_date'),
    previewUrl: pickField(row, 'campaign_preview', 'preview_url'),
    sentTime: pickField(row, 'sent_time'),
  };
}

/**
 * Native wrapper around Zoho Campaigns API v1.1.
 * All campaign operations route through here — not the legacy email_campaigns pipeline.
 */
export class ZohoCampaignsService extends ZohoService {
  private async getCampaignsBase(): Promise<string> {
    let config = await this.getConfig();
    if (!config?.campaignsApiHost && config?.accountsServer) {
      const accountsServer = config.accountsServer.toLowerCase();
      let inferredHost = 'campaigns.zoho.com';
      if (accountsServer.includes('.eu')) inferredHost = 'campaigns.zoho.eu';
      else if (accountsServer.includes('.in')) inferredHost = 'campaigns.zoho.in';
      else if (accountsServer.includes('.com.au')) inferredHost = 'campaigns.zoho.com.au';
      else if (accountsServer.includes('.jp')) inferredHost = 'campaigns.zoho.jp';
      else if (accountsServer.includes('.ca')) inferredHost = 'campaigns.zoho.ca';

      await this.saveConfig({ campaignsApiHost: inferredHost });
      config = await this.getConfig();
    }

    if (!config?.campaignsApiHost) {
      throw new Error('Zoho Campaigns is not configured. Reconnect Zoho with Campaigns access.');
    }
    return config.campaignsApiHost;
  }

  private async buildUrl(path: string, params: Record<string, string | number | undefined> = {}): Promise<string> {
    const host = await this.getCampaignsBase();
    const url = new URL(`https://${host}/api/v1.1/${path}`);
    url.searchParams.set('resfmt', 'JSON');
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
    return url.toString();
  }

  private async campaignsGet(path: string, params: Record<string, string | number | undefined> = {}) {
    const url = await this.buildUrl(path, params);
    return this.callZohoAPI(url, { method: 'GET' });
  }

  private async campaignsPost(path: string, params: Record<string, string | number | undefined> = {}) {
    const url = await this.buildUrl(path, params);
    return this.callZohoAPI(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  }

  async checkCampaignsReady(): Promise<boolean> {
    try {
      await this.getMailingLists({ range: 1 });
      return true;
    } catch {
      return false;
    }
  }

  async getMailingLists(options?: { fromIndex?: number; range?: number; sort?: 'asc' | 'desc' }) {
    const data = await this.campaignsGet('getmailinglists', {
      fromindex: options?.fromIndex ?? 1,
      range: options?.range ?? 50,
      sort: options?.sort ?? 'desc',
    });

    const rows = data?.list_of_details;
    const lists: ZohoMailingList[] = Array.isArray(rows)
      ? rows.map((row: Record<string, unknown>) => normalizeList(row))
      : [];

    return { lists, raw: data };
  }

  async getRecentCampaigns(options?: {
    status?: string;
    fromIndex?: number;
    range?: number;
    sort?: 'asc' | 'desc';
  }) {
    const data = await this.campaignsGet('recentcampaigns', {
      status: options?.status ?? 'all',
      fromindex: options?.fromIndex ?? 1,
      range: options?.range ?? 25,
      sort: options?.sort ?? 'desc',
    });

    let campaigns: ZohoCampaignSummary[] = [];
    const recent = data?.['recent-campaigns'] ?? data?.recent_campaigns ?? data?.campaigns;
    if (Array.isArray(recent)) {
      campaigns = recent.map((row: Record<string, unknown>) => normalizeCampaign(row));
    } else if (recent && typeof recent === 'object') {
      const nested = (recent as { campaign?: Record<string, unknown>[] }).campaign;
      if (Array.isArray(nested)) {
        campaigns = nested.map((row) => {
          const mapped: Record<string, string> = {};
          const flList = (row as { fl?: Array<{ '@val'?: string; val?: string; '#text'?: string }> }).fl;
          if (Array.isArray(flList)) {
            for (const fl of flList) {
              const key = fl.val || fl['@val'];
              const value = fl['#text'] ?? '';
              if (key) mapped[key] = String(value);
            }
          }
          return normalizeCampaign({ ...row, ...mapped });
        });
      }
    }

    return { campaigns, raw: data };
  }

  async getRecentSentCampaigns(limit = 10) {
    const data = await this.campaignsGet('recentsentcampaigns', { limit });
    let campaigns: ZohoCampaignSummary[] = [];

    const rawSent = data?.recent_sent_campaigns;
    if (typeof rawSent === 'string') {
      try {
        const parsed = JSON.parse(rawSent.replace(/=/g, ':').replace(/(\w+):/g, '"$1":'));
        if (Array.isArray(parsed)) {
          campaigns = parsed.map((row) => normalizeCampaign(row as Record<string, unknown>));
        }
      } catch {
        // Zoho sometimes returns stringified pseudo-JSON — fall back to empty
      }
    } else if (Array.isArray(rawSent)) {
      campaigns = rawSent.map((row) => normalizeCampaign(row as Record<string, unknown>));
    }

    return { campaigns: campaigns.slice(0, limit), raw: data };
  }

  async getCampaignReport(campaignKey: string): Promise<ZohoCampaignReport> {
    const data = await this.campaignsGet('campaignreports', { campaignkey: campaignKey });
    const report = data?.report_details ?? data?.campaign_report ?? data ?? {};
    const sent = Number(report.sent_count ?? report.emails_sent ?? report.sent ?? 0);
    const opens = Number(report.open_count ?? report.unique_opens ?? report.opens ?? 0);
    const clicks = Number(report.click_count ?? report.unique_clicks ?? report.clicks ?? 0);

    return {
      campaignKey,
      sentCount: sent,
      openCount: opens,
      clickCount: clicks,
      bounceCount: Number(report.bounce_count ?? report.bounces ?? 0),
      unsubscribeCount: Number(report.unsubscribe_count ?? report.unsubscribes ?? 0),
      openRate: sent > 0 ? Math.round((opens / sent) * 1000) / 10 : 0,
      clickRate: sent > 0 ? Math.round((clicks / sent) * 1000) / 10 : 0,
    };
  }

  async createCampaign(input: CreateCampaignInput) {
    if (!input.listKeys.length) {
      throw new Error('Select at least one mailing list.');
    }

    const listDetails: Record<string, unknown[]> = {};
    for (const key of input.listKeys) {
      listDetails[key] = [];
    }

    const params: Record<string, string> = {
      campaignname: input.campaignName,
      from_email: input.fromEmail,
      subject: input.subject,
      list_details: JSON.stringify(listDetails),
      content_url: input.contentUrl,
    };
    if (input.fromName) params.from_name = input.fromName;
    if (input.topicId) params.topicId = input.topicId;

    const url = await this.buildUrl('createCampaign', params);
    const data = await this.callZohoAPI(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const campaignKey = String(data?.campaignKey ?? data?.campaign_key ?? '');
    if (!campaignKey) {
      throw new Error(data?.message || 'Campaign created but no campaign key returned.');
    }

    return { campaignKey, message: data?.message || 'Campaign created', raw: data };
  }

  async sendCampaign(campaignKey: string) {
    const data = await this.campaignsPost('sendcampaign', { campaignkey: campaignKey });
    return {
      status: String(data?.response?.campaign_status ?? data?.campaign_status ?? 'inprogress'),
      message: String(data?.response?.message ?? data?.message ?? 'Campaign send started'),
      raw: data,
    };
  }

  async subscribeContact(listKey: string, email: string, firstName?: string, lastName?: string) {
    const contactinfo = JSON.stringify({
      'Contact Email': email,
      ...(firstName ? { 'First Name': firstName } : {}),
      ...(lastName ? { 'Last Name': lastName } : {}),
    });

    const url = await this.buildUrl('json/listsubscribe', {
      listkey: listKey,
      contactinfo,
      source: 'AlphaClone CRM',
    });

    const data = await this.callZohoAPI(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    return {
      success: data?.status === 'success' || data?.code === '0' || data?.code === 0,
      message: String(data?.message || 'Contact subscribed'),
      raw: data,
    };
  }

  async unsubscribeContact(listKey: string, email: string) {
    const data = await this.campaignsPost('json/listunsubscribe', {
      listkey: listKey,
      contactinfo: JSON.stringify({ 'Contact Email': email }),
    });
    return {
      success: data?.status === 'success' || data?.code === '0',
      message: String(data?.message || 'Contact unsubscribed'),
      raw: data,
    };
  }
}
