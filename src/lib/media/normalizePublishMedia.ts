/**
 * Normalize and deduplicate media inputs for publish_social_post / create_social_post.
 */

import {
  buildPublicMediaUrl,
  extractMediaAssetIdFromUrl,
  isBrandedMediaUrl,
  isSupabaseStorageUrl,
  isValidMediaAssetId,
} from '@/lib/media/mediaPublicUrl';
import type { MediaInput } from '@/lib/media/types';

export type NormalizedPublishMediaInput = {
  mediaAssetIds: string[];
  mediaUrls: string[];
  media: MediaInput[];
  rejected: string[];
};

function dedupeOrdered(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = String(raw || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function collectMediaArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((v) => String(v || '').trim()).filter(Boolean);
}

/**
 * Merge media_id, media_asset_id, media_ids, media_asset_ids, media_urls, media[]
 * into deduplicated canonical asset IDs and provider-fetch URLs.
 */
export function normalizePublishMediaArgs(args: Record<string, unknown>): NormalizedPublishMediaInput {
  const rejected: string[] = [];
  const assetIds: string[] = [];
  const rawUrls: string[] = [];
  const mediaItems: MediaInput[] = [];

  for (const id of [
    ...collectMediaArray(args.media_ids),
    ...collectMediaArray(args.media_asset_ids),
    ...collectMediaArray(args.asset_ids),
    ...(args.media_id ? [String(args.media_id)] : []),
    ...(args.media_asset_id ? [String(args.media_asset_id)] : []),
    ...(args.asset_id ? [String(args.asset_id)] : []),
  ]) {
    if (!isValidMediaAssetId(id)) {
      rejected.push(`invalid media asset id: ${id}`);
      continue;
    }
    assetIds.push(id);
  }

  for (const url of [
    ...collectMediaArray(args.media_urls),
    ...(args.media_url ? [String(args.media_url)] : []),
    ...(args.image_url ? [String(args.image_url)] : []),
    ...(args.signed_url ? [String(args.signed_url)] : []),
    ...(args.source_url ? [String(args.source_url)] : []),
  ]) {
    const trimmed = String(url || '').trim();
    if (!trimmed) continue;
    if (isSupabaseStorageUrl(trimmed)) {
      rejected.push('raw storage URLs are not accepted; pass media_asset_id instead');
      continue;
    }
    const brandedId = extractMediaAssetIdFromUrl(trimmed);
    if (brandedId) {
      assetIds.push(brandedId);
      continue;
    }
    if (isBrandedMediaUrl(trimmed)) {
      rejected.push('malformed branded media URL');
      continue;
    }
    rawUrls.push(trimmed);
  }

  if (Array.isArray(args.media)) {
    for (const item of args.media) {
      if (!item || typeof item !== 'object') continue;
      mediaItems.push(item as MediaInput);
    }
  }

  const dedupedIds = dedupeOrdered(assetIds);
  const idSet = new Set(dedupedIds);
  const dedupedUrls = dedupeOrdered(
    rawUrls.filter((url) => {
      const brandedId = extractMediaAssetIdFromUrl(url);
      if (brandedId && idSet.has(brandedId)) return false;
      return true;
    })
  );

  if (dedupedIds.length > 1 && dedupedUrls.length > 0) {
    rejected.push('provide either media_asset_ids or media_urls, not both for multiple assets');
  }

  return {
    mediaAssetIds: dedupedIds,
    mediaUrls: dedupedUrls,
    media: mediaItems,
    rejected,
  };
}

/** Provider-fetch URLs — always branded proxy URLs when asset IDs are known. */
export function providerFetchUrlsForAssets(assetIds: string[]): string[] {
  return dedupeOrdered(assetIds).map((id) => buildPublicMediaUrl(id));
}
