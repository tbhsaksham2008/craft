export type MinecraftStatusResponse = {
  online: boolean;
  players?: { online: number; max: number };
  debug?: { errors?: Array<{ type: string; message: string }> };
};

export function isMinecraftServerAddressConfigured(address: string): boolean {
  const value = address.trim();
  if (
    !value ||
    /^(?:not set(?: yet)?|not configured|changeme|example\.com)$/i.test(value)
  ) {
    return false;
  }
  return true;
}

export function hasMinecraftAddressLookupError(
  status: MinecraftStatusResponse | undefined,
): boolean {
  return status?.debug?.errors?.some((error) => error.type === "ip") ?? false;
}
