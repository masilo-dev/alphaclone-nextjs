CREATE OR REPLACE FUNCTION create_default_chart_of_accounts(p_tenant_id uuid)
RETURNS void AS $$
DECLARE
    v_user_id uuid;
BEGIN
    SELECT id INTO v_user_id FROM auth.users LIMIT 1; -- Just for created_by

    -- Assets
    INSERT INTO chart_of_accounts (tenant_id, account_code, account_name, account_type, account_subtype, normal_balance, is_system_account, created_by)
    VALUES
    (p_tenant_id, '1000', 'Cash on Hand', 'asset', 'current_asset', 'debit', true, v_user_id),
    (p_tenant_id, '1100', 'Accounts Receivable', 'asset', 'current_asset', 'debit', true, v_user_id),
    (p_tenant_id, '1200', 'Inventory', 'asset', 'current_asset', 'debit', false, v_user_id),
    (p_tenant_id, '1500', 'Office Equipment', 'asset', 'fixed_asset', 'debit', false, v_user_id)
    ON CONFLICT (tenant_id, account_code) DO NOTHING;

    -- Liabilities
    INSERT INTO chart_of_accounts (tenant_id, account_code, account_name, account_type, account_subtype, normal_balance, is_system_account, created_by)
    VALUES
    (p_tenant_id, '2000', 'Accounts Payable', 'liability', 'current_liability', 'credit', true, v_user_id),
    (p_tenant_id, '2100', 'Sales Tax Payable', 'liability', 'current_liability', 'credit', true, v_user_id),
    (p_tenant_id, '2500', 'Long Term Debt', 'liability', 'long_term_liability', 'credit', false, v_user_id)
    ON CONFLICT (tenant_id, account_code) DO NOTHING;

    -- Equity
    INSERT INTO chart_of_accounts (tenant_id, account_code, account_name, account_type, account_subtype, normal_balance, is_system_account, created_by)
    VALUES
    (p_tenant_id, '3000', 'Owner''s Equity', 'equity', 'equity', 'credit', true, v_user_id),
    (p_tenant_id, '3900', 'Retained Earnings', 'equity', 'retained_earnings', 'credit', true, v_user_id)
    ON CONFLICT (tenant_id, account_code) DO NOTHING;

    -- Revenue
    INSERT INTO chart_of_accounts (tenant_id, account_code, account_name, account_type, account_subtype, normal_balance, is_system_account, created_by)
    VALUES
    (p_tenant_id, '4000', 'Sales Income', 'revenue', 'operating_revenue', 'credit', false, v_user_id),
    (p_tenant_id, '4100', 'Service Revenue', 'revenue', 'operating_revenue', 'credit', true, v_user_id)
    ON CONFLICT (tenant_id, account_code) DO NOTHING;

    -- Expenses
    INSERT INTO chart_of_accounts (tenant_id, account_code, account_name, account_type, account_subtype, normal_balance, is_system_account, created_by)
    VALUES
    (p_tenant_id, '5000', 'Cost of Goods Sold', 'expense', 'cost_of_goods_sold', 'debit', true, v_user_id),
    (p_tenant_id, '6000', 'Advertising Expense', 'expense', 'operating_expense', 'debit', false, v_user_id),
    (p_tenant_id, '6100', 'Rent Expense', 'expense', 'operating_expense', 'debit', false, v_user_id),
    (p_tenant_id, '6200', 'Utilities Expense', 'expense', 'operating_expense', 'debit', false, v_user_id),
    (p_tenant_id, '6300', 'Payroll Expense', 'expense', 'operating_expense', 'debit', false, v_user_id)
    ON CONFLICT (tenant_id, account_code) DO NOTHING;

END;
$$ LANGUAGE plpgsql;
