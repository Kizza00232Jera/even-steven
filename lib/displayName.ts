export function resolveDisplayName(
  groupDisplayName: string | null | undefined,
  accountDisplayName: string | null | undefined,
  gmailName: string | null | undefined,
  email: string,
): string {
  const group = groupDisplayName?.trim();
  if (group) return group;
  const account = accountDisplayName?.trim();
  if (account) return account;
  const gmail = gmailName?.trim();
  if (gmail) return gmail;
  return email;
}

export function resolveAvatarUrl(
  customAvatarUrl: string | null | undefined,
  googleAvatarUrl: string | null | undefined
): string | null {
  return customAvatarUrl ?? googleAvatarUrl ?? null;
}
