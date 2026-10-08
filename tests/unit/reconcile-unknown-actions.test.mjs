import test from 'node:test';
import assert from 'node:assert/strict';

import {
  reconcileUnknownExternalActions,
} from '../../src/lib/execution/reconcileUnknownExternalActions.ts';

test('reconcileUnknownExternalActions exports valid processor function', () => {
  assert.equal(typeof reconcileUnknownExternalActions, 'function');
});
