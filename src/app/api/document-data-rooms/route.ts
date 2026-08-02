import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

const schema = z.object({ tenantId: z.uuid(), name: z.string().trim().min(2).max(200), documentIds: z.array(z.uuid()).min(1).max(100), relatedEntityType: z.string().max(80).optional(), relatedEntityId: z.uuid().optional(), expiresAt: z.iso.datetime({ offset: true }).optional(), allowDownload: z.boolean().default(false) });
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export async function GET(request: NextRequest) {
  try { const tenantId = String(request.nextUrl.searchParams.get('tenantId') || ''); const { admin } = await requireTenantAccess(tenantId, request); const { data, error } = await admin.from('document_data_rooms').select('*, items:document_data_room_items(*, document:documents(id,name,title,mime_type))').eq('tenant_id', tenantId).order('created_at',{ascending:false}); if (error) throw error; return NextResponse.json({ success: true, dataRooms: data || [] }); } catch (error) { return routeErrorResponse(error, 'Data rooms could not be loaded', request); }
}

export async function POST(request: NextRequest) {
  try { const parsed = schema.safeParse(await request.json().catch(() => ({}))); if (!parsed.success) return NextResponse.json({ error: 'Invalid data room', details: parsed.error.flatten() }, { status: 400 }); const input = parsed.data; const { user, admin } = await requireTenantAccess(input.tenantId, request); const { data: docs } = await admin.from('documents').select('id').eq('tenant_id', input.tenantId).in('id', input.documentIds); if ((docs || []).length !== new Set(input.documentIds).size) return NextResponse.json({ error: 'Every document must belong to this workspace' }, { status: 400 }); const token = randomBytes(32).toString('base64url'); const { data: room, error } = await admin.from('document_data_rooms').insert({ tenant_id: input.tenantId, name: input.name, related_entity_type: input.relatedEntityType || null, related_entity_id: input.relatedEntityId || null, status: 'active', token_hash: hash(token), expires_at: input.expiresAt || null, created_by: user.id }).select('*').single(); if (error) throw error; const { error: itemError } = await admin.from('document_data_room_items').insert(input.documentIds.map((documentId,index) => ({ tenant_id: input.tenantId, data_room_id: room.id, document_id: documentId, sort_order: index, allow_download: input.allowDownload }))); if (itemError) { await admin.from('document_data_rooms').delete().eq('tenant_id',input.tenantId).eq('id',room.id); throw itemError; } return NextResponse.json({ success: true, dataRoom: room, shareUrl: `/data-room/${token}`, tokenShownOnce: true }, { status: 201 }); } catch (error) { return routeErrorResponse(error, 'Data room could not be created', request); }
}

export async function PATCH(request: NextRequest) {
  try { const body = z.object({ tenantId: z.uuid(), dataRoomId: z.uuid(), status: z.enum(['active','expired','revoked']) }).parse(await request.json()); const { admin } = await requireTenantAccess(body.tenantId, request); const { data, error } = await admin.from('document_data_rooms').update({ status: body.status }).eq('tenant_id',body.tenantId).eq('id',body.dataRoomId).select('*').single(); if (error) throw error; return NextResponse.json({ success: true, dataRoom: data }); } catch (error) { return routeErrorResponse(error, 'Data room could not be updated', request); }
}
