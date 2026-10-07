import {NextResponse} from 'next/server';
import {getStatusSnapshot} from '@/lib/platform-monitoring/service';
export const dynamic='force-dynamic';
export async function GET() {
 try{return NextResponse.json(await getStatusSnapshot(),{headers:{'Cache-Control':'no-store'}});}
 catch{return NextResponse.json({error:'Status monitoring unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
