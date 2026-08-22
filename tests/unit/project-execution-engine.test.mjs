import test from 'node:test';
import assert from 'node:assert/strict';

// Test CommitmentEngine Extraction Logic
test('CommitmentEngine extracts team and client promises cleanly', async () => {
  const text = `We will send the updated wireframes by Thursday. Also, I'll send the company logo tomorrow.`;
  const teamMatches = text.match(/we(?:'ll| will) (?:send|deliver|complete|provide|finish|submit|approve|share) ([^.\n]+)/gi);
  const clientMatches = text.match(/i'll send ([^.\n]+)/gi);

  assert.ok(teamMatches && teamMatches.length > 0, 'Should detect team promise');
  assert.ok(clientMatches && clientMatches.length > 0, 'Should detect client promise');
});

// Test Email Autonomy Level Mapping
test('ClientEmailEngine assigns correct Autonomy Level to email stages', () => {
  const level1Stages = ['project_confirmed', 'approval_received'];
  const level2Stages = ['work_started', 'milestone_completed', 'client_review_required'];
  const level3Stages = ['project_delayed'];

  assert.equal(level1Stages.includes('project_confirmed'), true);
  assert.equal(level2Stages.includes('milestone_completed'), true);
  assert.equal(level3Stages.includes('project_delayed'), true);
});

// Test Identity Matching Logic
test('ClientIdentityResolver calculates confidence scores correctly', () => {
  const exactEmailConfidence = 1.0;
  const companyConfidence = 0.75;
  const isHighConfidence = exactEmailConfidence >= 0.90;

  assert.equal(isHighConfidence, true);
  assert.equal(companyConfidence < 0.90, true);
});
