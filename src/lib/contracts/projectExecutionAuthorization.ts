import type {SupabaseClient} from '@supabase/supabase-js';
/** A client-only signature never authorizes delivery or financial lifecycle work. */
export async function contractIsFullyExecuted(db:SupabaseClient,tenantId:string,contractId:string):Promise<boolean> {
  const contract=await db.from('contracts').select('status,lifecycle_status').eq('tenant_id',tenantId).eq('id',contractId).maybeSingle();
  if(contract.error)throw contract.error;
  if(!contract.data)return false;
  if(!['fully_signed','signed','active','expiring','renewed'].includes(String(contract.data.status).toLowerCase()) && !['signed','active','expiring','renewed'].includes(String(contract.data.lifecycle_status).toLowerCase()))return false;
  const parties=await db.from('contract_parties').select('signature_required,signature_status').eq('tenant_id',tenantId).eq('contract_id',contractId);
  if(parties.error)throw parties.error;
  const required=(parties.data || []).filter(p=>p.signature_required!==false);
  if(required.length)return required.every(p=>p.signature_status==='signed');
  return String(contract.data.status).toLowerCase()==='fully_signed';
}
export async function assertContractFullyExecuted(db:SupabaseClient,tenantId:string,contractId:string) {
  if(!(await contractIsFullyExecuted(db,tenantId,contractId)))throw Object.assign(new Error('Contract is not fully executed; project activation and financial automation are blocked'),{code:'CONTRACT_NOT_EXECUTED'});
}
