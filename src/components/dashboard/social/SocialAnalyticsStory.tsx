'use client';

import React, { useMemo, useState } from 'react';
import {
    ArrowRight,
    BarChart3,
    ChevronRight,
    Eye,
    Heart,
    MessageSquare,
    MousePointerClick,
    Sparkles,
    X,
} from 'lucide-react';

type Range = '7D' | '30D' | '90D';

interface AnalyticsPost {
    id: string;
    title: string | null;
    caption: string;
    platforms: string[];
    media_urls: string[];
    media_types: string[];
    hashtags: string[];
    status: string;
    scheduled_at: string | null;
    published_at: string | null;
    facebook_post_id: string | null;
    linkedin_post_urn: string | null;
    linkedin_stats?: Record<string, unknown> | null;
    error_message: string | null;
    created_at: string;
}

interface Metrics {
    impressions: number;
    reactions: number;
    comments: number;
    clicks: number;
    shares: number;
}

interface Props {
    posts: AnalyticsPost[];
    metricsByPost: Record<string, Metrics>;
    platform: string;
    range: Range;
    onRangeChange: (range: Range) => void;
    onOpenPost: (post: AnalyticsPost) => void;
}

const formatNumber = (value: number) =>
    new Intl.NumberFormat(undefined, { notation: value >= 10_000 ? 'compact' : 'standard' }).format(value);

const mediaLabel = (post: AnalyticsPost) => {
    const raw = post.media_types?.[0]?.toLowerCase();
    if (raw?.includes('video')) return 'Video';
    if (post.media_urls?.length > 1) return 'Carousel';
    if (post.media_urls?.length === 1) return 'Image';
    return 'Text';
};

