BEGIN;

ALTER TABLE public.contract_audit_trail
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

UPDATE public.contract_audit_trail trail
SET tenant_id = contract.tenant_id
FROM public.contracts contract
WHERE trail.contract_id = contract.id AND trail.tenant_id IS NULL;

ALTER TABLE public.contract_audit_trail
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN action TYPE TEXT,
  DROP CONSTRAINT IF EXISTS contract_audit_trail_action_check;

ALTER TABLE public.contract_audit_trail
  ADD CONSTRAINT contract_audit_trail_action_format_check
  CHECK (action ~ '^[a-z0-9_:-]{2,100}$') NOT VALID;
ALTER TABLE public.contract_audit_trail
  VALIDATE CONSTRAINT contract_audit_trail_action_format_check;

CREATE INDEX IF NOT EXISTS idx_contract_audit_tenant_contract
  ON public.contract_audit_trail (tenant_id, contract_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.enforce_contract_audit_tenant()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE resolved_tenant UUID;
BEGIN
  SELECT tenant_id INTO resolved_tenant FROM public.contracts WHERE id = NEW.contract_id;
  IF resolved_tenant IS NULL THEN RAISE EXCEPTION 'Contract not found for audit event'; END IF;
  IF NEW.tenant_id IS NOT NULL AND NEW.tenant_id <> resolved_tenant THEN
    RAISE EXCEPTION 'Contract audit tenant mismatch';
  END IF;
  NEW.tenant_id := resolved_tenant;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_contract_audit_tenant ON public.contract_audit_trail;
CREATE TRIGGER trg_contract_audit_tenant BEFORE INSERT OR UPDATE OF contract_id, tenant_id
ON public.contract_audit_trail FOR EACH ROW EXECUTE FUNCTION public.enforce_contract_audit_tenant();

DROP POLICY IF EXISTS "Admins can view all audit trails" ON public.contract_audit_trail;
DROP POLICY IF EXISTS "Users can view audit trail for their contracts" ON public.contract_audit_trail;
DROP POLICY IF EXISTS contract_audit_tenant_access ON public.contract_audit_trail;
CREATE POLICY contract_audit_tenant_access ON public.contract_audit_trail
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tenant_users membership
          WHERE membership.tenant_id = contract_audit_trail.tenant_id
            AND membership.user_id = auth.uid())
);

COMMIT;
