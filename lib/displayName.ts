export function resolveDisplayName(
  groupDisplayName: string | null | undefined,
  accountDisplayName: string | null | undefined,
  gmailName: string | null | undefined
): string {
  const group = groupDisplayName?.trim();
  if (group) return group;
  const account = accountDisplayName?.trim();
  if (account) return account;
  return gmailName?.trim() ?? '';
}

export function resolveAvatarUrl(
  customAvatarUrl: string | null | undefined,
  googleAvatarUrl: string | null | undefined
): string | null {
  return customAvatarUrl ?? googleAvatarUrl ?? null;
}
