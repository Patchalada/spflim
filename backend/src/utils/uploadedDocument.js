const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const documentSignatures = {
  'image/jpeg': (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  'image/png': (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP',
  'application/pdf': (buffer) => buffer.length >= 5 && buffer.toString('ascii', 0, 5) === '%PDF-'
};

function validateUploadedDocument(document) {
  if (typeof document !== 'string') return undefined;

  // ตัด whitespace ที่อาจติดมา
  const cleaned = document.trim();
  const match = cleaned.match(/^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,([A-Za-z0-9+/=\r\n\s]+)$/);
  if (!match) return undefined;

  const mimeType = match[1];
  const encodedDocument = match[2].replace(/\s+/g, '');
  const documentBuffer = Buffer.from(encodedDocument, 'base64');
  if (
    documentBuffer.length === 0 ||
    documentBuffer.length > MAX_DOCUMENT_BYTES ||
    !documentSignatures[mimeType](documentBuffer)
  ) {
    return undefined;
  }

  return {
    data: cleaned,
    mimeType,
    isImage: mimeType.startsWith('image/'),
    isPdf: mimeType === 'application/pdf'
  };
}

module.exports = { validateUploadedDocument };
