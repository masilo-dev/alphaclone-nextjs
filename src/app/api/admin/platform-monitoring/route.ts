import {NextResponse} from 'next/server';
import {requirePlatformSuperAdmin,routeErrorResponse} from '@/lib/apiAuth';
import {createSupabaseAdminClient} from '@/lib/supabase-admin';
export const dynamic='force-dynamic';
export async function GET() {
 try {
 await requirePlatformSuperAdmin();
 const admin=createSupabaseAdminClient();
 const [checks,successes]=await Promise.all([
 admin.from('platform_health_checks').select('*').order('checked_at',{ascending:false}).limit(500),
 admin.from('platform_health_checks').select('service_name,checked_at').eq('status','operational').contains('metadata_json',{verified:true}).order('checked_at',{ascending:false}).limit(1000)]);
 if(checks.error||successes.error)throw new Error('Monitoring evidence unavailable');
 return NextResponse.json({checks:checks.data,last_successful:successes.data},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return routeErrorResponse(error);}
}
