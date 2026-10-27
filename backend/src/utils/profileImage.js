const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

const imageSignatures = {
  'image/jpeg': (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  'image/png': (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (buffer) => buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
};

function validateProfileImage(image) {
  if (image == null || image === '') return null;
  if (typeof image !== 'string') return undefined;

  const match = image.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) return undefined;

  const [, mimeType, encodedImage] = match;
  const imageBuffer = Buffer.from(encodedImage, 'base64');
  if (
    imageBuffer.length === 0 ||
    imageBuffer.length > MAX_PROFILE_IMAGE_BYTES ||
    !imageSignatures[mimeType](imageBuffer)
  ) {
    return undefined;
  }

  return image;
}

module.exports = { validateProfileImage };
