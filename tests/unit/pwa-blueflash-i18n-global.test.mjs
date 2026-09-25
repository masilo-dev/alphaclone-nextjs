import test from 'node:test';
import assert from 'node:assert/strict';
import * as manifestModule from '../../src/app/manifest.ts';
import { uiTranslate } from '../../src/i18n/uiTranslate.ts';

test('PWA manifest colors match dark canvas #020D1A (zero blue flash)', () => {
    const fn = typeof manifestModule.default === 'function' ? manifestModule.default : manifestModule.default.default;
    const config = fn();
    assert.equal(config.background_color, '#020D1A', 'manifest background_color must be #020D1A');
    assert.equal(config.theme_color, '#020D1A', 'manifest theme_color must be #020D1A');
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
