ALTER TABLE public.onboarding_submissions
  DROP CONSTRAINT IF EXISTS onboarding_submissions_status_check;

ALTER TABLE public.onboarding_submissions
  ADD CONSTRAINT onboarding_submissions_status_check
  CHECK (status IN ('pending', 'submitted', 'approved', 'rejected'));
