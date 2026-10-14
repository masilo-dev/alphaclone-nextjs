import type { InvoiceLifecycleInput } from '@/lib/invoices/invoiceLifecycleSteps';

export type { InvoiceLifecycleInput };

export async function invoiceLifecycleWorkflow(input: InvoiceLifecycleInput) {
  "use workflow";

  await runInvoiceInitialSendStep(input);
}

async function runInvoiceInitialSendStep(input: InvoiceLifecycleInput) {
  "use step";
  const { runInvoiceInitialSend } = await import('@/lib/invoices/invoiceLifecycleSteps');
  return runInvoiceInitialSend(input);
}
