import { tenantService } from '@/services/tenancy/TenantService';

export const googleDriveService = {
  async uploadFile(_userId: string, blob: Blob, filename: string) {
    const tenantId = tenantService.getCurrentTenantId();
    if (!tenantId) throw new Error('Select a workspace before uploading to Google Drive.');
    const form = new FormData();
    form.set('tenantId', tenantId);
    form.set('filename', filename);
    form.set('file', blob, filename);
    const response = await fetch('/api/google/drive/upload', { method: 'POST', body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Google Drive upload failed');
    return data.file;
  },
};

export default googleDriveService;
