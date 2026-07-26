import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Gallery — Scriptorium',
  description:
    'Pre-rendered Scripture shorts. Every verse passed the integrity gate against a live YouVersion response before a single frame was captured.',
};

export default function GalleryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
