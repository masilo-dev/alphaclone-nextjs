import type { Metadata } from 'next';
import CreateBusinessOnboardingGate from './CreateBusinessOnboardingGate';

export const metadata: Metadata = {
  title: 'Create Business Workspace | AlphaClone Systems',
  description: 'Create a new AlphaClone workspace and choose your plan.',
  alternates: { canonical: 'https://alphaclonesystems.com/onboarding/create-business' },
  robots: { index: false, follow: true },
};

export default function Page() {
  return <CreateBusinessOnboardingGate />;
}
