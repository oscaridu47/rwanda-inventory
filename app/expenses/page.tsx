"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import PermissionGuard from "@/app/components/PermissionGuard";

import { getCurrentUser } from "@/app/lib/auth";
import { getBusinessByOwnerUserId } from "@/app/lib/businesses";
import { getProducts, type Product } from "@/app/lib/products";
import {
  getSalesByBusinessId,
  subscribeToSales,
  type Sale,
} from "@/app/lib/sales";

type ExpenseCategory =
  | "Other"
  | "Rent"
  | "Salaries"
  | "Electricity"
  | "Transport"
  | "Internet"
  | "Packaging"
  | "Maintenance"
  | "Taxes"
  | "Marketing";

type Expense = {
  id: string;
  businessId: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  createdAt: string;
};

const EXPENSES_STORAGE_KEY = "rwanda-inventory-expenses";
const EXPENSES_CHANGED_EVENT = "rwanda-inventory-expenses-changed";

const categories: ExpenseCategory[] = [
  "Other",
  "Rent",
  "Salaries",
  "Electricity",
  "Transport",
  "Internet",
  "Packaging",
  "Maintenance",
  "Taxes",
  "Marketing",
];

function formatRwf(value: number): string {
  return `${Math.round(value).toLocaleString()} RWF`;
}

function getExpenses(): Expense[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = localStorage.getItem(EXPENSES_STORAGE_KEY);

    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed;
  } catch {
    return [];
  }
}

function saveExpenses(expenses: Expense[]) {
  localStorage.setItem(
    EXPENSES_STORAGE_KEY,
    JSON.stringify(expenses),
  );

  window.dispatchEvent(
    new Event(EXPENSES_CHANGED_EVENT),
  );
}

