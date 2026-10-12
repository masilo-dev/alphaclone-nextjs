import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';import {execFileSync} from 'node:child_process';import {uiTranslate} from '../../src/i18n/uiTranslate.ts';
const read=p=>fs.readFileSync(p,'utf8');
test('document and contract labels have Polish and Spanish translations',()=>{
 for(const text of ['Service Provider (You)','Client Information','Document intelligence','Not requested','Awaiting signature','Back to documents','Your business. One workspace.','Sign In with Email'])for(const lang of ['pl','es']) assert.notEqual(uiTranslate(lang,text),text,`${lang}: ${text}`);
 assert.equal(uiTranslate('en','Client Information'),'Client Information');
});
test('dark text-white compatibility uses readable foreground, never inverse ink',()=>{
 const css=read('src/app/globals.css');const begin=css.indexOf('html.dark .ac-dashboard-root .text-white');const block=css.slice(begin,css.indexOf('}',begin));assert.match(block,/var\(--ws-text-primary/);assert.doesNotMatch(block,/var\(--text-inverse/);
});
test('login presentation retains authentication handlers unchanged',()=>{
 const path='src/app/auth/login/page.tsx';const before=execFileSync('git',['show',`HEAD:${path}`],{encoding:'utf8'});const after=read(path);
 const handlers=source=>{const file=ts.createSourceFile(path,source,99,true,4);const result=new Map();function visit(n){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&/^handle/.test(n.name.text)&&n.initializer)result.set(n.name.text,n.initializer.getText(file));ts.forEachChild(n,visit);}visit(file);return result;};
 const original=handlers(before),updated=handlers(after);assert.ok(original.size>0);for(const[name,code]of original)assert.equal(updated.get(name),code,name);
 assert.match(after,/ac-signin-brand/);assert.match(after,/SocialAuthButtons/);assert.match(after,/TurnstileWidget/);
});
