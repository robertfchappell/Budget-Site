import { revalidatePath } from "next/cache";

export function revalidateFinancialPaths(extraPaths: string[] = []) {
  for (const path of new Set([
    "/dashboard",
    "/planning",
    "/bills",
    "/income",
    "/expenses",
    "/settings",
    ...extraPaths
  ])) {
    revalidatePath(path);
  }
}
