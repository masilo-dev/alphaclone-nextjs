import { redirect } from 'next/navigation';

/** Legacy URL — case studies live at /results */
export default function CustomersPage() {
  redirect('/results');
}