function createExpenseId(): string {
  return `expense-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

function ExpensesContent() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [description, setDescription] = useState("");
  const [category, setCategory] =
    useState<ExpenseCategory>("Other");
  const [amount, setAmount] = useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function loadData() {
    const currentUser = getCurrentUser();

    if (!currentUser) {
      setSales([]);
      setProducts([]);
      setExpenses([]);
      return;
    }

    const business =
      getBusinessByOwnerUserId(currentUser.id);

    if (!business) {
      setSales([]);
      setProducts([]);
      setExpenses([]);
      return;
    }

    setSales(
      getSalesByBusinessId(business.id),
    );

    setProducts(
      getProducts().filter(
        (product) =>
          product.businessId === business.id,
      ),
    );

    setExpenses(
      getExpenses().filter(
        (expense) =>
          expense.businessId === business.id,
      ),
    );
  }

  useEffect(() => {
    loadData();

    const handleChange = () => {
      loadData();
    };

    const unsubscribeSales =
      subscribeToSales(handleChange);

    window.addEventListener(
      "rwanda-inventory-products-changed",
      handleChange,
    );

    window.addEventListener(
      EXPENSES_CHANGED_EVENT,
      handleChange,
    );

    return () => {
      unsubscribeSales();

      window.removeEventListener(
        "rwanda-inventory-products-changed",
        handleChange,
      );

      window.removeEventListener(
        EXPENSES_CHANGED_EVENT,
        handleChange,
      );
    };
  }, []);

  const report = useMemo(() => {
    let totalSales = 0;
    let totalCostOfGoods = 0;

    for (const sale of sales) {
      totalSales += sale.total;

      for (const item of sale.items) {
        const product = products.find(
          (currentProduct) =>
            currentProduct.id === item.productId,
        );

        const buyingPrice =
          product?.buyingPrice ?? 0;

        totalCostOfGoods +=
          buyingPrice * item.quantity;
      }
    }

    const grossProfit =
      totalSales - totalCostOfGoods;

    const totalExpenses = expenses.reduce(
      (sum, expense) =>
        sum + expense.amount,
      0,
    );

    const profitAfterExpenses =
      grossProfit - totalExpenses;

    const profitMargin =
      totalSales > 0
        ? (grossProfit / totalSales) * 100
        : 0;

    return {
      totalSales,
      totalCostOfGoods,
      grossProfit,
      totalExpenses,
      profitAfterExpenses,
      profitMargin,
    };
  }, [sales, products, expenses]);

  function handleAddExpense(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    const currentUser = getCurrentUser();

    if (!currentUser) {
      setError("You are not logged in.");
      return;
    }

    const business =
      getBusinessByOwnerUserId(
        currentUser.id,
      );

    if (!business) {
      setError(
        "Your account is not connected to a business.",
      );
      return;
    }

    const cleanDescription =
      description.trim();

    const numericAmount = Number(amount);

    if (!cleanDescription) {
      setError(
        "Please enter an expense description.",
      );
      return;
    }

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setError(
        "Please enter a valid expense amount.",
      );
      return;
    }

    const newExpense: Expense = {
      id: createExpenseId(),
      businessId: business.id,
      description: cleanDescription,
      category,
      amount: numericAmount,
      createdAt: new Date().toISOString(),
    };

    const allExpenses = getExpenses();

    saveExpenses([
      ...allExpenses,
      newExpense,
    ]);

    setDescription("");
    setCategory("Other");
    setAmount("");

    setMessage(
      `Expense added: ${formatRwf(numericAmount)}`,
    );
  }

  function deleteExpense(
    expenseId: string,
  ) {
    const expense =
      expenses.find(
        (item) =>
          item.id === expenseId,
      );

    if (!expense) {
      return;
    }

    const confirmed = window.confirm(
      `Delete expense "${expense.description}" of ${formatRwf(
        expense.amount,
      )}?`,
    );

    if (!confirmed) {
      return;
    }

    const remainingExpenses =
      getExpenses().filter(
        (item) =>
          item.id !== expenseId,
      );

    saveExpenses(
      remainingExpenses,
    );

    setMessage("Expense deleted.");
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Expenses
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Record business expenses and calculate
              profit after expenses.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {message && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            {error}
          </div>
        )}

        {/* FINANCIAL SUMMARY */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard
            title="Total Sales"
            value={formatRwf(report.totalSales)}
          />

          <SummaryCard
            title="Cost of Goods Sold"
            value={formatRwf(
              report.totalCostOfGoods,
            )}
          />

          <SummaryCard
            title="Gross Profit"
            value={formatRwf(
              report.grossProfit,
            )}
          />

          <SummaryCard
            title="Total Expenses"
            value={formatRwf(
              report.totalExpenses,
            )}
          />

          <SummaryCard
            title="Profit After Expenses"
            value={formatRwf(
              report.profitAfterExpenses,
            )}
            highlight
          />
        </section>

        {/* PROFIT INFORMATION */}
        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">
            Profit Overview
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <InfoBox
              label="Sales Revenue"
              value={formatRwf(
                report.totalSales,
              )}
            />

            <InfoBox
              label="Cost of Goods"
              value={formatRwf(
                report.totalCostOfGoods,
              )}
            />

            <InfoBox
              label="Gross Profit"
              value={formatRwf(
                report.grossProfit,
              )}
            />

            <InfoBox
              label="Gross Margin"
              value={`${report.profitMargin.toFixed(
                1,
              )}%`}
            />
          </div>
        </section>

        {/* ADD EXPENSE */}
        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">
            Add Expense
          </h2>

          <form
            onSubmit={handleAddExpense}
            className="mt-5 grid gap-4 md:grid-cols-4"
          >
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Description
              </label>

              <input
                type="text"
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value,
                  )
                }
                placeholder="e.g. Shop rent"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Category
              </label>

              <select
                value={category}
                onChange={(event) =>
                  setCategory(
                    event.target
                      .value as ExpenseCategory,
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              >
                {categories.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Amount (RWF)
              </label>

              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(event) =>
                  setAmount(
                    event.target.value,
                  )
                }
                placeholder="0"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-lg bg-black px-5 py-3 font-semibold text-white hover:bg-gray-800"
              >
                Add Expense
              </button>
            </div>
          </form>
        </section>

        {/* EXPENSE HISTORY */}
        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Expense History
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                All recorded business expenses.
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm text-gray-500">
                Total
              </p>

              <p className="text-lg font-bold text-gray-900">
                {formatRwf(
                  report.totalExpenses,
                )}
              </p>
            </div>
          </div>

          {expenses.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
              No expenses recorded yet.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b text-sm text-gray-500">
                    <th className="px-3 py-3">
                      Date
                    </th>

                    <th className="px-3 py-3">
                      Description
                    </th>

                    <th className="px-3 py-3">
                      Category
                    </th>

                    <th className="px-3 py-3">
                      Amount
                    </th>

                    <th className="px-3 py-3">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {[...expenses]
                    .sort(
                      (a, b) =>
                        new Date(
                          b.createdAt,
                        ).getTime() -
                        new Date(
                          a.createdAt,
                        ).getTime(),
                    )
                    .map((expense) => (
                      <tr
                        key={expense.id}
                        className="border-b"
                      >
                        <td className="px-3 py-4 text-sm">
                          {new Date(
                            expense.createdAt,
                          ).toLocaleDateString()}
                        </td>

                        <td className="px-3 py-4 font-medium text-gray-900">
                          {expense.description}
                        </td>

                        <td className="px-3 py-4">
                          {expense.category}
                        </td>

                        <td className="px-3 py-4 font-semibold">
                          {formatRwf(
                            expense.amount,
                          )}
                        </td>

                        <td className="px-3 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              deleteExpense(
                                expense.id,
                              )
                            }
                            className="text-sm font-medium text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* CALCULATION EXPLANATION */}
        <section className="mt-6 rounded-2xl bg-gray-50 p-6">
          <h2 className="text-lg font-bold text-gray-900">
            How RwandaInventory calculates profit
          </h2>

          <div className="mt-4 space-y-2 text-sm text-gray-700">
            <p>
              <strong>
                Gross Profit = Sales − Cost of Goods Sold
              </strong>
            </p>

            <p>
              <strong>
                Profit After Expenses = Gross Profit − Business Expenses
              </strong>
            </p>

            <p>
              Cost of Goods Sold uses the product's
              buying price multiplied by the quantity
              sold.
            </p>

            <p>
              Expenses include things such as rent,
              salaries, electricity, transport,
              internet, maintenance and marketing.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  title,
  value,
  highlight = false,
}: {
  title: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        highlight
          ? "border-green-200 bg-green-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <p className="text-sm text-gray-500">
        {title}
      </p>

      <p
        className={`mt-2 text-2xl font-bold ${
          highlight
            ? "text-green-700"
            : "text-gray-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-4">
      <p className="text-sm text-gray-500">
        {label}
      </p>

      <p className="mt-1 text-lg font-bold text-gray-900">
        {value}
      </p>
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <PermissionGuard permission="reports.view">
      <ExpensesContent />
    </PermissionGuard>
  );
}