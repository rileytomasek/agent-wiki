const excluded = new Set(['node_modules', 'vendor', 'dist', 'build']);

/** Applies equally to discovered content and explicitly requested documents. */
export function isDiscoveredPath(path: string): boolean {
  return path
    .split('/')
    .every(
      (part) => part !== '' && !part.startsWith('.') && !excluded.has(part)
    );
}
