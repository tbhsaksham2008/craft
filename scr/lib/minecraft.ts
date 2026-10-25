/** Java names and Geyser-prefixed Bedrock names such as ".Player_123". */
export const isValidMinecraftName = (n: string) =>
  /^\.?[A-Za-z0-9_]{3,16}$/.test(n);
