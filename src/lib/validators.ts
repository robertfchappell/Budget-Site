import { z } from "zod";

const money = z.coerce.number().finite().min(0).default(0);
const password = z.string().min(8, "Password must be at least 8 characters.");
const role = z.enum(["husband", "wife"]);

export const recurringBillSchema = z.object({
  name: z.string().trim().min(1),
  amount: money,
  frequency: z.enum(["monthly", "weekly", "yearly"]),
  startDate: z.string().min(1),
  dueDay: z.coerce.number().int().min(1).max(31).optional(),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  accountId: z.string().uuid().optional().or(z.literal("")),
  autopay: z.coerce.boolean().default(false),
  isSubscription: z.coerce.boolean().default(false),
  notes: z.string().trim().optional()
});

export const incomeSchema = z.object({
  employer: z.string().trim().min(1),
  incomeType: z.enum([
    "regular_paycheck",
    "overtime",
    "va_disability",
    "pell_grant",
    "student_loan",
    "va_education_stipend",
    "bonus",
    "misc"
  ]),
  recurrence: z.enum(["recurring", "one_time"]).default("one_time"),
  guaranteed: z.coerce.boolean().default(false),
  paycheckDate: z.string().min(1),
  basePay: money,
  overtimePay: money,
  bonusPay: money,
  vaIncome: money,
  taxesWithheld: money,
  depositAmount: money,
  accountId: z.string().uuid().optional().or(z.literal("")),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().trim().optional()
});

export const expenseSchema = z.object({
  amount: money,
  categoryId: z.string().uuid().optional().or(z.literal("")),
  merchant: z.string().trim().min(1),
  notes: z.string().trim().optional(),
  expenseDate: z.string().min(1),
  paymentMethod: z.enum(["cash", "debit", "credit", "ach", "check", "other"]),
  accountId: z.string().uuid().optional().or(z.literal(""))
});

export const savingsGoalSchema = z.object({
  name: z.string().trim().min(1),
  targetAmount: money,
  currentAmount: money,
  monthlyTarget: money,
  targetDate: z.string().optional().or(z.literal("")),
  accountId: z.string().uuid().optional().or(z.literal(""))
});

export const accountBalanceSchema = z.object({
  accountId: z.string().uuid(),
  currentBalance: z.coerce.number().finite()
});

export const transferSchema = z.object({
  fromAccountId: z.string().uuid(),
  toAccountId: z.string().uuid(),
  amount: z.coerce.number().finite().positive(),
  transferDate: z.string().min(1),
  notes: z.string().trim().optional()
});

export const billInstanceSchema = z.object({
  billName: z.string().trim().min(1),
  amount: money,
  dueDate: z.string().min(1),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  accountId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().trim().optional()
});

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().email("Enter a valid email address.").transform((value) => value.toLowerCase()),
  password,
  confirmPassword: z.string(),
  householdName: z.string().trim().optional().or(z.literal("")),
  role,
  inviteToken: z.string().trim().optional().or(z.literal(""))
}).refine((values) => values.password === values.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"]
});

export const inviteSchema = z.object({
  invitedEmail: z.string().trim().email("Enter a valid email address.").transform((value) => value.toLowerCase()),
  invitedRole: role,
  expiresInDays: z.coerce.number().int().min(1).max(30).default(7)
});

export const revokeInviteSchema = z.object({
  inviteId: z.string().uuid()
});
