import { Studio } from '@/components/studio/Studio';

export const metadata = {
  title: 'Pentecost Studio',
  description:
    'Scripture shorts in your own language. Verse text retrieved from YouVersion, never generated.',
};

export default function Home() {
  return <Studio />;
}