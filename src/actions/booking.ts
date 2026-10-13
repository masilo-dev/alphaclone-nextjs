'use server'

import { createSupabaseAdminClient } from '@/lib/supabase-admin'
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

export type PublicBookingTenant = Pick<Tenant, 'id' | 'name' | 'slug' | 'logo_url' | 'settings'>;

function publicTenant(tenant: any): PublicBookingTenant {
    const booking = tenant.settings?.booking || {};
    const branding = tenant.settings?.branding || {};
    if (booking.enabled !== true) throw new Error('Online booking is not available for this business');
    return {
        id: tenant.id, name: tenant.name, slug: tenant.slug, logo_url: tenant.logo_url,
        settings: {
            branding: { logo: branding.logo || tenant.logo_url, primaryColor: branding.primaryColor || tenant.brand_color_primary, secondaryColor: branding.secondaryColor },
            booking: { enabled: true, slug: tenant.slug, availability: booking.availability,
                minNotice: booking.minNotice, bufferTime: booking.bufferTime, futureLimit: booking.futureLimit, meetingTypes: [] },
        },
    };
}

export async function fetchBookingData(slug: string, serviceSlug: string): Promise<{ tenant: PublicBookingTenant; service: BookingType }> {
    const supabase = createSupabaseAdminClient();

    // 1. Fetch Tenant
    const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id,name,slug,logo_url,brand_color_primary,settings')
        .eq('slug', slug)
        .single();

    if (tenantError || !tenant) {
        console.error('Fetch tenant error:', tenantError);
        throw new Error('Tenant not found');
    }

    // 2. Fetch Booking Type
    const { data: service, error: serviceError } = await supabase
        .from('booking_types')
        .select('id,slug,name,description,duration,price,currency')
        .eq('tenant_id', tenant.id)
        .eq('slug', serviceSlug)
        .eq('is_active', true)
        .single();

    if (serviceError || !service) {
        console.error('Fetch service error:', serviceError);
        throw new Error('Service not found');
    }

    return { tenant: publicTenant(tenant), service: service as BookingType };
}

export async function fetchTenantBookingPage(slug: string): Promise<{ tenant: PublicBookingTenant; services: BookingType[] }> {
    const supabase = createSupabaseAdminClient();

    // 1. Fetch Tenant
    const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id,name,slug,logo_url,brand_color_primary,settings')
        .eq('slug', slug)
        .single();

    if (tenantError || !tenant) {
        console.error('Fetch tenant error:', tenantError);
        throw new Error('Tenant not found');
    }

    // 2. Fetch All Booking Types for Tenant
    const { data: services, error: servicesError } = await supabase
        .from('booking_types')
        .select('id,slug,name,description,duration,price,currency')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true);

    if (servicesError) {
        console.error('Fetch services error:', servicesError);
        throw new Error('Failed to load services');
    }

    return { tenant: publicTenant(tenant), services: (services || []) as BookingType[] };
}
