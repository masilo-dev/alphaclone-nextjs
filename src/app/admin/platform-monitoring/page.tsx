import {redirect} from 'next/navigation';
import {requirePlatformSuperAdmin} from '@/lib/apiAuth';
import MonitoringAdmin from './MonitoringAdmin';
export const dynamic='force-dynamic';
export default async function Page(){try{await requirePlatformSuperAdmin();}catch{redirect('/auth/login?returnTo=%2Fadmin%2Fplatform-monitoring');}return <MonitoringAdmin/>;}
