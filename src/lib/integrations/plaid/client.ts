import type { TransactionImporter } from "@/lib/integrations/transactions/importer";

export function createPlaidImporter(): TransactionImporter {
  return {
    source: "plaid",
    async importTransactions() {
      throw new Error("Plaid integration is intentionally not implemented yet.");
    }
  };
}
