-- Point sequence enrollments at canonical contacts (not legacy crm_contacts)
DELETE FROM public.email_sequence_enrollments ese
WHERE NOT EXISTS (
  SELECT 1 FROM public.contacts c WHERE c.id = ese.contact_id
);

ALTER TABLE public.email_sequence_enrollments
  DROP CONSTRAINT IF EXISTS email_sequence_enrollments_contact_id_fkey;

ALTER TABLE public.email_sequence_enrollments
  ADD CONSTRAINT email_sequence_enrollments_contact_id_fkey
  FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;
