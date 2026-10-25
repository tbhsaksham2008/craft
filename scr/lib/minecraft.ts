/** Minecraft Java usernames: 3–16 chars, letters, digits, underscore. */
export const isValidMinecraftName = (n: string) => /^[A-Za-z0-9_]{3,16}$/.test(n);
