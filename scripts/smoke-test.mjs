const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
const email = process.env.SMOKE_EMAIL || "husband@example.com";
const password = process.env.SMOKE_PASSWORD || "ChangeMe123!";

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

  const value = inputMatch.match(new RegExp(`value="([^"]*)"`))?.[1] ?? "";
  return decodeHtml(value);
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

function assertHealthy(path, text, marker) {
  assert(text.includes(marker), `${path} did not include ${marker}`);
  assert(!text.includes("Application error"), `${path} rendered an application error`);
  assert(!text.includes("server error"), `${path} rendered a server error`);
  assert(!text.includes("too many clients"), `${path} exhausted PostgreSQL clients`);
  assert(!text.includes("split is not a function"), `${path} rendered the old split crash`);
}

function findForm(html, predicate, description) {
  const found = forms(html).find(predicate);
  assert(found, `Could not find form for ${description}`);
  return found;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function login() {
  const loginPage = await get("/login");
  const loginForm = findForm(loginPage.text, () => true, "login");
  const response = await post("/login", "", loginForm, { email, password });
  const cookie = firstCookie(response);

  if (response.status !== 303 || !cookie.startsWith("family_budget_session=")) {
    return signupNewHousehold();
  }

  return cookie;
}

async function signupNewHousehold() {
  const marker = Date.now();
  const signupPage = await get("/signup");
  const signupForm = findForm(signupPage.text, (form) => form.includes('name="householdName"'), "signup");
  const response = await post("/signup", "", signupForm, {
    name: "Smoke User",
    email: `smoke-${marker}@example.com`,
    householdName: `Smoke Household ${marker}`,
    role: "husband",
    password: "SmokePass123!",
    confirmPassword: "SmokePass123!",
    inviteToken: ""
  });
  const cookie = firstCookie(response);

  assert(response.status === 303, `Signup returned ${response.status}`);
  assert(cookie.startsWith("family_budget_session="), "Signup did not set a session cookie");
  return cookie;
}

async function createEditArchiveDeleteBill(cookie) {
  const name = `Smoke Bill ${Date.now()}`;
  let page = await get("/bills", cookie);
  const createForm = findForm(page.text, (form) => form.includes('name="frequency"'), "bill create");
  await post("/bills", cookie, createForm, {
    name,
    amount: "12.34",
    frequency: "monthly",
    startDate: todayIso(),
    dueDay: "15",
    categoryId: "",
    accountId: "",
    notes: "Smoke test bill"
  });

  page = await get("/bills", cookie);
  assert(page.text.includes(name), "Created bill did not render");

  const editForm = findForm(
    page.text,
    (form) => form.includes(name) && form.includes('name="billId"') && form.includes('name="amount"'),
    "bill edit"
  );
  const billId = inputValue(editForm, "billId");
  await post("/bills", cookie, editForm, {
    name: `${name} Edited`,
    amount: "15.67",
    frequency: "monthly",
    startDate: todayIso(),
    dueDay: "16",
    categoryId: "",
    accountId: "",
    notes: "Smoke test bill edited"
  });

  page = await get("/bills", cookie);
  assert(page.text.includes(`${name} Edited`), "Edited bill did not render");

  const archiveForm = findForm(
    page.text,
    (form) => form.includes(`value="${billId}"`) && form.includes("Archive"),
    "bill archive"
  );
  await post("/bills", cookie, archiveForm);

  page = await get("/bills", cookie);
  assert(page.text.includes("archived"), "Archived bill state did not render");

  const deleteForm = findForm(
    page.text,
    (form) => form.includes(`value="${billId}"`) && form.includes("Delete"),
    "bill delete"
  );
  await post("/bills", cookie, deleteForm);

  page = await get("/bills", cookie);
  assert(!page.text.includes(`${name} Edited`), "Deleted bill still rendered");
}

async function createEditDeleteIncome(cookie) {
  const name = `Smoke Income ${Date.now()}`;
  let page = await get("/income", cookie);
  const createForm = findForm(page.text, (form) => form.includes('name="incomeType"'), "income create");
  await post("/income", cookie, createForm, {
    employer: name,
    incomeType: "pell_grant",
    recurrence: "one_time",
    paycheckDate: todayIso(),
    basePay: "0",
    overtimePay: "0",
    bonusPay: "0",
    vaIncome: "0",
    taxesWithheld: "0",
    depositAmount: "321.00",
    categoryId: "",
    accountId: "",
    notes: "Smoke test Pell grant"
  });

  page = await get("/income?type=pell_grant", cookie);
  assert(page.text.includes(name), "Created income did not render");

  const editForm = findForm(
    page.text,
    (form) => form.includes(name) && form.includes('name="incomeId"') && form.includes('name="depositAmount"'),
    "income edit"
  );
  const incomeId = inputValue(editForm, "incomeId");
  await post("/income", cookie, editForm, {
    employer: `${name} Edited`,
    incomeType: "student_loan",
    recurrence: "one_time",
    paycheckDate: todayIso(),
    basePay: "0",
    overtimePay: "0",
    bonusPay: "0",
    vaIncome: "0",
    taxesWithheld: "0",
    depositAmount: "654.00",
    categoryId: "",
    accountId: "",
    notes: "Smoke test student loan"
  });

  page = await get("/income?type=student_loan", cookie);
  assert(page.text.includes(`${name} Edited`), "Edited income did not render");

  const deleteForm = findForm(
    page.text,
    (form) => form.includes(`value="${incomeId}"`) && form.includes("Delete"),
    "income delete"
  );
  await post("/income", cookie, deleteForm);

  page = await get("/income", cookie);
  assert(!page.text.includes(`${name} Edited`), "Deleted income still rendered");
}

async function createEditDeleteExpense(cookie) {
  const name = `Smoke Merchant ${Date.now()}`;
  let page = await get("/expenses", cookie);
  const createForm = findForm(page.text, (form) => form.includes('name="paymentMethod"'), "expense create");
  await post("/expenses", cookie, createForm, {
    amount: "44.44",
    merchant: name,
    categoryId: "",
    expenseDate: todayIso(),
    paymentMethod: "debit",
    accountId: "",
    notes: "Smoke test expense"
  });

  page = await get("/expenses", cookie);
  assert(page.text.includes(name), "Created expense did not render");

  const editForm = findForm(
    page.text,
    (form) => form.includes(name) && form.includes('name="expenseId"') && form.includes('name="amount"'),
    "expense edit"
  );
  const expenseId = inputValue(editForm, "expenseId");
  await post("/expenses", cookie, editForm, {
    amount: "55.55",
    merchant: `${name} Edited`,
    categoryId: "",
    expenseDate: todayIso(),
    paymentMethod: "credit",
    accountId: "",
    notes: "Smoke test expense edited"
  });

  page = await get("/expenses", cookie);
  assert(page.text.includes(`${name} Edited`), "Edited expense did not render");

  const deleteForm = findForm(
    page.text,
    (form) => form.includes(`value="${expenseId}"`) && form.includes("Delete"),
    "expense delete"
  );
  await post("/expenses", cookie, deleteForm);

  page = await get("/expenses", cookie);
  assert(!page.text.includes(`${name} Edited`), "Deleted expense still rendered");
}

async function createEditDeletePlanningGoal(cookie) {
  const name = `Smoke Goal ${Date.now()}`;
  let page = await get("/planning", cookie);
  const createForm = findForm(
    page.text,
    (form) => form.includes('name="targetAmount"') && !form.includes('name="goalId"'),
    "planning goal create"
  );
  await post("/planning", cookie, createForm, {
    name,
    targetAmount: "1000.00",
    currentAmount: "100.00",
    monthlyTarget: "50.00",
    targetDate: todayIso(),
    accountId: ""
  });

  page = await get("/planning", cookie);
  assert(page.text.includes(name), "Created planning goal did not render");

  const editForm = findForm(
    page.text,
    (form) => form.includes(name) && form.includes('name="goalId"') && form.includes('name="monthlyTarget"'),
    "planning goal edit"
  );
  const goalId = inputValue(editForm, "goalId");
  await post("/planning", cookie, editForm, {
    name: `${name} Edited`,
    targetAmount: "1200.00",
    currentAmount: "200.00",
    monthlyTarget: "75.00",
    targetDate: todayIso(),
    accountId: ""
  });

  page = await get("/planning", cookie);
  assert(page.text.includes(`${name} Edited`), "Edited planning goal did not render");

  const deleteForm = findForm(
    page.text,
    (form) => form.includes(`value="${goalId}"`) && form.includes("Delete"),
    "planning goal delete"
  );
  await post("/planning", cookie, deleteForm);

  page = await get("/planning", cookie);
  assert(!page.text.includes(`${name} Edited`), "Deleted planning goal still rendered");
}

async function transferBetweenAccounts(cookie) {
  const note = `Smoke Transfer ${Date.now()}`;
  let page = await get("/settings", cookie);
  const accountForms = forms(page.text).filter((form) => form.includes('name="currentBalance"'));
  const checkingForm =
    accountForms.find((form) => form.toLowerCase().includes("checking")) ?? accountForms[0];
  const savingsForm =
    accountForms.find((form) => form.toLowerCase().includes("savings")) ??
    accountForms.find((form) => form !== checkingForm);
  const fromAccountId = inputValue(checkingForm ?? "", "accountId");
  const toAccountId = inputValue(savingsForm ?? "", "accountId");

  assert(fromAccountId && toAccountId && fromAccountId !== toAccountId, "Could not find two accounts for transfer smoke test");

  const transferForm = findForm(page.text, (form) => form.includes('name="fromAccountId"'), "fund transfer");
  await post("/settings", cookie, transferForm, {
    fromAccountId,
    toAccountId,
    amount: "1.00",
    transferDate: todayIso(),
    notes: note
  });

  page = await get("/settings", cookie);
  assert(page.text.includes(note), "Transfer did not render in settings history");

  await post("/settings", cookie, transferForm, {
    fromAccountId: toAccountId,
    toAccountId: fromAccountId,
    amount: "1.00",
    transferDate: todayIso(),
    notes: `${note} return`
  });

  page = await get("/dashboard", cookie);
  assertHealthy("/dashboard", page.text, "Savings Balance");

  page = await get("/planning", cookie);
  assertHealthy("/planning", page.text, "Projected Savings Balance");
}

async function createRevokeInvite(cookie) {
  const inviteEmail = `invite-${Date.now()}@example.com`;
  let page = await get("/settings", cookie);
  const inviteForm = findForm(page.text, (form) => form.includes('name="invitedEmail"'), "household invite");

  await post("/settings", cookie, inviteForm, {
    invitedEmail: inviteEmail,
    invitedRole: "wife",
    expiresInDays: "7"
  });

  page = await get("/settings", cookie);
  assert(page.text.includes(inviteEmail), "Created invite did not render");

  const revokeForm = findForm(
    page.text,
    (form) => form.includes('name="inviteId"') && form.includes("Revoke"),
    "invite revoke"
  );
  await post("/settings", cookie, revokeForm);

  page = await get("/settings", cookie);
  assert(page.text.includes("revoked"), "Revoked invite state did not render");
}

async function main() {
  const signupPage = await get("/signup");
  assertHealthy("/signup", signupPage.text, "Create your account");

  const cookie = await login();

  for (const [path, marker] of [
    ["/dashboard", "Household Dashboard"],
    ["/planning", "Planning"],
    ["/bills", "Bills"],
    ["/income", "Income"],
    ["/income?type=va_disability", "VA disability income"],
    ["/expenses", "Expenses"],
    ["/settings", "Invite Household Member"]
  ]) {
    const page = await get(path, cookie);
    assertHealthy(path, page.text, marker);
  }

  await createEditArchiveDeleteBill(cookie);
  await createEditDeleteIncome(cookie);
  await createEditDeleteExpense(cookie);
  await createEditDeletePlanningGoal(cookie);
  await transferBetweenAccounts(cookie);
  await createRevokeInvite(cookie);

  for (const [path, marker] of [
    ["/dashboard", "Recurring Guaranteed Income"],
    ["/planning", "Projected Savings Balance"],
    ["/bills", "Recurring Bill Management"],
    ["/income", "Income By Type"],
    ["/expenses", "Recent Expenses"],
    ["/settings", "Account Activity"]
  ]) {
    const page = await get(path, cookie);
    assertHealthy(path, page.text, marker);
  }

  console.log("Smoke test passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
