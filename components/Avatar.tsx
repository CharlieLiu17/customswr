import Image from 'next/image';

/** Circular player picture; renders nothing when the player has no avatar. */
export default function Avatar({ src, name, size }: { src: string | null; name: string; size: number }) {
  if (!src) return null;
  return <Image src={src} alt={`${name}'s profile picture`} width={size} height={size} style={{ borderRadius: '50%', objectFit: 'cover', verticalAlign: 'middle', flexShrink: 0 }} />;
}
