import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Regression: the AI draft streams for ~25s, but the preview, signature pad
 * and Save button were live from the first token. generateContract then
 * reset contractId / isSigned / signature *after* the stream finished, so a
 * user who signed and saved mid-stream lost both and hit
 * "Save the contract first before sending" — with a truncated draft saved.
 */
const source = readFileSync(
  new URL('../../src/components/contracts/ContractDashboard.tsx', import.meta.url),
  'utf8',
);

function generateContractBody() {
  const start = source.indexOf('const generateContract = async () => {');
  assert.ok(start > -1, 'generateContract must exist');
  const end = source.indexOf('const saveContract = async () => {', start);
  assert.ok(end > start, 'saveContract must follow generateContract');
  return source.slice(start, end);
}

test('draft state is reset before streaming starts, never after it finishes', () => {
  const body = generateContractBody();
  const streamStart = body.indexOf("setStep('preview')");
  assert.ok(streamStart > -1);
  const before = body.slice(0, streamStart);
  const after = body.slice(streamStart);

  for (const reset of ["setContractId('')", 'setIsSigned(false)', "setSignatureData('')", "setSignatureName('')"]) {
    assert.ok(before.includes(reset), `${reset} must run before the stream opens`);
    assert.equal(after.includes(reset), false, `${reset} must not run after streaming — it would wipe a signature adopted mid-stream`);
  }
  assert.match(after, /finally \{\s*setIsGenerating\(false\);/, 'isGenerating must always be cleared');
});

test('signing, refining and saving wait until the draft has finished streaming', () => {
  assert.match(source, /\{!isSigned && !isEditing && !isGenerating && \(/, 'signature panel hidden while generating');
  assert.match(source, /onClick=\{saveContract\}\s+disabled=\{isSaving \|\| isGenerating\}/, 'Save disabled while generating');
  assert.match(source, /data-testid="contract-generating"/, 'a visible drafting status replaces the signature panel');
  const refine = source.match(/onClick=\{\(\) => setIsEditing\(!isEditing\)\}\s+disabled=\{isGenerating\}/);
  assert.ok(refine, 'Refine Text disabled while generating');
});
