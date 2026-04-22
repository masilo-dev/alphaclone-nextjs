import { redirect } from 'next/navigation';

type AuthorizeAliasPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function AuthorizeAliasPage({ searchParams }: AuthorizeAliasPageProps) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams || {})) {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === 'string') qs.append(key, item);
      });
    } else if (typeof value === 'string') {
      qs.set(key, value);
    }
  }

  const query = qs.toString();
  redirect(query ? `/oauth/authorize?${query}` : '/oauth/authorize');
}
