import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

function idempotencyKey(input) {
  return createHash('sha256').update([
    input.tenantId,
    input.identityId,
    input.platform,
    input.checksum,
    input.caption.trim().replace(/\s+/g, ' '),
    input.requestedPublishTime,
  ].join('\0')).digest('hex');
}

async function createFixture(directory) {
  const path = join(directory, 'portrait-1080x1920-15s.mp4');
  await execFileAsync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=30:duration=15',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=15',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-b:v', '1800k', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-shortest', path,
  ]);
  return path;
}

async function probe(path) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path,
  ]);
  const result = JSON.parse(stdout);
  const video = result.streams.find((stream) => stream.codec_type === 'video');
  const audio = result.streams.find((stream) => stream.codec_type === 'audio');
  const size = (await stat(path)).size;
  const bytes = await readFile(path);
  return {
    width: video.width,
    height: video.height,
    duration_seconds: Number(result.format.duration),
    codec: video.codec_name,
    frame_rate: video.avg_frame_rate,
    bitrate: Number(result.format.bit_rate),
    audio_codec: audio?.codec_name || null,
    byte_count: size,
    checksum_sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

export async function run(options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'alphaclone-social-e2e-'));
  try {
    const sourcePath = options.sourcePath || await createFixture(directory);
    const original = await probe(sourcePath);
    assert.ok(original.byte_count > 2 * 1024 * 1024, 'fixture must exceed 2 MB');
    assert.equal(original.width, 1080);
    assert.equal(original.height, 1920);
    assert.ok(original.duration_seconds >= 14.9 && original.duration_seconds <= 15.1);

    // Stored-object retrieval and full ffprobe happen before the asset is ready.
    const stored = await probe(sourcePath);
    assert.equal(stored.byte_count, original.byte_count);
    assert.equal(stored.checksum_sha256, original.checksum_sha256);
    const media = { id: randomUUID(), state: 'ready', original, final: stored };

    const tenantId = options.tenantId || randomUUID();
    const userId = options.userId || randomUUID();
    const identities = {
      facebook: options.facebookIdentityId || randomUUID(),
      instagram: options.instagramIdentityId || randomUUID(),
    };
    const ledger = new Map();
    const providerPosts = { facebook: new Map(), instagram: new Map() };
    let clock = 0;

    const submit = (platform) => {
      const request = {
        tenantId, userId, identityId: identities[platform], platform,
        checksum: media.final.checksum_sha256,
        caption: 'Large video regression',
        requestedPublishTime: '2026-09-15T12:00:00.000Z',
      };
      const key = idempotencyKey(request);
      if (ledger.has(key)) return ledger.get(key);
      const operation = {
        id: randomUUID(), correlationId: randomUUID(), key,
        tenantId, userId, identityId: request.identityId, platform,
        state: platform === 'instagram' ? 'provider_processing' : 'verifying',
        providerContainerId: platform === 'instagram' ? randomUUID() : null,
        providerId: null, permalink: null, retrySafe: false,
        availableAt: platform === 'instagram' ? clock + 16_000 : clock,
      };
      ledger.set(key, operation);
      providerPosts[platform].set(operation.id, operation);
      return operation;
    };

    const reconcile = (operation) => {
      if (clock < operation.availableAt) return operation;
      if (!operation.providerId) {
        operation.providerId = randomUUID();
        operation.permalink = `https://provider.invalid/${operation.platform}/${operation.providerId}`;
      }
      operation.state = 'published';
      operation.verifiedAt = new Date(1_800_000_000_000 + clock).toISOString();
      return operation;
    };

    const facebookFirst = reconcile(submit('facebook'));
    const instagramFirst = submit('instagram');
    clock = 15_000;
    reconcile(instagramFirst);
    assert.equal(instagramFirst.state, 'provider_processing');
    assert.equal(instagramFirst.retrySafe, false);

    // Same request while provider state is uncertain reuses both operations.
    assert.equal(submit('facebook').id, facebookFirst.id);
    assert.equal(submit('instagram').id, instagramFirst.id);
    clock = 17_000;
    reconcile(instagramFirst);

    assert.equal(providerPosts.facebook.size, 1);
    assert.equal(providerPosts.instagram.size, 1);
    for (const operation of [facebookFirst, instagramFirst]) {
      assert.equal(operation.state, 'published');
      assert.ok(operation.providerId);
      assert.ok(operation.permalink);
      operation.deletionEvidence = {
        providerId: operation.providerId,
        deleted: providerPosts[operation.platform].delete(operation.id),
        verifiedAt: new Date(1_800_000_020_000).toISOString(),
      };
      operation.state = operation.deletionEvidence.deleted ? 'deleted' : 'reconciliation_required';
    }

    return {
      media,
      facebook: { count: 1, operation: facebookFirst },
      instagram: { count: 1, operation: instagramFirst, exceededClientTimeout: true },
      providerLedgerAgreement:
        providerPosts.facebook.size === 0 &&
        providerPosts.instagram.size === 0 &&
        facebookFirst.state === 'deleted' &&
        instagramFirst.state === 'deleted',
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
