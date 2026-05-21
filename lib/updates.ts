export function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const aVal = aParts[i] ?? 0;
    const bVal = bParts[i] ?? 0;
    if (aVal !== bVal) return aVal - bVal;
  }
  return 0;
}

export function isVersionBelowMinimum(
  runningVersion: string | null,
  minimumVersion: string | null
): boolean {
  if (minimumVersion === null || runningVersion === null) return false;
  return compareVersions(runningVersion, minimumVersion) < 0;
}
