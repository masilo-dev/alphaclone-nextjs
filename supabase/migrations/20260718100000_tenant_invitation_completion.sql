-- Complete workspace invitations with retry-safe creation and atomic acceptance.

ALTER TABLE public.tenant_invitations
    ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

DELETE FROM public.tenant_invitations older
USING public.tenant_invitations newer
WHERE older.tenant_id = newer.tenant_id
  AND lower(trim(older.email)) = lower(trim(newer.email))
  AND (older.created_at, older.id) < (newer.created_at, newer.id);
UPDATE public.tenant_invitations SET email = lower(trim(email));
CREATE UNIQUE INDEX IF NOT EXISTS tenant_invitations_tenant_id_email_key
    ON public.tenant_invitations (tenant_id, email);

CREATE OR REPLACE FUNCTION public.accept_tenant_invitation(
    p_token UUID,
    p_user_id UUID,
    p_user_email TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_invitation public.tenant_invitations%ROWTYPE;
BEGIN
    SELECT * INTO v_invitation
      FROM public.tenant_invitations
     WHERE token = p_token
     FOR UPDATE;

    IF v_invitation.id IS NULL OR v_invitation.revoked_at IS NOT NULL THEN
        RAISE EXCEPTION 'Invalid invitation';
    END IF;
    IF v_invitation.accepted_at IS NOT NULL OR v_invitation.status = 'accepted' THEN
        IF EXISTS (
            SELECT 1 FROM public.tenant_users
             WHERE tenant_id = v_invitation.tenant_id AND user_id = p_user_id
        ) THEN
            RETURN v_invitation.tenant_id;
        END IF;
        RAISE EXCEPTION 'Invitation already accepted';
    END IF;
    IF v_invitation.expires_at < now() THEN
        UPDATE public.tenant_invitations SET status = 'expired' WHERE id = v_invitation.id;
        RAISE EXCEPTION 'Invitation expired';
    END IF;
    IF lower(trim(v_invitation.email)) <> lower(trim(p_user_email)) THEN
        RAISE EXCEPTION 'Invitation belongs to a different email address';
    END IF;

    INSERT INTO public.tenant_users (tenant_id, user_id, role)
    VALUES (v_invitation.tenant_id, p_user_id, v_invitation.role)
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role;

    UPDATE public.tenant_invitations
       SET status = 'accepted', accepted_at = now()
     WHERE id = v_invitation.id;

    RETURN v_invitation.tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_tenant_invitation(UUID, UUID, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_tenant_invitation(UUID, UUID, TEXT)
    TO service_role;
