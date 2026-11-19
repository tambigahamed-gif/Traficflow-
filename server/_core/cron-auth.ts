export function isAuthorizedCronRequest(authorizationHeader: string | undefined, configuredSecret: string | undefined): boolean {
  const secret = configuredSecret?.trim() ?? "";
  if (!secret || !authorizationHeader) return false;
  return authorizationHeader === `Bearer ${secret}`;
}
