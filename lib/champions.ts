export function championIconPath(champion: string): string {
  const id = champion.replace(/[^a-zA-Z]/g, '').toLowerCase();
  return `/champions/${id}.png`;
}
