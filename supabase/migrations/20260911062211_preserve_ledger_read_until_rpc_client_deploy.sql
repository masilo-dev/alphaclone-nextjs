-- Deployment-order compatibility: the current production frontend still reads
-- general_ledger directly. Keep anonymous access revoked, but restore signed-in
-- SELECT until the RPC-based client is deployed. A follow-up migration must
-- revoke this grant after deployment.
GRANT SELECT ON TABLE public.general_ledger TO authenticated;
