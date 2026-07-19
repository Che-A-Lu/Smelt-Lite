const SNAPSHOT_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];

export function canSnapshot(file: File): boolean {
  return SNAPSHOT_TYPES.includes(file.type);
}

export async function generateSnapshot(file: File): Promise<string | null> {
  if (!canSnapshot(file)) return null;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
