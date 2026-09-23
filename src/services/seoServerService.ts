import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
    SEO_ARTICLE_FALLBACKS,
    SEO_ARTICLE_FALLBACK_BY_SLUG,
} from '@/content/seoArticleFallbacks';

export interface SeoArticleRecord {
    id: string;
    title: string;
    slug: string;
    meta_description: string;
    meta_keywords: string[];
    content: string;
    category: string;
    tags: string[];
    published: boolean;
    views: number;
    created_at: string;
    updated_at: string;
}

const SEO_QUERY_TIMEOUT_MS = 3500;

function refreshArticle(article: SeoArticleRecord): SeoArticleRecord {
    const title = article.title.replace(/\b2025\b/g, '2026');
    const base = article.content?.trim() || article.meta_description;
    const practicalExpansion = `

## Start with the business outcome

Before choosing tools, define the result the business needs, who owns it, which records are involved, and what evidence will prove the work is complete. This prevents a technology project from becoming a list of features without an operational result.

## Map the current workflow

Write down how work moves today: where a request begins, who reviews it, which system stores the customer context, where approvals happen, and how the final result is verified. Pay particular attention to copy-and-paste handoffs, missed follow-ups, duplicate records, and steps that depend on one person remembering what to do.

## Choose a controlled first implementation

Start with one repeatable workflow and a small group of users. Keep consequential customer-facing or financial actions reviewable. Test normal cases, permission failures, duplicate requests, provider timeouts, and recovery steps before expanding the rollout.

## Measure whether it works

Track cycle time, error rate, completion rate, manual handoffs, customer response time, and the number of exceptions that require attention. A successful implementation should make the next action clearer and reduce coordination work; it should not merely add another dashboard.

## Practical checklist

- Define the owner and desired outcome.
- Confirm data, permission, privacy, and retention requirements.
- Document the approval and verification points.
- Test with real but low-risk work.
- Record failures visibly and make retries safe.
- Review results before scaling the workflow.

## How AlphaClone approaches the problem

AlphaClone keeps CRM, delivery, communication, documents, and billing context connected. Approved actions can move through the relevant workspace while the outcome remains visible in the activity record. The goal is accountable execution with less tab-switching, not automation without control.
`;
    return {
        ...article,
        title,
        meta_description: article.meta_description.replace(/\b2025\b/g, '2026'),
        content: base.length >= 1800 ? base.replace(/\b2025\b/g, '2026') : `${base.replace(/\b2025\b/g, '2026')}${practicalExpansion}`,
    };
}

async function withTimeout<T>(promise: PromiseLike<T>, timeoutMs = SEO_QUERY_TIMEOUT_MS): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            Promise.resolve(promise),
            new Promise<T>((_, reject) => {
                timer = setTimeout(() => reject(new Error(`SEO article query timed out after ${timeoutMs}ms`)), timeoutMs);
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

export async function getPublishedSeoArticles() {
    try {
        const supabase = createSupabaseAdminClient();
        const { data, error } = await withTimeout(
            supabase
                .from('seo_articles')
                .select('id, title, slug, meta_description, meta_keywords, category, tags, published, views, created_at, updated_at')
                .eq('published', true)
                .order('created_at', { ascending: false }),
        );
        if (error) throw error;
        return Array.isArray(data) && data.length > 0
            ? (data as SeoArticleRecord[]).map(refreshArticle)
            : SEO_ARTICLE_FALLBACKS.map(refreshArticle);
    } catch (error) {
        console.error('Published SEO articles unavailable; using local seeded fallbacks.', error);
        return SEO_ARTICLE_FALLBACKS.map(refreshArticle);
    }
}

export async function getPublishedSeoArticleBySlug(slug: string) {
    const fallback = SEO_ARTICLE_FALLBACK_BY_SLUG.get(slug) || null;
    try {
        const supabase = createSupabaseAdminClient();
        const { data, error } = await withTimeout(
            supabase
                .from('seo_articles')
                .select('*')
                .eq('slug', slug)
                .eq('published', true)
                .maybeSingle(),
        );
        if (error) throw error;
        return data || fallback ? refreshArticle((data || fallback) as SeoArticleRecord) : null;
    } catch (error) {
        console.error(`SEO article "${slug}" unavailable; using local seeded fallback.`, error);
        return fallback ? refreshArticle(fallback) : null;
    }
}
