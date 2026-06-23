import type { Metadata } from 'next';

// Password reset is a sensitive, single-use flow — keep it out of search indexes.
export const metadata: Metadata = {
  title: 'Reset Password',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
