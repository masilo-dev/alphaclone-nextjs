/**
 * File signature (magic bytes) verification guard.
 * Validates file buffer content matches declared MIME types and blocks disguised executables.
 */

export class FileSignatureSecurityError extends Error {
  code = 'INVALID_FILE_SIGNATURE';
  constructor(message: string) {
    super(message);
    this.name = 'FileSignatureSecurityError';
  }
}

/** Known malicious or executable file headers to immediately reject. */
function hasExecutableSignature(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;

  // Windows PE (.exe, .dll, .scr) - MZ
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return true;
  }

  // Linux ELF (.bin, .so)
  if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) {
    return true;
  }

  // Shell script / Unix executable shebang '#!'
  if (buffer[0] === 0x23 && buffer[1] === 0x21) {
    return true;
  }

  return false;
}

/** Check if content is HTML or script disguised as a binary document. */
function hasHtmlScriptSignature(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 1024).toString('utf8').toLowerCase().trim();
  return (
    head.startsWith('<!doctype html') ||
    head.startsWith('<html') ||
    head.startsWith('<script') ||
    head.includes('javascript:')
  );
}

/**
 * Validates that the buffer matches the expected signature for declared MIME type.
 * Throws FileSignatureSecurityError if invalid or dangerous.
 */
export function validateFileSignature(buffer: Buffer, declaredMimeType: string): void {
  if (!buffer || buffer.length === 0) {
    throw new FileSignatureSecurityError('File buffer cannot be empty.');
  }

  if (hasExecutableSignature(buffer)) {
    throw new FileSignatureSecurityError('Executable file signatures (PE/ELF/Scripts) are not permitted.');
  }

  const mime = declaredMimeType.toLowerCase().trim();

  // If declared as binary document/image, verify it is not disguised HTML/script
  if (
    mime.startsWith('image/') ||
    mime === 'application/pdf' ||
    mime.includes('officedocument') ||
    mime === 'application/zip'
  ) {
    if (hasHtmlScriptSignature(buffer)) {
      throw new FileSignatureSecurityError('Disguised HTML/script content is not permitted in document uploads.');
    }
  }

  // PDF
  if (mime === 'application/pdf') {
    const isPdf = buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    if (!isPdf) {
      throw new FileSignatureSecurityError('File content does not match standard PDF header (%PDF-).');
    }
    return;
  }

  // PNG
  if (mime === 'image/png') {
    const isPng =
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a;
    if (!isPng) {
      throw new FileSignatureSecurityError('File content does not match PNG signature.');
    }
    return;
  }

  // JPEG
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (!isJpeg) {
      throw new FileSignatureSecurityError('File content does not match JPEG signature.');
    }
    return;
  }

  // GIF
  if (mime === 'image/gif') {
    const header = buffer.subarray(0, 6).toString('ascii');
    if (header !== 'GIF87a' && header !== 'GIF89a') {
      throw new FileSignatureSecurityError('File content does not match GIF signature.');
    }
    return;
  }

  // WEBP (RIFF....WEBP)
  if (mime === 'image/webp') {
    const riff = buffer.subarray(0, 4).toString('ascii') === 'RIFF';
    const webp = buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    if (!riff || !webp) {
      throw new FileSignatureSecurityError('File content does not match WEBP signature.');
    }
    return;
  }

  // ZIP / DOCX / XLSX / PPTX (PK\x03\x04)
  if (
    mime === 'application/zip' ||
    mime === 'application/x-zip-compressed' ||
    mime.includes('officedocument') ||
    mime.includes('wordprocessingml') ||
    mime.includes('spreadsheetml') ||
    mime.includes('presentationml')
  ) {
    const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
    if (!isZip) {
      throw new FileSignatureSecurityError('File content does not match compressed archive/document signature.');
    }
    return;
  }

  // Plain text / CSV / JSON
  if (mime === 'text/plain' || mime === 'text/csv' || mime === 'application/json' || mime === 'application/xml') {
    // Plain text is allowed unless it contains binary executable code
    return;
  }
}
