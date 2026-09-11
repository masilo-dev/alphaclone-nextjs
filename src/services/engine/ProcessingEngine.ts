/**
 * PROCESSING ENGINE
 * Responsible for: keyword detection, intent classification, enrichment
 * This is the "brain" that decides what incoming data means.
 */

export type IntentLabel = 'unknown' | 'low' | 'medium' | 'high' | 'urgent';

interface ProcessingResult {
    intent_score: number;       // 0–100
    intent_label: IntentLabel;
    keywords_found: string[];
    structured_data: Record<string, unknown>;
}

// Intent keyword maps — weighted by score contribution
const INTENT_KEYWORDS: { pattern: RegExp; score: number; label: string }[] = [
    // Urgent buying intent
    { pattern: /\b(urgent|asap|immediately|right now|today|emergency)\b/i, score: 30, label: 'urgent_time' },
    { pattern: /\b(looking for|need a|searching for|want to hire|want to find)\b/i, score: 25, label: 'looking_for' },
    { pattern: /\b(how much|what is the price|pricing|quote|cost|budget)\b/i, score: 20, label: 'price_inquiry' },
    { pattern: /\b(interested in|would like|can you|do you offer|do you provide)\b/i, score: 18, label: 'interest' },

    // Business service signals
    { pattern: /\b(website|web design|web development|app|mobile app|software)\b/i, score: 15, label: 'digital_service' },
    { pattern: /\b(marketing|social media|seo|ads|advertising|branding)\b/i, score: 15, label: 'marketing' },
    { pattern: /\b(accountant|bookkeeper|lawyer|consultant|plumber|electrician|contractor)\b/i, score: 15, label: 'service_provider' },
    { pattern: /\b(hire|freelancer|agency|company|business)\b/i, score: 10, label: 'hiring' },

    // Contact signals
    { pattern: /\b(dm me|message me|contact me|call me|email me|reach out)\b/i, score: 20, label: 'contact_request' },
    { pattern: /\b(recommend|referral|anyone know|can anyone)\b/i, score: 12, label: 'recommendation' },

    // Negative signals (reduce score)
    { pattern: /\b(spam|scam|fake|not interested|unsubscribe)\b/i, score: -20, label: 'negative' },
];

export function processContent(content: string): ProcessingResult {
    if (!content || content.trim().length < 5) {
        return { intent_score: 0, intent_label: 'unknown', keywords_found: [], structured_data: {} };
    }

    let score = 0;
    const keywordsFound: string[] = [];
    const structuredData: Record<string, unknown> = {};

    for (const { pattern, score: weight, label } of INTENT_KEYWORDS) {
        if (pattern.test(content)) {
            score += weight;
            keywordsFound.push(label);
        }
    }

    // Clamp to 0–100
    score = Math.max(0, Math.min(100, score));

    // Classify label
    let intent_label: IntentLabel;
    if (score === 0) intent_label = 'unknown';
    else if (score < 20) intent_label = 'low';
    else if (score < 40) intent_label = 'medium';
    else if (score < 70) intent_label = 'high';
    else intent_label = 'urgent';

    // Basic structured extraction
    const emailMatch = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = content.match(/(\+?[\d\s\-().]{7,15})/);
    const urlMatch = content.match(/(https?:\/\/[^\s]+)/);

    if (emailMatch) structuredData.email = emailMatch[0];
    if (phoneMatch) structuredData.phone = phoneMatch[0].trim();
    if (urlMatch) structuredData.url = urlMatch[0];

    return { intent_score: score, intent_label, keywords_found: keywordsFound, structured_data: structuredData };
}

export function scoreLeadQuality(
    intentScore: number,
    hasEmail: boolean,
    hasPhone: boolean,
    hasCompany: boolean
): { quality: 'cold' | 'warm' | 'hot'; score: number } {
    let total = intentScore;
    if (hasEmail) total += 15;
    if (hasPhone) total += 10;
    if (hasCompany) total += 5;

    total = Math.min(100, total);
    const quality = total < 30 ? 'cold' : total < 60 ? 'warm' : 'hot';
    return { quality, score: total };
}
