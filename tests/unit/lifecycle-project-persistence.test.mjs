import test from 'node:test';
import assert from 'node:assert/strict';
import {updatePersistedProject} from '../../src/lib/projects/projectPersistence.ts';
import {resolveCanonicalLifecycleClient,assertLifecycleEmailAvailable} from '../../src/lib/crm/resolveCanonicalLifecycleClient.ts';
function database(rows) {
 const writes=[];
 return {writes,from(table) {let filters=[],patch=null,max=Infinity;const query={
 select(){return query},eq(k,v){filters.push(r=>r[k]===v);return query},ilike(k,v){filters.push(r=>r[k]?.toLowerCase()===v.toLowerCase());return query},limit(n){max=n;return query},update(v){patch=v;return query},
 async maybeSingle(){const result=await query;return {...result,data:result.data[0]||null}},async single(){return query.maybeSingle()},
 then(resolve,reject){const matching=(rows[table]||[]).filter(r=>filters.every(f=>f(r))).slice(0,max);if(patch){writes.push({table,patch});matching.forEach(r=>Object.assign(r,patch));}return Promise.resolve({data:matching,error:null}).then(resolve,reject)}
 };return query}};
}
test('canonical update persists normalized status and description',async()=>{const rows={projects:[{id:'p',tenant_id:'t',status:'Active'}]};const db=database(rows);const saved=await updatePersistedProject(db,'t','p',{description:'TEST ONLY',status:'completed'});assert.equal(rows.projects[0].status,'Completed');assert.equal(saved.description,'TEST ONLY');assert.equal(saved.receipt.status,'verified');});
test('foreign tenant cannot update; legacy project fallback is preserved',async()=>{const db=database({projects:[{id:'p',tenant_id:'other'}],business_projects:[{id:'legacy',tenant_id:'t'}]});await assert.rejects(()=>updatePersistedProject(db,'t','p',{description:'bad'}),/workspace/);assert.equal(db.writes.length,0);await updatePersistedProject(db,'t','legacy',{description:'TEST ONLY'});assert.equal(db.writes[0].table,'business_projects');});
test('only explicit unique canonical contact links resolve',async()=>{const db=database({business_clients:[{id:'c',tenant_id:'t',crm_contact_id:'contact'},{id:'x',tenant_id:'other',crm_contact_id:'contact'}]});assert.equal(await resolveCanonicalLifecycleClient(db,'t','contact'),'c');assert.equal(await resolveCanonicalLifecycleClient(db,'t','c'),'c');await assert.rejects(()=>resolveCanonicalLifecycleClient(db,'t','missing'),/workspace/);const ambiguous=database({business_clients:[{id:'c',tenant_id:'t',crm_contact_id:'contact'},{id:'d',tenant_id:'t',crm_contact_id:'contact'}]});await assert.rejects(()=>resolveCanonicalLifecycleClient(ambiguous,'t','contact'),/multiple/);});
test('duplicate email check rejects without merging or writing',async()=>{const db=database({business_clients:[{id:'c',tenant_id:'t',email:'bonniiehendrix@gmail.com'}]});await assert.rejects(()=>assertLifecycleEmailAvailable(db,'t','BONNIIEHENDRIX@gmail.com',['business_clients']),/existing record/);assert.equal(db.writes.length,0);});
test('update cannot move a project or erase its creation retry marker',async()=>{const db=database({projects:[{id:'p',tenant_id:'t'}]});for(const fields of [{tenant_id:'other'},{id:'other'},{metadata:{}}])await assert.rejects(()=>updatePersistedProject(db,'t','p',fields),/cannot be changed/);assert.equal(db.writes.length,0);});
