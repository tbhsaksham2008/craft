export type VotingSite = {
  id: string;
  name: string;
  url: string;
  description: string;
  enabled: boolean;
};

export function normalizeVotingUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      !url.hostname
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
