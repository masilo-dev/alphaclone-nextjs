import type {Metadata} from 'next';
import StatusDashboard from './StatusDashboard';
export const metadata:Metadata={title:'AlphaClone Systems Status',description:'Verified production service health and incident history.'};
export default function Page(){return <StatusDashboard/>;}
