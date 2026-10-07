import {NextRequest,NextResponse} from 'next/server';
import {denyIfCronUnauthorized} from '@/lib/cronAuth';
import {runMonitoring} from '@/lib/platform-monitoring/service';
export const dynamic='force-dynamic';
export const maxDuration=55;
export async function GET(req:NextRequest) {
 const denied=denyIfCronUnauthorized(req);if(denied)return denied;
 try{return NextResponse.json(await runMonitoring(),{headers:{'Cache-Control':'no-store'}});}
 catch{return NextResponse.json({error:'Monitoring run failed'},{status:503});}
}
