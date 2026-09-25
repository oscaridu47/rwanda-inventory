export type ExpenseCategory =
  | "Rent"
  | "Electricity"
  | "Transport"
  | "Salaries"
  | "Internet"
  | "Other";

export type Expense = {
  id: string;
  businessId: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  createdAt: string;
};

const EXPENSES_STORAGE_KEY = "rwanda-inventory-expenses";
const EXPENSES_CHANGED_EVENT =
  "rwanda-inventory-expenses-changed";

function createExpenseId(): string {
  return `expense-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

export function getExpenses(): Expense[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedExpenses =
      localStorage.getItem(EXPENSES_STORAGE_KEY);

    if (!storedExpenses) {
      return [];
    }

    const expenses = JSON.parse(storedExpenses);

    if (!Array.isArray(expenses)) {
      return [];
    }

    return expenses;
  } catch {
    return [];
  }
}

function saveExpenses(expenses: Expense[]): void {
  localStorage.setItem(
    EXPENSES_STORAGE_KEY,
    JSON.stringify(expenses),
  );

  window.dispatchEvent(
    new Event(EXPENSES_CHANGED_EVENT),
  );
}

export function createExpense({
  businessId,
  category,
  amount,
  description,
}: {
  businessId: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
}): Expense | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (!businessId) {
    return null;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const expense: Expense = {
    id: createExpenseId(),
    businessId,
    category,
    amount,
    description: description.trim(),
    createdAt: new Date().toISOString(),
  };

  const expenses = getExpenses();

  saveExpenses([
    ...expenses,
    expense,
  ]);

  return expense;
}

export function getExpensesByBusinessId(
  businessId: string,
): Expense[] {
  if (!businessId) {
    return [];
  }

  return getExpenses().filter(
    (expense) =>
      expense.businessId === businessId,
  );
}

export function deleteExpense(
  expenseId: string,
): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const expenses = getExpenses();

  const exists = expenses.some(
    (expense) => expense.id === expenseId,
  );

  if (!exists) {
    return false;
  }

  saveExpenses(
    expenses.filter(
      (expense) => expense.id !== expenseId,
    ),
  );

  return true;
}

export function subscribeToExpenses(
  callback: () => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(
    EXPENSES_CHANGED_EVENT,
    callback,
  );

  return () => {
    window.removeEventListener(
      EXPENSES_CHANGED_EVENT,
      callback,
    );
  };
}