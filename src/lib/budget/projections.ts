export type ProjectionInput = {
  checkingBalance: number;
  savingsBalance: number;
  netCash: number;
  monthlyIncome: number;
  guaranteedIncome: number;
  variableIncome: number;
  oneTimeIncome: number;
  monthlyBills: number;
  monthlyExpenses: number;
  unpaidBillsRemaining: number;
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
  guaranteedIncome: number;
  variableIncome: number;
  oneTimeIncome: number;
};

export function calculateProjection(input: ProjectionInput): ProjectionResult {
  const checkingBalance = safeNumber(input.checkingBalance);
  const savingsBalance = safeNumber(input.savingsBalance);
  const netCash = safeNumber(input.netCash);
  const guaranteedIncome = safeNumber(input.guaranteedIncome);
  const variableIncome = safeNumber(input.variableIncome);
  const oneTimeIncome = safeNumber(input.oneTimeIncome);
  const monthlyBills = safeNumber(input.monthlyBills);
  const monthlyExpenses = safeNumber(input.monthlyExpenses);
  const unpaidBillsRemaining = safeNumber(input.unpaidBillsRemaining);
  const monthlySavingsTarget = safeNumber(input.monthlySavingsTarget);

  const projectedEndOfMonthBalance =
    checkingBalance - unpaidBillsRemaining;

  const projectedSavings = Math.max(
    0,
    Math.min(monthlySavingsTarget, projectedEndOfMonthBalance)
  );

  const remainingSafeToSpend = Math.max(
    0,
    projectedEndOfMonthBalance - projectedSavings
  );

  const reliableIncome = guaranteedIncome;
  const supplementalIncome = variableIncome + oneTimeIncome;

  const monthlyRollover =
    reliableIncome +
    supplementalIncome -
    monthlyBills -
    monthlyExpenses -
    projectedSavings;

  return {
    projectedEndOfMonthBalance,
    remainingSafeToSpend,
    totalCommittedBills: monthlyBills,
    projectedSavings,
    projectedSavingsBalance: savingsBalance + projectedSavings,
    projectedNetCash: netCash - unpaidBillsRemaining,
    monthlyRollover,
    guaranteedIncome: reliableIncome,
    variableIncome,
    oneTimeIncome
  };
}

function safeNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}
