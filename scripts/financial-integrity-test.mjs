const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";

function decodeHtml(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function forms(html) {
  return [...html.matchAll(/<form[\s\S]*?<\/form>/g)].map((match) => match[0]);
}

function formDataFromHtml(formHtml) {
  const formData = new FormData();

  for (const match of formHtml.matchAll(/<input([^>]*)>/g)) {
    const attrs = match[1];
    const name = attrs.match(/name="([^"]+)"/)?.[1];

    if (!name) {
      continue;
    }

    const value = attrs.match(/value="([^"]*)"/)?.[1] ?? "";
    formData.set(decodeHtml(name), decodeHtml(value));
  }

  return formData;
}

function inputValue(formHtml, name) {
  const inputMatch = [...formHtml.matchAll(/<input([^>]*)>/g)]
    .map((match) => match[1])
    .find((attrs) => attrs.includes(`name="${name}"`));

  if (!inputMatch) {
    return "";
  }

  return decodeHtml(inputMatch.match(/value="([^"]*)"/)?.[1] ?? "");
}

function firstCookie(response) {
  const cookies = response.headers.getSetCookie?.() ?? [];
  return (cookies[0] || response.headers.get("set-cookie") || "").split(";")[0];
}

async function get(path, cookie) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: cookie ? { cookie } : undefined
  });
  const text = await response.text();
  return { response, text };
}

async function post(path, cookie, formHtml, fields = {}) {
  const formData = formDataFromHtml(formHtml);

  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }

  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    body: formData,
    redirect: "manual",
    headers: {
      cookie,
      origin: baseUrl,
      referer: `${baseUrl}${path}`
    }
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertMoney(actual, expected, label) {
  const roundedActual = Math.round(Number(actual) * 100);
  const roundedExpected = Math.round(Number(expected) * 100);
  assert(roundedActual === roundedExpected, `${label}: expected ${expected}, got ${actual}`);
}

