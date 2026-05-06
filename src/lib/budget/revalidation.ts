import { revalidatePath } from "next/cache";

const defaultFinancialPaths = [
  "/dashboard",
  "/planning",
  "/bills",
  "/income",
  "/expenses",
  "/settings"
];

export const financialPathGroups = {
  bills: ["/bills", "/dashboard", "/planning", "/settings"],
  expenses: ["/expenses", "/dashboard", "/planning", "/settings"],
  income: ["/income", "/dashboard", "/planning", "/settings"],
  settings: ["/settings", "/dashboard", "/planning"],
  planning: ["/planning", "/dashboard"]
} satisfies Record<string, string[]>;

export function revalidateFinancialPaths(paths: string[] = defaultFinancialPaths) {
  for (const path of new Set(paths)) {
    revalidatePath(path);
  }
}
