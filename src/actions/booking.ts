'use server'

import { createClient } from '@/lib/supabase-server'
import { Tenant } from '@/services/tenancy/types'

// Define the BookingType interface here directly or import it if you move it to a shared file.
// Since it was local to page.tsx, we'll redefine it here to be safe and typed.
export interface BookingType {
    id: string;
    slug: string;
    name: string;
    description: string;
    duration: number;
    price: number;
    currency: string;
}

export async function fetchBookingData(slug: string, serviceSlug: string): Promise<{ tenant: Tenant; service: BookingType }> {
    const supabase = await createClient();

    // 1. Fetch Tenant
    const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('slug', slug)
        .single();

    if (tenantError || !tenant) {
        console.error('Fetch tenant error:', tenantError);
        throw new Error('Tenant not found');
    }

    // 2. Fetch Booking Type
    const { data: service, error: serviceError } = await supabase
        .from('booking_types')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('slug', serviceSlug)
        .single();

    if (serviceError || !service) {
        console.error('Fetch service error:', serviceError);
        throw new Error('Service not found');
    }

    return { tenant: tenant as Tenant, service: service as BookingType };
}

export async function fetchTenantBookingPage(slug: string): Promise<{ tenant: Tenant; services: BookingType[] }> {
    const supabase = await createClient();

    // 1. Fetch Tenant
    const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('*')
        .eq('slug', slug)
        .single();

    if (tenantError || !tenant) {
        console.error('Fetch tenant error:', tenantError);
        throw new Error('Tenant not found');
    }

    // 2. Fetch All Booking Types for Tenant
    const { data: services, error: servicesError } = await supabase
        .from('booking_types')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('active', true); // Assuming there's an active flag, otherwise remove

    if (servicesError) {
        console.error('Fetch services error:', servicesError);
        throw new Error('Failed to load services');
    }

    return { tenant: tenant as Tenant, services: (services || []) as BookingType[] };
}
