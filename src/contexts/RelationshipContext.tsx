'use client';

import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export type RelationshipObjectType =
  | 'customer' | 'contact' | 'lead' | 'deal' | 'project' | 'contract' | 'invoice'
  | 'quote' | 'meeting' | 'document' | 'portal';

export type RelationshipRef = { type: RelationshipObjectType; id: string; label?: string };

export type RelationshipContextValue = {
  customerId?: string;
  contactId?: string;
  leadId?: string;
  current?: RelationshipRef;
  related: RelationshipRef[];
  withRelationship: (href: string, extra?: Record<string, string | undefined | null>) => string;
  customer360Url: (customerId?: string) => string;
  moduleUrl: (module: 'crm'|'deals'|'projects'|'contracts'|'billing'|'calendar'|'documents'|'mail', extra?: Record<string, string | undefined | null>) => string;
};

const RelationshipContext = createContext<RelationshipContextValue | null>(null);

const ID_KEYS: Array<[string, RelationshipObjectType]> = [
  ['invoiceId','invoice'], ['contractId','contract'], ['projectId','project'], ['dealId','deal'],
  ['leadId','lead'], ['contactId','contact'], ['documentId','document'], ['quoteId','quote'],
];

const MODULE_PATHS = {
  crm: '/dashboard/crm/workspace',
  deals: '/dashboard/deals',
  projects: '/dashboard/business/projects/manage',
  contracts: '/dashboard/business/contracts',
  billing: '/dashboard/business/billing/manage',
  calendar: '/dashboard/calendar',
  documents: '/dashboard/business/documents',
  mail: '/dashboard/mail',
} as const;

function addParams(href: string, params: Record<string, string | undefined | null>) {
  const [base, raw = ''] = href.split('?');
  const query = new URLSearchParams(raw);
  Object.entries(params).forEach(([key,value]) => {
    if (value) query.set(key,value);
  });
  const suffix=query.toString();
  return suffix ? `${base}?${suffix}` : base;
}

export function RelationshipProvider({ children }: { children: React.ReactNode }) {
  const pathname=usePathname() || '';
  const search=useSearchParams();
  const customerId=search.get('clientId') || search.get('customerId') || undefined;
  const contactId=search.get('contactId') || search.get('contact') || undefined;
  const leadId=search.get('leadId') || undefined;

  const current=useMemo<RelationshipRef | undefined>(() => {
    for (const [key,type] of ID_KEYS) {
      const id=search.get(key);
      if (id) return { type, id };
    }
    if (customerId) return { type:'customer', id:customerId };
    if (pathname.includes('/projects/')) {
      const id=pathname.match(/\/projects\/([0-9a-f-]{36})/i)?.[1];
      if (id) return { type:'project', id };
    }
    return undefined;
  },[search,customerId,pathname]);

  const related=useMemo(() => {
    const refs: RelationshipRef[]=[];
    if (customerId) refs.push({type:'customer',id:customerId});
    if (contactId) refs.push({type:'contact',id:contactId});
    if (leadId) refs.push({type:'lead',id:leadId});
    for (const [key,type] of ID_KEYS) {
      const id=search.get(key);
      if (id && !refs.some(r=>r.type===type&&r.id===id)) refs.push({type,id});
    }
    return refs;
  },[search,customerId,contactId,leadId]);

  const withRelationship=useCallback((href:string, extra:Record<string,string|undefined|null>={}) =>
    addParams(href,{clientId:customerId,contactId,leadId,...extra}),[customerId,contactId,leadId]);

  const customer360Url=useCallback((id?:string) =>
    addParams(MODULE_PATHS.crm,{clientId:id || customerId,contactId: id || customerId ? undefined : contactId}),[customerId,contactId]);

  const moduleUrl=useCallback((module:keyof typeof MODULE_PATHS, extra:Record<string,string|undefined|null>={}) =>
    withRelationship(MODULE_PATHS[module],extra),[withRelationship]);

  const value=useMemo(() => ({customerId,contactId,leadId,current,related,withRelationship,customer360Url,moduleUrl}),
    [customerId,contactId,leadId,current,related,withRelationship,customer360Url,moduleUrl]);

  return <RelationshipContext.Provider value={value}>{children}</RelationshipContext.Provider>;
}

export function useRelationship() {
  const context=useContext(RelationshipContext);
  if (!context) throw new Error('useRelationship must be used inside RelationshipProvider');
  return context;
}

export function useRelationshipOptional() {
  return useContext(RelationshipContext);
}
