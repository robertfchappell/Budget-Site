Plaid is intentionally not connected in this version.

Reserved extension points:

- `accounts.plaid_account_id` for linked account mapping.
- `expenses.external_source` and `expenses.imported_transaction_id` for deduped imports.
- `TransactionImporter` in `src/lib/integrations/transactions/importer.ts` for future providers.
