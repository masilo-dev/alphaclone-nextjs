import test from 'node:test';
import assert from 'node:assert/strict';
import * as manifestModule from '../../src/app/manifest.ts';
import { uiTranslate } from '../../src/i18n/uiTranslate.ts';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

test('PWA manifest colors match dark canvas (zero blue flash)', () => {
    const fn = typeof manifestModule.default === 'function' ? manifestModule.default : manifestModule.default.default;
    const config = fn();
    assert.ok(config.background_color === '#0D0F18' || config.background_color === '#020D1A', 'manifest background_color must match dark canvas');
    assert.ok(config.theme_color === '#0D0F18' || config.theme_color === '#020D1A', 'manifest theme_color must match dark canvas');
    assert.equal(config.display, 'standalone');
    assert.equal(config.scope, '/');
});

test('uiTranslate translates core actions and PWA strings to Polish and Spanish', () => {
    // English identity
    assert.equal(uiTranslate('en', 'Install AlphaClone'), 'Install AlphaClone');
    assert.equal(uiTranslate('en', 'Save'), 'Save');

    // Spanish
    assert.equal(uiTranslate('es', 'Install AlphaClone'), 'Instalar AlphaClone');
    assert.equal(uiTranslate('es', 'Save'), 'Guardar');
    assert.equal(uiTranslate('es', 'Cancel'), 'Cancelar');
    assert.equal(uiTranslate('es', 'Delete'), 'Eliminar');
    assert.equal(uiTranslate('es', 'More'), 'Más');
    assert.equal(uiTranslate('es', 'Create'), 'Crear');
    assert.equal(uiTranslate('es', 'Add client'), 'Añadir cliente');

    // Polish
    assert.equal(uiTranslate('pl', 'Install AlphaClone'), 'Zainstaluj AlphaClone');
    assert.equal(uiTranslate('pl', 'Save'), 'Zapisz');
    assert.equal(uiTranslate('pl', 'Cancel'), 'Anuluj');
    assert.equal(uiTranslate('pl', 'Delete'), 'Usuń');
    assert.equal(uiTranslate('pl', 'More'), 'Więcej');
    assert.equal(uiTranslate('pl', 'Create'), 'Utwórz');
    assert.equal(uiTranslate('pl', 'Add client'), 'Dodaj klienta');
});

test('uiTranslate handles whitespace trimming seamlessly', () => {
    assert.equal(uiTranslate('pl', '  Save  '), 'Zapisz');
    assert.equal(uiTranslate('es', '  Cancel \n'), 'Cancelar');
    assert.equal(uiTranslate('pl', '  Install AlphaClone  '), 'Zainstaluj AlphaClone');
});

test('uiTranslate preserves unknown or empty text safely without crashing', () => {
    assert.equal(uiTranslate('pl', ''), '');
    assert.equal(uiTranslate('es', null), null);
    assert.equal(uiTranslate('pl', 'Custom User Business Note 123'), 'Custom User Business Note 123');
});

test('marketing page headings translate beyond the shared navigation', () => {
    const headings = [
        'You type.',
        'Connect agency pipeline, campaign work, and delivery handoffs',
        'Built for teams that sell',
        'Get in touch',
        'Why AlphaClone exists',
        'The tools held the information. I still had to make everything move.',
        'Reliability, recovery, and honest limits',
        'Bring CRM, billing, projects, contracts, meetings, and analytics into one workspace. Built for agencies, freelancers, and service businesses that want fewer disconnected systems.',
        'Business publishing and connected social workflows',
    ];
    for (const lang of ['pl', 'es']) {
        for (const heading of headings) {
            assert.notEqual(uiTranslate(lang, heading), heading, `${lang} must translate ${heading}`);
        }
    }
});

test('every rendered Services page detail has Polish and Spanish copy', () => {
    const source = readFileSync(new URL('../../src/components/pages/ServicesPage.tsx', import.meta.url), 'utf8');
    const ast = ts.createSourceFile('ServicesPage.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const phrases = new Set();
    const fields = new Set(['title', 'subtitle', 'badge', 'description', 'extendedDescription', 'impact', 'desc']);
    const visit = (node) => {
        if (ts.isPropertyAssignment(node) && fields.has(node.name.getText(ast)) && ts.isStringLiteralLike(node.initializer)) {
            phrases.add(node.initializer.text);
        }
        if (ts.isPropertyAssignment(node) && node.name.getText(ast) === 'features' && ts.isArrayLiteralExpression(node.initializer)) {
            for (const entry of node.initializer.elements) if (ts.isStringLiteralLike(entry)) phrases.add(entry.text);
        }
        if (ts.isCallExpression(node) && node.expression.getText(ast) === 't' && ts.isStringLiteralLike(node.arguments[0])) {
            phrases.add(node.arguments[0].text);
        }
        ts.forEachChild(node, visit);
    };
    visit(ast);
    for (const lang of ['pl', 'es']) {
        const missing = [...phrases].filter((phrase) => uiTranslate(lang, phrase) === phrase);
        assert.deepEqual(missing, [], `${lang} has untranslated Services page copy`);
    }
});

test('cookie banner controls and descriptions translate with the selected language', () => {
    const source = readFileSync(new URL('../../src/components/legal/CookieBanner.tsx', import.meta.url), 'utf8');
    const ast = ts.createSourceFile('CookieBanner.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const phrases = new Set();
    const visit = (node) => {
        if (ts.isCallExpression(node) && node.expression.getText(ast) === 't' && ts.isStringLiteralLike(node.arguments[0])) {
            phrases.add(node.arguments[0].text);
        }
        ts.forEachChild(node, visit);
    };
    visit(ast);
    for (const lang of ['pl', 'es']) {
        assert.deepEqual([...phrases].filter((phrase) => uiTranslate(lang, phrase) === phrase), [], `${lang} has untranslated cookie controls`);
    }
});
