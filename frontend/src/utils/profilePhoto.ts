const PROFILE_PHOTO_STORAGE_PREFIX = 'workpilot_profile_photo:';
const MAX_PROFILE_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_PROFILE_PHOTO_DIMENSION = 512;

export const profilePhotoStorageKey = (email: string): string =>
  `${PROFILE_PHOTO_STORAGE_PREFIX}${email.trim().toLowerCase()}`;

export const prepareProfilePhoto = async (file: File): Promise<string> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose an image file for your profile photo.');
  }

  if (file.size > MAX_PROFILE_PHOTO_BYTES) {
    throw new Error('Choose a photo smaller than 10 MB.');
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();

    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error('The selected photo could not be opened.');
    }

    const scale = Math.min(
      1,
      MAX_PROFILE_PHOTO_DIMENSION /
        Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Your browser could not prepare this photo.');
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch (error) {
    if (
      error instanceof Error
      && (
        error.message === 'The selected photo could not be opened.'
        || error.message === 'Your browser could not prepare this photo.'
      )
    ) {
      throw error;
    }

    throw new Error('Could not read this photo. Try a JPG, PNG, or WebP image.');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
