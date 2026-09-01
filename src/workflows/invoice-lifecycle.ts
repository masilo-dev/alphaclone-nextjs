import {
  runInvoiceInitialSend,
  type InvoiceLifecycleInput,
} from '@/lib/invoices/invoiceLifecycleSteps';

export type { InvoiceLifecycleInput };

export async function invoiceLifecycleWorkflow(input: InvoiceLifecycleInput) {
  "use workflow";

  await runInvoiceInitialSend(input);
}
