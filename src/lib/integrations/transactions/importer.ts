export type ImportedTransaction = {
  source: "csv" | "plaid";
  externalId?: string;
  amount: number;
  merchant: string;
  date: string;
  paymentMethod?: string;
  categoryName?: string;
  notes?: string;
};

export type TransactionImporter = {
  source: ImportedTransaction["source"];
  importTransactions(): Promise<ImportedTransaction[]>;
};
