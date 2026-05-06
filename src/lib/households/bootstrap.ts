import type { PoolClient } from "pg";

const defaultCategories = [
  { name: "Housing", kind: "bill", color: "#38bdf8", icon: "home" },
  { name: "Utilities", kind: "bill", color: "#f59e0b", icon: "zap" },
  { name: "Insurance", kind: "bill", color: "#a78bfa", icon: "shield" },
  { name: "Subscriptions", kind: "bill", color: "#f472b6", icon: "repeat" },
  { name: "Groceries", kind: "expense", color: "#34d399", icon: "shopping-cart" },
  { name: "Fuel", kind: "expense", color: "#fb7185", icon: "fuel" },
  { name: "Dining", kind: "expense", color: "#f97316", icon: "utensils" },
  { name: "Household", kind: "expense", color: "#60a5fa", icon: "package" },
  { name: "Regular Paycheck", kind: "income", color: "#22c55e", icon: "briefcase" },
  { name: "Overtime", kind: "income", color: "#38bdf8", icon: "clock" },
  { name: "VA Disability", kind: "income", color: "#2dd4bf", icon: "shield" },
  { name: "Pell Grants", kind: "income", color: "#a78bfa", icon: "graduation-cap" },
  { name: "Student Loans", kind: "income", color: "#f97316", icon: "landmark" },
  { name: "VA Education Stipend", kind: "income", color: "#14b8a6", icon: "book-open" },
  { name: "Bonuses", kind: "income", color: "#fbbf24", icon: "sparkles" },
  { name: "Miscellaneous Income", kind: "income", color: "#94a3b8", icon: "circle-dollar-sign" },
  { name: "Emergency Fund", kind: "savings", color: "#2dd4bf", icon: "vault" }
] as const;

export async function bootstrapHousehold(client: PoolClient, householdId: string) {
  for (const category of defaultCategories) {
    await client.query(
      `
        INSERT INTO categories (household_id, name, kind, color, icon, is_system)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (household_id, name, kind) DO NOTHING
      `,
      [householdId, category.name, category.kind, category.color, category.icon]
    );
  }

  const checking = await client.query<{ id: string }>(
    `
      INSERT INTO accounts (household_id, name, type, current_balance, institution)
      VALUES ($1, 'Primary Checking', 'checking', 0, 'Manual')
      ON CONFLICT (household_id, name)
      DO UPDATE SET institution = COALESCE(accounts.institution, EXCLUDED.institution)
      RETURNING id
    `,
    [householdId]
  );

  const savings = await client.query<{ id: string }>(
    `
      INSERT INTO accounts (household_id, name, type, current_balance, institution)
      VALUES ($1, 'Emergency Savings', 'savings', 0, 'Manual')
      ON CONFLICT (household_id, name)
      DO UPDATE SET institution = COALESCE(accounts.institution, EXCLUDED.institution)
      RETURNING id
    `,
    [householdId]
  );

  await client.query(
    `
      INSERT INTO savings_goals (
        household_id, account_id, name, target_amount, current_amount, monthly_target, target_date
      )
      VALUES ($1, $2, 'Emergency Fund', 10000, 0, 500, NULL)
      ON CONFLICT (household_id, name)
      DO UPDATE SET account_id = COALESCE(savings_goals.account_id, EXCLUDED.account_id)
    `,
    [householdId, savings.rows[0]?.id ?? null]
  );

  return {
    checkingAccountId: checking.rows[0]?.id ?? null,
    savingsAccountId: savings.rows[0]?.id ?? null
  };
}