export function SocialAnalyticsStory({
    posts,
    metricsByPost,
    platform,
    range,
    onRangeChange,
    onOpenPost,
}: Props) {
    const [focusedId, setFocusedId] = useState<string | null>(null);
    const rangeDays = Number(range.replace('D', ''));

    const visiblePosts = useMemo(() => {
        const cutoff = Date.now() - rangeDays * 86_400_000;
        return posts
            .filter((post) => new Date(post.published_at || post.created_at).getTime() >= cutoff)
            .sort(
                (a, b) =>
                    new Date(a.published_at || a.created_at).getTime() -
                    new Date(b.published_at || b.created_at).getTime(),
            );
    }, [posts, rangeDays]);

    const totals = useMemo(
        () =>
            visiblePosts.reduce(
                (sum, post) => {
                    const metric = metricsByPost[post.id];
                    if (!metric) return sum;
                    sum.impressions += metric.impressions;
                    sum.reactions += metric.reactions;
                    sum.comments += metric.comments;
                    sum.clicks += metric.clicks;
                    sum.shares += metric.shares;
                    const hasValues =
                        metric.impressions + metric.reactions + metric.comments + metric.clicks + metric.shares > 0;
                    if (hasValues) sum.synced += 1;
                    return sum;
                },
                { impressions: 0, reactions: 0, comments: 0, clicks: 0, shares: 0, synced: 0 },
            ),
        [metricsByPost, visiblePosts],
    );

    const scoredPosts = useMemo(
        () =>
            visiblePosts.map((post) => {
                const metric = metricsByPost[post.id] || {
                    impressions: 0,
                    reactions: 0,
                    comments: 0,
                    clicks: 0,
                    shares: 0,
                };
                const engagements = metric.reactions + metric.comments + metric.clicks + metric.shares;
                return {
                    post,
                    metric,
                    engagements,
                    rate: metric.impressions > 0 ? (engagements / metric.impressions) * 100 : null,
                };
            }),
        [metricsByPost, visiblePosts],
    );

    const topPost = [...scoredPosts].sort((a, b) => b.engagements - a.engagements)[0] || null;
    const engagementRate =
        totals.impressions > 0
            ? ((totals.reactions + totals.comments + totals.clicks + totals.shares) / totals.impressions) * 100
            : null;
    const maxEngagement = Math.max(...scoredPosts.map((item) => item.engagements), 1);
    const focused = scoredPosts.find((item) => item.post.id === focusedId) || null;

    const contentGroups = useMemo(() => {
        const groups = new Map<string, { label: string; posts: number; impressions: number; engagements: number }>();
        scoredPosts.forEach(({ post, metric, engagements }) => {
            const label = mediaLabel(post);
            const current = groups.get(label) || { label, posts: 0, impressions: 0, engagements: 0 };
            current.posts += 1;
            current.impressions += metric.impressions;
            current.engagements += engagements;
            groups.set(label, current);
        });
        return [...groups.values()].sort((a, b) => b.engagements - a.engagements);
    }, [scoredPosts]);

    const leadingType = contentGroups[0] || null;
    const hasSyncedMetrics = totals.synced > 0;

    return (
        <div className="mx-auto max-w-6xl space-y-10 animate-in fade-in duration-300">
            <header className="flex flex-col gap-5 border-b border-[var(--ws-border)] pb-7 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-2xl">
                    <p className="mb-2 type-caption font-black uppercase tracking-caps text-indigo-300">
                        {platform} performance narrative
                    </p>
                    <h2 className="text-2xl font-semibold tracking-tight text-[var(--ws-text-primary)] sm:text-3xl">
                        From content to customer intent
                    </h2>
                    <p className="mt-2 type-card-description leading-6 text-[var(--ws-text-muted)]">
                        A traceable view of what was published, what earned attention, and what people did next.
                    </p>
                </div>
                <div className="flex w-fit rounded-lg border border-[var(--ws-border)] bg-[var(--ws-canvas)] p-1">
                    {(['7D', '30D', '90D'] as const).map((item) => (
                        <button
                            key={item}
                            type="button"
                            onClick={() => onRangeChange(item)}
                            className={`rounded-md px-3 py-1.5 type-caption font-bold transition-colors ${
                                range === item ? 'bg-indigo-500 text-[var(--ws-text-primary)]' : 'text-[var(--ws-text-muted)] hover:text-[var(--ws-text-primary)]'
                            }`}
                        >
                            {item}
                        </button>
                    ))}
                </div>
            </header>

            {!hasSyncedMetrics ? (
                <section className="border-l-2 border-amber-400 bg-[var(--warning-500)]/[0.06] px-5 py-4">
                    <p className="type-card-description font-semibold text-amber-200">No provider metrics are available for this period.</p>
                    <p className="mt-1 type-card-description leading-5 text-[var(--ws-text-muted)]">
                        {visiblePosts.length} published post{visiblePosts.length === 1 ? '' : 's'} found. Reach,
                        engagement, leads, conversions, and revenue remain unavailable until a provider sync returns
                        those fields.
                    </p>
                </section>
            ) : null}

            <section aria-labelledby="overview-heading">
                <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500 type-caption font-black text-[var(--ws-text-primary)]">1</span>
                    <div>
                        <h3 id="overview-heading" className="font-semibold text-[var(--ws-text-primary)]">Overview</h3>
                        <p className="type-card-description text-[var(--ws-text-muted)]">The shape of performance in this period</p>
                    </div>
                </div>
                <div className="grid gap-px overflow-hidden rounded-xl border border-[var(--ws-border)] bg-[var(--ws-hover)] sm:grid-cols-2 lg:grid-cols-4">
                    {[
                        { label: 'Impressions', value: formatNumber(totals.impressions), note: `${totals.synced} posts with synced data`, icon: Eye },
                        { label: 'Engagement rate', value: engagementRate === null ? 'Unavailable' : `${engagementRate.toFixed(2)}%`, note: 'Reactions, comments, clicks & shares', icon: Heart },
                        { label: 'Comments', value: formatNumber(totals.comments), note: 'Conversation signal', icon: MessageSquare },
                        { label: 'Link clicks', value: formatNumber(totals.clicks), note: 'Not counted as conversions', icon: MousePointerClick },
                    ].map(({ label, value, note, icon: Icon }) => (
                        <div key={label} className="bg-[var(--ws-canvas)] px-5 py-5">
                            <div className="flex items-center justify-between">
                                <p className="type-caption font-black uppercase tracking-caps text-[var(--ws-text-muted)]">{label}</p>
                                <Icon className="h-4 w-4 text-indigo-300" />
                            </div>
                            <p className="mt-4 text-2xl font-semibold tabular-nums text-[var(--ws-text-primary)]">{value}</p>
                            <p className="mt-1 type-card-description text-[var(--ws-text-muted)]">{note}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section aria-labelledby="content-heading" className="grid gap-6 lg:grid-cols-[1.55fr_0.8fr]">
                <div>
                    <div className="mb-5 flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500 type-caption font-black text-[var(--ws-text-primary)]">2</span>
                        <div>
                            <h3 id="content-heading" className="font-semibold text-[var(--ws-text-primary)]">Content response</h3>
                            <p className="type-card-description text-[var(--ws-text-muted)]">Hover for context; select a post to drill down</p>
                        </div>
                    </div>
                    <div className="relative min-h-64 rounded-xl border border-[var(--ws-border)] bg-[var(--ws-canvas)] p-5">
                        {scoredPosts.length ? (
                            <>
                                <div className="flex h-44 items-end gap-2 border-b border-[var(--ws-border)] pt-8">
                                    {scoredPosts.slice(-16).map((item) => (
                                        <button
                                            key={item.post.id}
                                            type="button"
                                            onMouseEnter={() => setFocusedId(item.post.id)}
                                            onFocus={() => setFocusedId(item.post.id)}
                                            onClick={() => setFocusedId(item.post.id)}
                                            aria-label={`Inspect ${item.post.title || item.post.caption.slice(0, 40)}`}
                                            className="group relative flex h-full min-w-0 flex-1 items-end"
                                        >
                                            <span
                                                className={`block w-full rounded-t-sm transition-all ${
                                                    focusedId === item.post.id ? 'bg-indigo-300' : 'bg-indigo-500/70 group-hover:bg-indigo-400'
                                                }`}
                                                style={{ height: `${Math.max((item.engagements / maxEngagement) * 100, 3)}%` }}
                                            />
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-3 flex justify-between type-caption font-bold uppercase tracking-wider text-slate-600">
                                    <span>{new Date(scoredPosts[0].post.published_at || scoredPosts[0].post.created_at).toLocaleDateString()}</span>
                                    <span>{new Date(scoredPosts.at(-1)!.post.published_at || scoredPosts.at(-1)!.post.created_at).toLocaleDateString()}</span>
                                </div>
                                <p className="mt-4 type-card-description text-[var(--ws-text-muted)]">
                                    Bar height = verified reactions + comments + clicks + shares. It is not a synthetic score.
                                </p>
                            </>
                        ) : (
                            <div className="flex min-h-52 items-center justify-center type-ui text-[var(--ws-text-muted)]">
                                No published content in this range.
                            </div>
                        )}
                    </div>
                </div>

                <aside className="self-end rounded-xl border border-[var(--ws-border)] bg-[var(--ws-panel)]/50 p-5">
                    {focused || topPost ? (
                        (() => {
                            const item = focused || topPost!;
                            return (
                                <>
                                    <div className="flex items-center justify-between">
                                        <span className="rounded-md bg-indigo-500/10 px-2 py-1 type-caption font-black uppercase text-indigo-300">
                                            {focused ? 'Selected post' : 'Top response'}
                                        </span>
                                        <span className="type-ui text-[var(--ws-text-muted)]">{mediaLabel(item.post)}</span>
                                    </div>
                                    <p className="mt-4 line-clamp-3 type-card-description font-semibold leading-6 text-[var(--ws-text-primary)]">
                                        {item.post.title || item.post.caption || 'Untitled post'}
                                    </p>
                                    <dl className="mt-5 space-y-2 border-t border-[var(--ws-border)] pt-4 type-caption">
                                        <div className="flex justify-between"><dt className="text-[var(--ws-text-muted)]">Impressions</dt><dd className="font-bold text-[var(--ws-text-primary)]">{formatNumber(item.metric.impressions)}</dd></div>
                                        <div className="flex justify-between"><dt className="text-[var(--ws-text-muted)]">Engagements</dt><dd className="font-bold text-[var(--ws-text-primary)]">{formatNumber(item.engagements)}</dd></div>
                                        <div className="flex justify-between"><dt className="text-[var(--ws-text-muted)]">Engagement rate</dt><dd className="font-bold text-[var(--ws-text-primary)]">{item.rate === null ? 'Unavailable' : `${item.rate.toFixed(2)}%`}</dd></div>
                                    </dl>
                                    <button
                                        type="button"
                                        onClick={() => onOpenPost(item.post)}
                                        className="mt-5 flex w-full items-center justify-between border-t border-[var(--ws-border)] pt-4 type-caption font-bold text-indigo-300 hover:text-[var(--ws-text-primary)]"
                                    >
                                        Open full post detail <ChevronRight className="h-4 w-4" />
                                    </button>
                                </>
                            );
                        })()
                    ) : (
                        <div className="py-16 text-center">
                            <BarChart3 className="mx-auto h-6 w-6 text-slate-600" />
                            <p className="mt-3 type-card-description text-[var(--ws-text-muted)]">Post detail will appear after metrics sync.</p>
                        </div>
                    )}
                </aside>
            </section>

            <section aria-labelledby="journey-heading">
                <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500 type-caption font-black text-[var(--ws-text-primary)]">3</span>
                    <div>
                        <h3 id="journey-heading" className="font-semibold text-[var(--ws-text-primary)]">Business journey</h3>
                        <p className="type-card-description text-[var(--ws-text-muted)]">Known events stay separate from unavailable outcomes</p>
                    </div>
                </div>
                <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--ws-border)] bg-[var(--ws-canvas)] sm:flex-row sm:items-stretch">
                    {[
                        { label: 'Published', value: visiblePosts.length, tone: 'text-[var(--ws-text-primary)]' },
                        { label: 'Impressions', value: totals.impressions, tone: 'text-indigo-300' },
                        { label: 'Clicks', value: totals.clicks, tone: 'text-cyan-300' },
                        { label: 'Verified leads', value: null, tone: 'text-[var(--brand-blue-300)]' },
                        { label: 'Paid revenue', value: null, tone: 'text-[var(--success-text,var(--success-500))]' },
                    ].map((step, index) => (
                        <React.Fragment key={step.label}>
                            {index > 0 ? <ArrowRight className="mx-auto h-4 w-4 shrink-0 rotate-90 self-center text-slate-700 sm:rotate-0" /> : null}
                            <div className="min-w-0 flex-1 px-4 py-5 text-center">
                                <p className={`text-xl font-semibold tabular-nums ${step.tone}`}>
                                    {step.value === null ? '—' : formatNumber(step.value)}
                                </p>
                                <p className="mt-1 type-caption font-black uppercase tracking-wider text-[var(--ws-text-muted)]">{step.label}</p>
                                {step.value === null ? <p className="mt-1 type-card-description text-[var(--warning-text,var(--warning-500))]/80">Not connected</p> : null}
                            </div>
                        </React.Fragment>
                    ))}
                </div>
            </section>

            <section className="relative overflow-hidden border-l-2 border-purple-400 bg-purple-500/[0.06] px-5 py-5">
                <div className="flex gap-4">
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-purple-300" />
                    <div>
                        <p className="type-caption font-black uppercase tracking-caps text-purple-300">Bonnie insight</p>
                        <p className="mt-2 type-card-description leading-6 text-[var(--ws-text-secondary)]">
                            {leadingType && leadingType.engagements > 0
                                ? `${leadingType.label} content generated the most recorded engagement in this ${rangeDays}-day window: ${formatNumber(leadingType.engagements)} interactions across ${leadingType.posts} post${leadingType.posts === 1 ? '' : 's'}. Review the top post before reusing its format; this is correlation, not proof of cause.`
                                : 'There is not enough synchronized engagement data to explain a performance pattern yet. Bonnie will not infer a winner from publishing volume alone.'}
                        </p>
                    </div>
                </div>
            </section>

            <section className="grid gap-6 border-t border-[var(--ws-border)] pt-8 md:grid-cols-2">
                <div>
                    <h3 className="font-semibold text-[var(--ws-text-primary)]">Leads & revenue</h3>
                    <p className="mt-2 type-card-description leading-6 text-[var(--ws-text-muted)]">
                        Attribution is unavailable in the current social analytics record. Clicks remain traffic events until a verified lead, customer, conversion, or payment relationship is connected.
                    </p>
                </div>
                <div>
                    <h3 className="font-semibold text-[var(--ws-text-primary)]">Recommendations</h3>
                    <p className="mt-2 type-card-description leading-6 text-[var(--ws-text-muted)]">
                        {topPost && topPost.engagements > 0
                            ? `Open “${topPost.post.title || topPost.post.caption.slice(0, 48)}” and compare its message, format, and publishing time with the next two posts.`
                            : 'Publish and synchronize at least two posts before comparing formats or timing.'}
                    </p>
                </div>
            </section>

            {focusedId ? (
                <button
                    type="button"
                    onClick={() => setFocusedId(null)}
                    className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom,0px))] right-5 z-20 flex items-center gap-2 rounded-full border border-[var(--ws-border)] bg-[var(--ws-panel)] px-3 py-2 type-caption text-[var(--ws-text-secondary)] shadow-xl lg:hidden"
                >
                    <X className="h-3.5 w-3.5" /> Clear chart selection
                </button>
            ) : null}
        </div>
    );
}
