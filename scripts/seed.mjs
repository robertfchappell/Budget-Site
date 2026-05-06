import process from "node:process";
import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const pool = new Pool({ connectionString: databaseUrl });

const money = (value) => Number(value.toFixed(2));
const isoDate = (date) => date.toISOString().slice(0, 10);

function dateInCurrentMonth(day) {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day));
  return isoDate(date);
}

async function findOrCreateHousehold(client) {
  const name = process.env.SEED_HOUSEHOLD_NAME || "Home";
  const existing = await client.query("SELECT id FROM households WHERE name = $1", [name]);

  if (existing.rowCount) {
    return existing.rows[0].id;
  }

  const created = await client.query("INSERT INTO households (name) VALUES ($1) RETURNING id", [name]);
  return created.rows[0].id;
}

async function findOrCreateUser(client, householdId, user) {
  const existing = await client.query("SELECT id FROM users WHERE email = $1", [user.email]);

  if (existing.rowCount) {
    return existing.rows[0].id;
  }

  const passwordHash = await bcrypt.hash(user.password, 12);
  const created = await client.query(
    `
      INSERT INTO users (household_id, name, email, password_hash, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [householdId, user.name, user.email, passwordHash, user.role]
  );

  return created.rows[0].id;
}

async function findOrCreateCategory(client, householdId, category) {
  const existing = await client.query(
    "SELECT id FROM categories WHERE household_id = $1 AND name = $2 AND kind = $3",
    [householdId, category.name, category.kind]
  );

  if (existing.rowCount) {
    return existing.rows[0].id;
  }

  const created = await client.query(
    `
      INSERT INTO categories (household_id, name, kind, color, icon, is_system)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING id
    `,
    [householdId, category.name, category.kind, category.color, category.icon]
  );

  return created.rows[0].id;
}

async function findOrCreateAccount(client, householdId, account) {
  const existing = await client.query(
    "SELECT id FROM accounts WHERE household_id = $1 AND name = $2",
    [householdId, account.name]
  );

  if (existing.rowCount) {
    return existing.rows[0].id;
  }

  const created = await client.query(
    `
      INSERT INTO accounts (household_id, name, type, current_balance, institution)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [householdId, account.name, account.type, account.currentBalance, account.institution]
  );

  return created.rows[0].id;
}

async function seedRecurringBill(client, householdId, bill) {
  const existing = await client.query(
    "SELECT id FROM recurring_bills WHERE household_id = $1 AND name = $2",
    [householdId, bill.name]
  );

  if (existing.rowCount) {
    return existing.rows[0].id;
  }

  const created = await client.query(
    `
      INSERT INTO recurring_bills (
        household_id, category_id, account_id, name, amount, frequency, start_date,
        due_day, next_due_date, autopay, is_subscription, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $7, $9, $10, $11)
      RETURNING id
    `,
    [
      householdId,
      bill.categoryId,
      bill.accountId,
      bill.name,
      bill.amount,
      bill.frequency,
      bill.startDate,
      bill.dueDay,
      bill.autopay,
      bill.isSubscription,
      bill.notes
    ]
  );

  return created.rows[0].id;
}

async function seedBillInstance(client, householdId, bill) {
  await client.query(
    `
      INSERT INTO bill_instances (
        recurring_bill_id, household_id, category_id, account_id, bill_name,
        amount, due_date, status, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'unpaid', $8)
      ON CONFLICT (recurring_bill_id, due_date) DO NOTHING
    `,
    [
      bill.recurringBillId,
      householdId,
      bill.categoryId,
      bill.accountId,
      bill.name,
      bill.amount,
      bill.dueDate,
      bill.notes
    ]
  );
}

