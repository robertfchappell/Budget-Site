export type ProjectionInput = {
  checkingBalance: number;
  savingsBalance: number;
  netCash: number;
  monthlyIncome: number;
  postedMonthlyIncome: number;
  pendingIncome: number;
  guaranteedIncome: number;
  variableIncome: number;
  oneTimeIncome: number;
  monthlyBills: number;
  monthlyExpenses: number;
  unpaidBillsRemaining: number;
  scheduledExpensesRemaining?: number;
  monthlySavingsTarget: number;
};

export type ProjectionResult = {
  projectedEndOfMonthBalance: number;
  remainingSafeToSpend: number;
  totalCommittedBills: number;
  projectedSavings: number;
  projectedSavingsBalance: number;
  projectedNetCash: number;
  monthlyRollover: number;
  postedMonthlyIncome: number;
  scheduledMonthlyIncome: number;
  pendingIncome: number;
  scheduledExpensesRemaining: number;
  guaranteedIncome: number;
  variableIncome: number;
  oneTimeIncome: number;
};

export function calculateProjection(input: ProjectionInput): ProjectionResult {
  const checkingBalance = safeNumber(input.checkingBalance);
  const savingsBalance = safeNumber(input.savingsBalance);
  const netCash = safeNumber(input.netCash);
  const scheduledMonthlyIncome = safeNumber(input.monthlyIncome);
  const postedMonthlyIncome = safeNumber(input.postedMonthlyIncome);
  const pendingIncome = safeNumber(input.pendingIncome);
  const guaranteedIncome = safeNumber(input.guaranteedIncome);
  const variableIncome = safeNumber(input.variableIncome);
  const oneTimeIncome = safeNumber(input.oneTimeIncome);
  const monthlyBills = safeNumber(input.monthlyBills);
  const monthlyExpenses = safeNumber(input.monthlyExpenses);
  const unpaidBillsRemaining = safeNumber(input.unpaidBillsRemaining);
  const scheduledExpensesRemaining = safeNumber(input.scheduledExpensesRemaining);
  const monthlySavingsTarget = safeNumber(input.monthlySavingsTarget);

  const projectedEndOfMonthBalance =
    checkingBalance + pendingIncome - unpaidBillsRemaining - scheduledExpensesRemaining;

  const projectedSavings = Math.max(
    0,
    Math.min(monthlySavingsTarget, projectedEndOfMonthBalance)
  );

  const remainingSafeToSpend = Math.max(
    0,
    projectedEndOfMonthBalance
  );

  const reliableIncome = guaranteedIncome;

  // Trajectory = where checking will be at end of month.
  // Uses only remaining (pending/unpaid) amounts so paid bills and received
  // income that are already in the account balance are not double-counted.
  const monthlyRollover = projectedEndOfMonthBalance;

  return {
    projectedEndOfMonthBalance,
    remainingSafeToSpend,
    totalCommittedBills: unpaidBillsRemaining,
    projectedSavings,
    projectedSavingsBalance: savingsBalance + projectedSavings,
    projectedNetCash: netCash + pendingIncome - unpaidBillsRemaining - scheduledExpensesRemaining,
    monthlyRollover,
    postedMonthlyIncome,
    scheduledMonthlyIncome,
    pendingIncome,
    scheduledExpensesRemaining,
    guaranteedIncome: reliableIncome,
    variableIncome,
    oneTimeIncome
  };
}

function safeNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}
