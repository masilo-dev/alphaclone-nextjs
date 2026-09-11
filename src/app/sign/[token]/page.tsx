import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ token: string }>;
};

/** Legacy /sign/:token URLs redirect to the canonical public contract portal. */
export default async function SignRedirectPage({ params }: PageProps) {
  const { token } = await params;
  redirect(`/contract/${encodeURIComponent(token)}`);
}
