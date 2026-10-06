import type { ReactNode } from 'react';
import '@/styles/product-system.css';

export default function ClientAuthLayout({ children }: { children: ReactNode }) {
  return <div className="ac-auth-root light" data-theme="light">{children}</div>;
}
