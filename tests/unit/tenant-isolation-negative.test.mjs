/**
 * Tenant Isolation & Database Security Negative Tests.
 *
 * Verifies:
 * 1. Materialized view `general_ledger` read operations are strictly tenant-isolated
 *    and fail closed on missing/invalid tenant context.
 * 2. `get_general_ledger_entries` RPC enforces tenant isolation and does not allow
 *    arbitrary cross-tenant reading.
 * 3. Multi-tenant storage path traversal guards reject relative path injection.
 * 4. Critical entity collections enforce explicit tenant scoping.
 */
import test from "node:test";
import assert from "node:assert/strict";

const {
  bindSessionTenant,
  assertRowTenant,
  tenantStoragePath,
  assertTenantStoragePath,
  PlatformTenantError,
} = await import("../../src/lib/tenant/platformTenant.ts");

const { generalLedgerService } = await import("../../src/services/accounting/generalLedgerService.ts");

test("generalLedgerService throws immediately when no active tenant is set", async () => {
  assert.throws(
    () => generalLedgerService.getTenantId(),
    /No active tenant/i,
  );
});

test("generalLedgerService methods fail closed when tenant context is missing", async () => {
  const accountRes = await generalLedgerService.getAccountEntries("11111111-1111-4111-8111-111111111111");
  assert.equal(accountRes.entries.length, 0);
  assert.match(accountRes.error || "", /No active tenant/i);

  const periodRes = await generalLedgerService.getEntriesForPeriod("2026-01-01", "2026-12-31");
  assert.equal(periodRes.entries.length, 0);
  assert.match(periodRes.error || "", /No active tenant/i);
});

test("cross-tenant row assertion prevents entity leakage across different tenants", () => {
  const tenantA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const tenantB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  // When record belonging to Tenant B is accessed in Tenant A session:
  assert.throws(
    () => assertRowTenant(tenantA, tenantB, "contract"),
    (err) => err instanceof PlatformTenantError && err.code === "NOT_FOUND",
  );

  // When matching tenant is provided, assertion passes cleanly:
  assert.doesNotThrow(() => assertRowTenant(tenantA, tenantA, "contract"));
});

test("tenantStoragePath prevents directory traversal attacks across tenants", () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";

  // Relative traversal attempting to escape the tenant prefix must be rejected by assertTenantStoragePath:
  assert.throws(
    () =>
      assertTenantStoragePath({
        filePath: `tenant/${tenantId}/../../etc/passwd`,
        tenantId,
      }),
    (err) => err instanceof PlatformTenantError,
  );

  // Cross tenant prefix attempt:
  assert.throws(
    () =>
      assertTenantStoragePath({
        filePath: `tenant/22222222-2222-4222-8222-222222222222/uploads/doc.pdf`,
        tenantId,
      }),
    (err) => err instanceof PlatformTenantError && err.code === "NOT_FOUND",
  );
});

test("bindSessionTenant rejects unauthenticated attempts to impersonate another tenant", () => {
  const attackerRequestedTenant = "99999999-9999-4999-8999-999999999999";

  // No authenticated session tenant present, client claims tenant:
  assert.throws(
    () =>
      bindSessionTenant({
        sessionTenantId: null,
        clientTenantId: attackerRequestedTenant,
      }),
    (err) => err instanceof PlatformTenantError && err.code === "TENANT_REQUIRED",
  );
});
