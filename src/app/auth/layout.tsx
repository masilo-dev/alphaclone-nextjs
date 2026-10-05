import '@/styles/alphaclone-os-v3.css';
import '@/styles/alphaclone-os-v3-pwa.css';
import '@/styles/apple-fluid-system.css';
import '@/styles/crisp-product-ui.css';

/**
 * Auth surfaces use the Untitled light canvas (navy/teal brand), not the
 * dark electric-blue marketing network background.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ac-auth-root light" data-theme="light">
      {children}
    </div>
  );
}