function findForm(html, predicate, description) {
  const found = forms(html).find(predicate);
  assert(found, `Could not find form for ${description}`);
  return found;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function signupFreshHousehold() {
  const marker = Date.now();
  const signupPage = await get("/signup");
  const signupForm = findForm(signupPage.text, (form) => form.includes('name="householdName"'), "signup");
  const response = await post("/signup", "", signupForm, {
    name: "Integrity User",
    email: `integrity-${marker}@example.com`,
    householdName: `Integrity Household ${marker}`,
    role: "husband",
    password: "IntegrityPass123!",
    confirmPassword: "IntegrityPass123!",
    inviteToken: ""
  });
  const cookie = firstCookie(response);

  assert(response.status === 303, `Signup returned ${response.status}`);
  assert(cookie.startsWith("family_budget_session="), "Signup did not set a session cookie");
  return cookie;
}

async function accountForms(cookie) {
  const page = await get("/settings", cookie);
  assert(page.response.status === 200, `Settings returned ${page.response.status}`);
  const found = forms(page.text).filter((form) => form.includes('name="currentBalance"') && form.includes('name="accountId"'));
  const checking = found.find((form) => form.toLowerCase().includes("checking"));
  const savings = found.find((form) => form.toLowerCase().includes("savings"));

  assert(checking, "Checking account form was not found");
  assert(savings, "Savings account form was not found");

  return { checking, savings, page };
}

async function balances(cookie) {
  const { checking, savings } = await accountForms(cookie);
  return {
    checkingId: inputValue(checking, "accountId"),
    savingsId: inputValue(savings, "accountId"),
    checking: Number(inputValue(checking, "currentBalance")),
    savings: Number(inputValue(savings, "currentBalance"))
  };
}

async function setInitialBalances(cookie) {
  const { checking, savings } = await accountForms(cookie);

  await post("/settings", cookie, checking, {
    accountId: inputValue(checking, "accountId"),
    currentBalance: "1000.00"
  });
  await post("/settings", cookie, savings, {
    accountId: inputValue(savings, "accountId"),
    currentBalance: "200.00"
  });

  const current = await balances(cookie);
  assertMoney(current.checking, 1000, "Initial checking balance");
  assertMoney(current.savings, 200, "Initial savings balance");
  return current;
}

async function verifyAccountManagement(cookie) {
  const accountName = `Integrity Cash ${Date.now()}`;
  let page = await get("/settings", cookie);
  const createForm = findForm(page.text, (form) => form.includes('name="accountName"'), "account create");

  await post("/settings", cookie, createForm, {
    accountName,
    accountType: "cash",
    currentBalance: "42.00",
    institution: "Manual",
    includeInSafeToSpend: "true"
  });

  page = await get("/settings", cookie);
  assert(page.text.includes(accountName), "Created account should appear in settings");
  const accountForm = findForm(page.text, (form) => form.includes(accountName) && form.includes('name="accountId"'), "created account row");
  assertMoney(Number(inputValue(accountForm, "currentBalance")), 42, "Created account balance");
  const accountId = inputValue(accountForm, "accountId");

  const deleteForm = findForm(
    page.text,
    (form) => form.includes(`value="${accountId}"`) && form.includes("Delete"),
    "account delete"
  );
  await post("/settings", cookie, deleteForm);

  page = await get("/settings", cookie);
  assert(!page.text.includes(accountName), "Deleted account should disappear from settings");
}

async function verifyExpenseLifecycle(cookie, checkingId) {
  const merchant = `Integrity Expense ${Date.now()}`;
  let page = await get("/expenses", cookie);
  const createForm = findForm(page.text, (form) => form.includes('name="paymentMethod"'), "expense create");

  await post("/expenses", cookie, createForm, {
    amount: "50.00",
    merchant,
    categoryId: "",
    expenseDate: todayIso(),
    paymentMethod: "debit",
    accountId: checkingId,
    notes: "balance integrity"
  });
  assertMoney((await balances(cookie)).checking, 950, "Expense create should decrease checking");
  const dashboardAfterCreate = await get("/dashboard", cookie);
  assert(dashboardAfterCreate.text.includes(merchant), "Dashboard recent activity should include created expense");
  assert(dashboardAfterCreate.text.includes("Monthly Expenses"), "Dashboard should show monthly expense tracking");
  assert(dashboardAfterCreate.text.includes("$50"), "Dashboard should include created expense amount");

  page = await get("/expenses", cookie);
  const editForm = findForm(page.text, (form) => form.includes(merchant) && form.includes('name="expenseId"'), "expense edit");
  const expenseId = inputValue(editForm, "expenseId");

  await post("/expenses", cookie, editForm, {
    expenseId,
    amount: "70.00",
    merchant,
    categoryId: "",
    expenseDate: todayIso(),
    paymentMethod: "debit",
    accountId: checkingId,
    notes: "balance integrity edited"
  });
  assertMoney((await balances(cookie)).checking, 930, "Expense edit should reverse and reapply checking");
  const dashboardAfterEdit = await get("/dashboard", cookie);
  assert(dashboardAfterEdit.text.includes(merchant), "Dashboard recent activity should include edited expense");
  assert(dashboardAfterEdit.text.includes("$70"), "Dashboard should include edited expense amount");

  page = await get("/expenses", cookie);
  const deleteForm = findForm(page.text, (form) => form.includes(`value="${expenseId}"`) && form.includes("Delete"), "expense delete");
  await post("/expenses", cookie, deleteForm);
  assertMoney((await balances(cookie)).checking, 1000, "Expense delete should restore checking");
}

async function verifyIncomeLifecycle(cookie, checkingId) {
  const employer = `Integrity Income ${Date.now()}`;
  let page = await get("/income", cookie);
  const createForm = findForm(page.text, (form) => form.includes('name="incomeType"'), "income create");

  await post("/income", cookie, createForm, {
    employer,
    incomeType: "regular_paycheck",
    recurrence: "recurring",
    paycheckDate: todayIso(),
    basePay: "0",
    overtimePay: "0",
    bonusPay: "0",
    vaIncome: "0",
    taxesWithheld: "0",
    depositAmount: "300.00",
    accountId: checkingId,
    term: "",
    notes: ""
  });
  assertMoney((await balances(cookie)).checking, 1300, "Income create should increase checking");

  page = await get("/income", cookie);
  const editForm = findForm(page.text, (form) => form.includes(employer) && form.includes('name="incomeId"'), "income edit");
  const incomeId = inputValue(editForm, "incomeId");

  await post("/income", cookie, editForm, {
    incomeId,
    employer,
    incomeType: "regular_paycheck",
    recurrence: "recurring",
    paycheckDate: todayIso(),
    basePay: "0",
    overtimePay: "0",
    bonusPay: "0",
    vaIncome: "0",
    taxesWithheld: "0",
    depositAmount: "350.00",
    accountId: checkingId,
    term: "",
    notes: ""
  });
  assertMoney((await balances(cookie)).checking, 1350, "Income edit should reverse and reapply checking");
  const dashboardAfterEdit = await get("/dashboard", cookie);
  assert(dashboardAfterEdit.text.includes(employer), "Dashboard recent activity should include edited income");
  assert(dashboardAfterEdit.text.includes("$350"), "Dashboard monthly income should include edited deposit amount");

  page = await get("/income", cookie);
  const deleteForm = findForm(page.text, (form) => form.includes(`value="${incomeId}"`) && form.includes("Delete"), "income delete");
  await post("/income", cookie, deleteForm);
  assertMoney((await balances(cookie)).checking, 1000, "Income delete should restore checking");
}

async function verifyTransferLifecycle(cookie, checkingId, savingsId) {
  const page = await get("/settings", cookie);
  const transferForm = findForm(page.text, (form) => form.includes('name="fromAccountId"'), "transfer");

  await post("/settings", cookie, transferForm, {
    fromAccountId: checkingId,
    toAccountId: savingsId,
    amount: "125.00",
    transferDate: todayIso(),
    notes: "integrity transfer"
  });

  let current = await balances(cookie);
  assertMoney(current.checking, 875, "Transfer should decrease checking");
  assertMoney(current.savings, 325, "Transfer should increase savings");

  await post("/settings", cookie, transferForm, {
    fromAccountId: savingsId,
    toAccountId: checkingId,
    amount: "125.00",
    transferDate: todayIso(),
    notes: "integrity transfer return"
  });

  current = await balances(cookie);
  assertMoney(current.checking, 1000, "Reverse transfer should restore checking");
  assertMoney(current.savings, 200, "Reverse transfer should restore savings");
}

async function verifyBillPaymentLifecycle(cookie, checkingId) {
  const name = `Integrity Bill ${Date.now()}`;
  let page = await get("/bills", cookie);
  const createForm = findForm(page.text, (form) => form.includes('name="frequency"'), "bill create");

  await post("/bills", cookie, createForm, {
    name,
    amount: "80.00",
    frequency: "one_time",
    startDate: todayIso(),
    dueDate: todayIso(),
    categoryId: "",
    accountId: checkingId,
    notes: "balance integrity"
  });

  page = await get("/bills", cookie);
  const payForm = findForm(page.text, (form) => form.includes('name="billInstanceId"') && form.includes("Paid"), "bill payment");
  await post("/bills", cookie, payForm);
  assertMoney((await balances(cookie)).checking, 920, "Paid bill should decrease checking");

  page = await get("/bills", cookie);
  const unpaidForm = findForm(page.text, (form) => form.includes('name="billInstanceId"') && form.includes("Unpaid"), "bill unpaid");
  await post("/bills", cookie, unpaidForm);
  assertMoney((await balances(cookie)).checking, 1000, "Unpaid bill should restore checking");
}

async function verifyRoutes(cookie) {
  for (const path of ["/dashboard", "/planning", "/bills", "/income", "/expenses", "/settings"]) {
    const page = await get(path, cookie);
    assert(page.response.status === 200, `${path} returned ${page.response.status}`);
    assert(!page.text.includes("Application error"), `${path} rendered an application error`);
    assert(!page.text.includes("server error"), `${path} rendered a server error`);
  }
}

async function main() {
  const cookie = await signupFreshHousehold();
  const initial = await setInitialBalances(cookie);

  await verifyAccountManagement(cookie);
  await verifyExpenseLifecycle(cookie, initial.checkingId);
  await verifyIncomeLifecycle(cookie, initial.checkingId);
  await verifyTransferLifecycle(cookie, initial.checkingId, initial.savingsId);
  await verifyBillPaymentLifecycle(cookie, initial.checkingId);
  await verifyRoutes(cookie);

  const finalBalances = await balances(cookie);
  assertMoney(finalBalances.checking, 1000, "Final checking balance");
  assertMoney(finalBalances.savings, 200, "Final savings balance");

  console.log("Financial integrity test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
