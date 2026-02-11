CREATE OR REPLACE FUNCTION post_journal_entry(p_entry_id uuid, p_posted_by uuid)
RETURNS boolean AS $$
DECLARE
    v_total_debits DECIMAL(15,2);
    v_total_credits DECIMAL(15,2);
BEGIN
    SELECT total_debits, total_credits
    INTO v_total_debits, v_total_credits
    FROM journal_entries
    WHERE id = p_entry_id;

    IF v_total_debits != v_total_credits THEN
        RAISE EXCEPTION 'Entry not balanced: debits=%, credits=%', v_total_debits, v_total_credits;
    END IF;

    UPDATE journal_entries
    SET
        status = 'posted',
        posted_at = NOW(),
        posted_by = p_posted_by
    WHERE id = p_entry_id;

    -- Removed refresh as we now query base tables directly
    -- REFRESH MATERIALIZED VIEW CONCURRENTLY general_ledger;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
