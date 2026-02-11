CREATE OR REPLACE FUNCTION get_account_balances(
    p_tenant_id uuid,
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL
)
RETURNS TABLE (
    account_id uuid,
    account_code text,
    account_name text,
    account_type text,
    normal_balance text,
    debit_total numeric,
    credit_total numeric,
    balance numeric
) AS $$
BEGIN
    RETURN QUERY
    WITH account_totals AS (
        SELECT
            jel.account_id,
            SUM(jel.debit_amount) as total_debits,
            SUM(jel.credit_amount) as total_credits
        FROM journal_entries je
        JOIN journal_entry_lines jel ON je.id = jel.entry_id
        WHERE je.tenant_id = p_tenant_id
          AND je.status = 'posted'
          AND je.voided_at IS NULL
          AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
          AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
        GROUP BY jel.account_id
    )
    SELECT
        coa.id as account_id,
        coa.account_code,
        coa.account_name,
        coa.account_type::text,
        coa.normal_balance,
        COALESCE(at.total_debits, 0) as debit_total,
        COALESCE(at.total_credits, 0) as credit_total,
        CASE
            WHEN coa.normal_balance = 'debit' THEN COALESCE(at.total_debits, 0) - COALESCE(at.total_credits, 0)
            ELSE COALESCE(at.total_credits, 0) - COALESCE(at.total_debits, 0)
        END as balance
    FROM chart_of_accounts coa
    LEFT JOIN account_totals at ON coa.id = at.account_id
    WHERE coa.tenant_id = p_tenant_id
      AND coa.is_active = true
      AND coa.deleted_at IS NULL
    ORDER BY coa.account_code;
END;
$$ LANGUAGE plpgsql;
