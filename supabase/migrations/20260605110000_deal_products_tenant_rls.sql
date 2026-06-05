-- Allow tenant members (not just platform admins) to manage line items for
-- deals that belong to their tenant. Scoped through the deal -> tenant_users join
-- so it works regardless of whether deal_products.tenant_id is populated.
drop policy if exists "Tenant members manage deal products" on public.deal_products;
create policy "Tenant members manage deal products"
  on public.deal_products for all
  using (
    exists (
      select 1 from public.deals d
      join public.tenant_users tu on tu.tenant_id = d.tenant_id
      where d.id = deal_products.deal_id and tu.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.deals d
      join public.tenant_users tu on tu.tenant_id = d.tenant_id
      where d.id = deal_products.deal_id and tu.user_id = auth.uid()
    )
  );
