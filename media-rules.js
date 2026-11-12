const limits = {
  photoCount: 8,
  photoBytes: 25 * 1024 * 1024,
  videoBytes: 250 * 1024 * 1024,
  partBytes: 8 * 1024 * 1024,
};

const formats = new Map([
  ['jpg', ['photo', 'image/jpeg', 'jpeg']],
  ['jpeg', ['photo', 'image/jpeg', 'jpeg']],
  ['png', ['photo', 'image/png', 'png']],
  ['gif', ['photo', 'image/gif', 'gif']],
  ['webp', ['photo', 'image/webp', 'webp']],
  ['heic', ['photo', 'image/heic', 'heif']],
  ['heif', ['photo', 'image/heif', 'heif']],
  ['mp4', ['video', 'video/mp4', 'mp4']],
  ['mov', ['video', 'video/quicktime', 'mp4']],
  ['m4v', ['video', 'video/mp4', 'mp4']],
  ['webm', ['video', 'video/webm', 'webm']],
]);

function mediaType(name) {
  const extension = name.match(/\.([a-z0-9]+)$/i)?.[1].toLowerCase();
  const type = formats.get(extension);
  if (!type) return null;
  const [kind, contentType, signature] = type;
  return {kind, contentType, signature, extension};
}
