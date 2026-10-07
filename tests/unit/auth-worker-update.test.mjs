import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activateAuthPageUpdate } from '../../src/lib/pwa/registerServiceWorker.ts';

test('login adopts the waiting fix, dashboard preserves its update prompt', () => {
    const oldWindow = globalThis.window;
    try {
        const sent = [];
        const registration = { waiting: { postMessage(value) { sent.push(value); } }, installing: null, addEventListener() {} };
        globalThis.window = { location: { pathname: '/auth/login' } };
        activateAuthPageUpdate(registration);
        assert.deepEqual(sent, [{ type: 'SKIP_WAITING' }]);
        globalThis.window.location.pathname = '/dashboard';
        activateAuthPageUpdate(registration);
        assert.equal(sent.length, 1);
    } finally { globalThis.window = oldWindow; }
});
test('a worker installed after entering login is activated', () => {
    const oldWindow = globalThis.window;
    try {
        globalThis.window = { location: { pathname: '/portal-login' } };
        let stateChange;
        let sent = false;
        const worker = { state: 'installing', addEventListener(type, handler) { assert.equal(type, 'statechange'); stateChange = handler; } };
        const registration = { waiting: null, installing: worker, addEventListener() {} };
        activateAuthPageUpdate(registration);
        worker.state = 'installed';
        registration.waiting = { postMessage() { sent = true; } };
        stateChange();
        assert.equal(sent, true);
    } finally { globalThis.window = oldWindow; }
});
