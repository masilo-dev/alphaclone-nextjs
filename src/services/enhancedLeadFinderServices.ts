// Enhanced Lead Finder Services for Production Readiness

// 1. Email Verification Service
export const emailVerificationService = {
  async verifyEmail(email: string): Promise<{ valid: boolean; score: number; reason?: string }> {
    try {
      // Use ZeroBounce API (free tier: 1000 verifications/month)
      const response = await fetch(`https://api.zerobounce.net/v2/validate?api_key=${process.env.ZEROBOUNCE_API_KEY}&email=${encodeURIComponent(email)}&ip_address=`);
      const data = await response.json();
      
      return {
        valid: data.status === 'valid',
        score: data.quality_score * 100, // 0-100 score
        reason: data.sub_status
      };
    } catch (error) {
      // Fallback to basic regex validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValid = emailRegex.test(email);
      return {
        valid: isValid,
        score: isValid ? 70 : 0,
        reason: isValid ? 'basic_validation' : 'invalid_format'
      };
    }
  }
};

// 2. Phone Verification Service  
export const phoneVerificationService = {
  async verifyPhone(phone: string, country: string = 'US'): Promise<{ valid: boolean; score: number; type?: string }> {
    try {
      // Use Twilio Lookup API (free tier: 50 lookups/month)
      const response = await fetch(`https://lookups.twilio.com/v1/PhoneNumbers/${encodeURIComponent(phone)}?Type=carrier&CountryCode=${country}`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`
        }
      });
      const data = await response.json();
      
      return {
        valid: data.carrier?.type === 'mobile' || data.carrier?.type === 'landline',
        score: data.carrier ? 85 : 0,
        type: data.carrier?.type
      };
    } catch (error) {
      // Fallback to basic phone format validation
      const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
      const isValid = phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
      return {
        valid: isValid,
        score: isValid ? 60 : 0,
        type: isValid ? 'basic_validation' : 'invalid_format'
      };
    }
  }
};

// 3. Lead Scoring Service
export const leadScoringService = {
  async scoreLead(lead: any): Promise<{ totalScore: number; breakdown: any; tier: 'hot' | 'warm' | 'cold' | 'skip' }> {
    const breakdown = {
      contactInfo: 0,
      businessQuality: 0,
      onlinePresence: 0,
      completeness: 0
    };

    // Contact Information Score (40% weight)
    if (lead.email) {
      const emailVerif = await emailVerificationService.verifyEmail(lead.email);
      breakdown.contactInfo += emailVerif.valid ? 25 : 0;
    }
    if (lead.phone) {
      const phoneVerif = await phoneVerificationService.verifyPhone(lead.phone);
      breakdown.contactInfo += phoneVerif.valid ? 15 : 0;
    }

    // Business Quality Score (30% weight)
    if (lead.rating && lead.rating >= 4) breakdown.businessQuality += 15;
    if (lead.category && !lead.category.includes('general')) breakdown.businessQuality += 10;
    if (lead.business_name && lead.business_name.length > 10) breakdown.businessQuality += 5;

    // Online Presence Score (20% weight)
    if (lead.website) breakdown.onlinePresence += 10;
    if (lead.website && !lead.website.includes('placeholder')) breakdown.onlinePresence += 10;

    // Completeness Score (10% weight)
    const fields = ['business_name', 'address', 'phone', 'email', 'website', 'category'];
    const filledFields = fields.filter(field => lead[field] && lead[field].length > 0).length;
    breakdown.completeness = (filledFields / fields.length) * 10;

    const totalScore = Object.values(breakdown).reduce((sum, score) => sum + score, 0);

    // Determine lead tier
    let tier: 'hot' | 'warm' | 'cold' | 'skip';
    if (totalScore >= 80) tier = 'hot';
    else if (totalScore >= 60) tier = 'warm';
    else if (totalScore >= 40) tier = 'cold';
    else tier = 'skip';

    return { totalScore, breakdown, tier };
  }
};

// 4. Outreach Automation Service
export const outreachAutomationService = {
  async createSequence(leads: any[], templateType: string = 'standard') {
    const sequences: Record<'standard' | 'aggressive', Array<{ delay: number; template: string; subject: string }>> = {
      standard: [
        { delay: 0, template: 'initial_contact', subject: 'Introduction' },
        { delay: 1, template: 'follow_up_1', subject: 'Following Up' },
        { delay: 3, template: 'follow_up_2', subject: 'Quick Question' },
        { delay: 7, template: 'final_follow_up', subject: 'Final Follow Up' }
      ],
      aggressive: [
        { delay: 0, template: 'initial_contact', subject: 'Partnership Opportunity' },
        { delay: 1, template: 'follow_up_1', subject: 'Quick Chat?' },
        { delay: 2, template: 'follow_up_2', subject: 'Time Sensitive' }
      ]
    };

    const sequence = sequences[templateType as keyof typeof sequences] || sequences.standard;
    
    return leads.map(lead => ({
      leadId: lead.id,
      emails: sequence.map((step: { delay: number; template: string; subject: string }, index: number) => ({
        ...step,
        scheduledDate: new Date(Date.now() + step.delay * 24 * 60 * 60 * 1000),
        templateData: {
          businessName: lead.business_name,
          contactName: lead.contact_name,
          category: lead.category,
          website: lead.website
        }
      }))
    }));
  },

  async sendEmail(emailData: any) {
    // Use existing email service or integrate with SendGrid/Mailgun
    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailData)
      });
      return response.json();
    } catch (error: any) {
      console.error('Failed to send email:', error);
      return { success: false, error: error.message };
    }
  }
};

// 5. Enhanced OpenStreetMap Integration
export const enhancedMapService = {
  async getBusinessData(niche: string, location: string, limit: number = 50) {
    // Enhanced Overpass query with more data points
    const query = `
      [out:json][timeout:60];
      area["name"="${location}"]->.searchArea;
      (
        node["shop"~"${niche}",i](area.searchArea);
        way["shop"~"${niche}",i](area.searchArea);
        relation["shop"~"${niche}",i](area.searchArea);
        node["amenity"~"${niche}",i](area.searchArea);
        way["amenity"~"${niche}",i](area.searchArea);
        node["office"~"${niche}",i](area.searchArea);
        way["office"~"${niche}",i](area.searchArea);
      );
      out geom;
    `;

    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query,
        headers: { 'Content-Type': 'text/plain' }
      });

      const data = await response.json();
      return data.elements
        .filter((el: any) => el.tags?.name)
        .map((el: any) => ({
          id: el.id,
          business_name: el.tags.name,
          category: el.tags.shop || el.tags.amenity || el.tags.office || 'business',
          address: this.formatAddress(el.tags),
          phone: el.tags.phone,
          email: el.tags.email,
          website: el.tags.website,
          lat: el.lat || el.center?.lat,
          lng: el.lon || el.center?.lon,
          opening_hours: el.tags.opening_hours,
          rating: parseFloat(el.tags?.['contact:rating']) || 0,
          source: 'osm',
          tags: el.tags
        }))
        .slice(0, limit);
    } catch (error) {
      console.error('Enhanced map search failed:', error);
      return [];
    }
  },

  formatAddress(tags: any): string {
    const parts = [
      tags['addr:housenumber'],
      tags['addr:street'],
      tags['addr:city'],
      tags['addr:state'],
      tags['addr:postcode']
    ].filter(Boolean);
    
    return parts.join(', ') || tags.address || '';
  }
};

// 6. Lead Enrichment Service
export const leadEnrichmentService = {
  async enrichLead(lead: any) {
    const enriched = { ...lead };

    // Add business type classification
    enriched.business_type = this.classifyBusiness(lead.category, lead.tags);

    // Add estimated size based on available data
    enriched.estimated_size = this.estimateBusinessSize(lead);

    // Add technology stack if website available
    if (lead.website) {
      enriched.tech_stack = await this.getTechStack(lead.website);
    }

    // Add social media links
    enriched.social_links = await this.findSocialLinks(lead);

    return enriched;
  },

  classifyBusiness(category: string, tags: any): string {
    const businessTypes = {
      'retail': ['shop', 'store', 'mall'],
      'food_service': ['restaurant', 'cafe', 'bar', 'food'],
      'professional': ['office', 'lawyer', 'accountant', 'consulting'],
      'healthcare': ['clinic', 'hospital', 'pharmacy', 'doctor'],
      'education': ['school', 'university', 'college'],
      'entertainment': ['cinema', 'theater', 'venue']
    };

    for (const [type, keywords] of Object.entries(businessTypes)) {
      if (keywords.some(kw => category?.includes(kw) || JSON.stringify(tags).includes(kw))) {
        return type;
      }
    }
    return 'other';
  },

  estimateBusinessSize(lead: any): 'small' | 'medium' | 'large' {
    // Simple heuristics for size estimation
    if (lead.tags?.employees) {
      const count = parseInt(lead.tags.employees);
      if (count <= 10) return 'small';
      if (count <= 50) return 'medium';
      return 'large';
    }

    // Fallback based on business type and presence
    if (lead.website && lead.phone && lead.email) return 'medium';
    if (lead.phone && lead.email) return 'small';
    return 'small';
  },

  async getTechStack(website: string): Promise<string[]> {
    try {
      // Use builtwith or similar API for tech detection
      // For now, return empty array (can be enhanced later)
      return [];
    } catch (error) {
      return [];
    }
  },

  async findSocialLinks(lead: any): Promise<any> {
    const socials = {};
    
    // Extract social media from tags or website
    if (lead.tags?.['contact:facebook']) (socials as any).facebook = lead.tags['contact:facebook'];
    if (lead.tags?.['contact:twitter']) (socials as any).twitter = lead.tags['contact:twitter'];
    if (lead.tags?.['contact:linkedin']) (socials as any).linkedin = lead.tags['contact:linkedin'];
    
    return socials;
  }
};