async function run() {
  if (process.env.SEED_DEMO_DATA !== "true") {
    console.log("Demo seed is disabled.");
    await pool.end();
    return;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const householdId = await findOrCreateHousehold(client);
    const husbandId = await findOrCreateUser(client, householdId, {
      name: process.env.SEED_HUSBAND_NAME || "Husband",
      email: process.env.SEED_HUSBAND_EMAIL || "husband@example.com",
      password: process.env.SEED_HUSBAND_PASSWORD || "ChangeMe123!",
      role: "husband"
    });

    const wifeId = await findOrCreateUser(client, householdId, {
      name: process.env.SEED_WIFE_NAME || "Wife",
      email: process.env.SEED_WIFE_EMAIL || "wife@example.com",
      password: process.env.SEED_WIFE_PASSWORD || "ChangeMe123!",
      role: "wife"
    });

    const categories = {};
    for (const category of [
      { name: "Housing", kind: "bill", color: "#38bdf8", icon: "home" },
      { name: "Utilities", kind: "bill", color: "#f59e0b", icon: "zap" },
      { name: "Insurance", kind: "bill", color: "#a78bfa", icon: "shield" },
      { name: "Subscriptions", kind: "bill", color: "#f472b6", icon: "repeat" },
      { name: "Groceries", kind: "expense", color: "#34d399", icon: "shopping-cart" },
      { name: "Fuel", kind: "expense", color: "#fb7185", icon: "fuel" },
      { name: "Dining", kind: "expense", color: "#f97316", icon: "utensils" },
      { name: "Household", kind: "expense", color: "#60a5fa", icon: "package" },
      { name: "Paycheck", kind: "income", color: "#22c55e", icon: "briefcase" },
      { name: "Regular Paycheck", kind: "income", color: "#22c55e", icon: "briefcase" },
      { name: "Overtime", kind: "income", color: "#38bdf8", icon: "clock" },
      { name: "VA Disability", kind: "income", color: "#2dd4bf", icon: "shield" },
      { name: "Pell Grants", kind: "income", color: "#a78bfa", icon: "graduation-cap" },
      { name: "Student Loans", kind: "income", color: "#f97316", icon: "landmark" },
      { name: "VA Education Stipend", kind: "income", color: "#14b8a6", icon: "book-open" },
      { name: "Bonuses", kind: "income", color: "#fbbf24", icon: "sparkles" },
      { name: "Miscellaneous Income", kind: "income", color: "#94a3b8", icon: "circle-dollar-sign" },
      { name: "Emergency Fund", kind: "savings", color: "#2dd4bf", icon: "vault" }
    ]) {
      categories[`${category.kind}:${category.name}`] = await findOrCreateCategory(client, householdId, category);
    }

    const checkingId = await findOrCreateAccount(client, householdId, {
      name: "Primary Checking",
      type: "checking",
      currentBalance: 4850.0,
      institution: "Manual"
    });

    await findOrCreateAccount(client, householdId, {
      name: "Emergency Savings",
      type: "savings",
      currentBalance: 2500.0,
      institution: "Manual"
    });

    const seededBills = [
      {
        name: "Mortgage",
        amount: 1850.0,
        categoryId: categories["bill:Housing"],
        accountId: checkingId,
        frequency: "monthly",
        startDate: dateInCurrentMonth(1),
        dueDay: 1,
        autopay: true,
        isSubscription: false,
        notes: "Primary housing payment"
      },
      {
        name: "Electric",
        amount: 165.0,
        categoryId: categories["bill:Utilities"],
        accountId: checkingId,
        frequency: "monthly",
        startDate: dateInCurrentMonth(12),
        dueDay: 12,
        autopay: false,
        isSubscription: false,
        notes: "Average billing plan"
      },
      {
        name: "Car Insurance",
        amount: 220.0,
        categoryId: categories["bill:Insurance"],
        accountId: checkingId,
        frequency: "monthly",
        startDate: dateInCurrentMonth(20),
        dueDay: 20,
        autopay: true,
        isSubscription: false,
        notes: ""
      },
      {
        name: "Streaming Bundle",
        amount: 24.99,
        categoryId: categories["bill:Subscriptions"],
        accountId: checkingId,
        frequency: "monthly",
        startDate: dateInCurrentMonth(18),
        dueDay: 18,
        autopay: true,
        isSubscription: true,
        notes: "Recurring entertainment subscription"
      }
    ];

    for (const bill of seededBills) {
      const recurringBillId = await seedRecurringBill(client, householdId, bill);
      await seedBillInstance(client, householdId, {
        ...bill,
        recurringBillId,
        dueDate: dateInCurrentMonth(bill.dueDay)
      });
    }

    const existingIncome = await client.query("SELECT id FROM income_entries WHERE household_id = $1 LIMIT 1", [householdId]);
    if (!existingIncome.rowCount) {
      await client.query(
        `
          INSERT INTO income_entries (
            household_id, user_id, account_id, category_id, employer, income_type, recurrence, income_frequency, guaranteed, paycheck_date, base_pay,
            overtime_pay, bonus_pay, va_income, taxes_withheld, deposit_amount, notes
          )
          VALUES
            ($1, $2, $4, $8, 'Acme Logistics', 'regular_paycheck', 'recurring', 'biweekly', true, $5, 2850, 175, 0, 0, 610, 2415, ''),
            ($1, $3, $4, $8, 'Northside Clinic', 'regular_paycheck', 'recurring', 'biweekly', true, $6, 2300, 0, 200, 0, 510, 1990, ''),
            ($1, $2, $4, $9, 'VA Benefits', 'va_disability', 'recurring', 'monthly', true, $7, 0, 0, 0, 675, 0, 675, 'VA disability income')
        `,
        [
          householdId,
          husbandId,
          wifeId,
          checkingId,
          dateInCurrentMonth(5),
          dateInCurrentMonth(9),
          dateInCurrentMonth(1),
          categories["income:Regular Paycheck"],
          categories["income:VA Disability"]
        ]
      );
    }

    const existingExpenses = await client.query("SELECT id FROM expenses WHERE household_id = $1 LIMIT 1", [householdId]);
    if (!existingExpenses.rowCount) {
      await client.query(
        `
          INSERT INTO expenses (
            household_id, user_id, account_id, category_id, amount, category_snapshot,
            merchant, notes, expense_date, payment_method
          )
          VALUES
            ($1, $2, $4, $5, 142.62, 'Groceries', 'Market Basket', '', $8, 'debit'),
            ($1, $3, $4, $6, 58.30, 'Fuel', 'Shell', '', $9, 'debit'),
            ($1, $2, $4, $7, 37.44, 'Dining', 'Pizza Night', '', $10, 'credit')
        `,
        [
          householdId,
          husbandId,
          wifeId,
          checkingId,
          categories["expense:Groceries"],
          categories["expense:Fuel"],
          categories["expense:Dining"],
          dateInCurrentMonth(7),
          dateInCurrentMonth(10),
          dateInCurrentMonth(11)
        ]
      );
    }

    await client.query(
      `
        INSERT INTO savings_goals (household_id, name, target_amount, current_amount, monthly_target, target_date)
        VALUES ($1, 'Emergency Fund', 10000, 2500, 500, NULL)
        ON CONFLICT (household_id, name) DO NOTHING
      `,
      [householdId]
    );

    await client.query("COMMIT");
    console.log("Seed data is ready.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
