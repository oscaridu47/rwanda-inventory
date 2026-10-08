"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";

import PermissionGuard from "@/app/components/PermissionGuard";

import {
  hydrateCurrentUser,
  type User,
} from "@/app/lib/auth";

import {
  hasPermission,
} from "@/app/lib/permissions";

import { supabase } from "@/app/lib/supabase";

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
  userId: string | null;
  description: string;
  category: ExpenseCategory;
  amount: number;
  createdAt: string;
};

type DatabaseExpense = {
  id: string;
  business_id: string;
  user_id: string | null;
  category: string;
  amount: number | string;
  description: string | null;
  created_at: string;
};

type DatabaseSale = {
  id: string;
  business_id: string;
  total_amount: number | string;
  created_at: string;
};

type DatabaseSaleItem = {
  id: string;
  sale_id: string;
  product_name: string;
  quantity: number | string;
  buying_price: number | string;
  total_price: number | string;
};

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

function formatRwf(
  value: number,
): string {
  return `${Math.round(
    value,
  ).toLocaleString()} RWF`;
}

function mapExpense(
  row: DatabaseExpense,
): Expense {
  return {
    id: row.id,
    businessId:
      row.business_id,
    userId:
      row.user_id,
    description:
      row.description ?? "",
    category:
      row.category as ExpenseCategory,
    amount:
      Number(row.amount),
    createdAt:
      row.created_at,
  };
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

function ExpensesContent() {
  const [user, setUser] =
    useState<User | null>(null);

  const [businessName, setBusinessName] =
    useState("");

  const [businessId, setBusinessId] =
    useState("");

  const [expenses, setExpenses] =
    useState<Expense[]>([]);

  const [totalSales, setTotalSales] =
    useState(0);

  const [totalCostOfGoods, setTotalCostOfGoods] =
    useState(0);

  const [description, setDescription] =
    useState("");

  const [category, setCategory] =
    useState<ExpenseCategory>("Other");

  const [amount, setAmount] =
    useState("");

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [deletingExpenseId, setDeletingExpenseId] =
    useState("");

  const canCreateExpenses = useMemo(
    () =>
      user
        ? hasPermission(
            user.role,
            "expenses.create",
            user.permissions,
          )
        : false,
    [user],
  );

  const canDeleteExpenses = useMemo(
    () =>
      user
        ? hasPermission(
            user.role,
            "expenses.delete",
            user.permissions,
          )
        : false,
    [user],
  );

  const canViewSales = useMemo(
    () =>
      user
        ? hasPermission(
            user.role,
            "sales.view",
            user.permissions,
          )
        : false,
    [user],
  );

  async function loadData() {
    setError("");

    try {
      const currentUser =
        await hydrateCurrentUser();

      if (!currentUser) {
        setLoading(false);
        return;
      }

      if (!currentUser.businessId) {
        throw new Error(
          "Your account is not connected to a business.",
        );
      }

      setUser(currentUser);
      setBusinessId(
        currentUser.businessId,
      );

      const {
        data: business,
        error: businessError,
      } = await supabase
        .from("businesses")
        .select(
          "id, name",
        )
        .eq(
          "id",
          currentUser.businessId,
        )
        .maybeSingle();

      if (businessError) {
        throw new Error(
          businessError.message,
        );
      }

      if (!business) {
        throw new Error(
          "Your business could not be found.",
        );
      }

      setBusinessName(
        business.name,
      );

      /*
       * Load expenses directly from Supabase.
       */
      const {
        data: expenseRows,
        error: expenseError,
      } =
        await supabase
          .from("expenses")
          .select(
            "id, business_id, user_id, category, amount, description, created_at",
          )
          .eq(
            "business_id",
            currentUser.businessId,
          )
          .order(
            "created_at",
            {
              ascending: false,
            },
          );

      if (expenseError) {
        throw new Error(
          expenseError.message,
        );
      }

      setExpenses(
        (
          expenseRows ?? []
        ).map(
          (row) =>
            mapExpense(
              row as DatabaseExpense,
            ),
        ),
      );

      /*
       * Only read sales if this user is allowed
       * to view sales.
       *
       * This avoids requiring sales.view from
       * every possible custom expenses.view user.
       */
      if (canViewSales) {
        const {
          data: saleRows,
          error: saleError,
        } =
          await supabase
            .from("sales")
            .select(
              "id, business_id, total_amount, created_at",
            )
            .eq(
              "business_id",
              currentUser.businessId,
            );

        if (saleError) {
          throw new Error(
            saleError.message,
          );
        }

        const sales =
          (saleRows ??
            []) as DatabaseSale[];

        const salesValue =
          sales.reduce(
            (sum, sale) =>
              sum +
              Number(
                sale.total_amount,
              ),
            0,
          );

        setTotalSales(
          salesValue,
        );

        /*
         * Sale items contain a snapshot of the
         * buying price, so COGS should use that
         * snapshot instead of the product's
         * current buying price.
         */
        if (sales.length > 0) {
          const saleIds =
            sales.map(
              (sale) => sale.id,
            );

          const {
            data: itemRows,
            error: itemError,
          } =
            await supabase
              .from("sale_items")
              .select(
                "id, sale_id, product_name, quantity, buying_price, total_price",
              )
              .in(
                "sale_id",
                saleIds,
              );

          if (itemError) {
            throw new Error(
              itemError.message,
            );
          }

          const items =
            (itemRows ??
              []) as DatabaseSaleItem[];

          const cost =
            items.reduce(
              (
                sum,
                item,
              ) =>
                sum +
                Number(
                  item.buying_price,
                ) *
                  Number(
                    item.quantity,
                  ),
              0,
            );

          setTotalCostOfGoods(
            cost,
          );
        } else {
          setTotalCostOfGoods(
            0,
          );
        }
      } else {
        setTotalSales(0);
        setTotalCostOfGoods(0);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load expenses.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [canViewSales]);

  const totalExpenses =
    useMemo(
      () =>
        expenses.reduce(
          (sum, expense) =>
            sum + expense.amount,
          0,
        ),
      [expenses],
    );

  const grossProfit =
    totalSales -
    totalCostOfGoods;

  const profitAfterExpenses =
    grossProfit -
    totalExpenses;

  const profitMargin =
    totalSales > 0
      ? (grossProfit /
          totalSales) *
        100
      : 0;

  async function handleAddExpense(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!canCreateExpenses) {
      setError(
        "You do not have permission to create expenses.",
      );
      return;
    }

    if (!businessId) {
      setError(
        "Your account is not connected to a business.",
      );
      return;
    }

    const cleanDescription =
      description.trim();

    const numericAmount =
      Number(amount);

    if (!cleanDescription) {
      setError(
        "Please enter an expense description.",
      );
      return;
    }

    if (
      !Number.isFinite(
        numericAmount,
      ) ||
      numericAmount <= 0
    ) {
      setError(
        "Please enter a valid expense amount greater than zero.",
      );
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: createdExpense,
        error: createError,
      } =
        await supabase.rpc(
          "record_expense",
          {
            p_business_id:
              businessId,

            p_category:
              category,

            p_amount:
              numericAmount,

            p_description:
              cleanDescription,
          },
        );

      if (createError) {
        throw new Error(
          createError.message ||
            "Unable to create expense.",
        );
      }

      if (!createdExpense) {
        throw new Error(
          "The expense was not returned by Supabase.",
        );
      }

      setDescription("");
      setCategory("Other");
      setAmount("");

      setMessage(
        `Expense added successfully: ${formatRwf(
          numericAmount,
        )}`,
      );

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create expense.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteExpense(
    expense: Expense,
  ) {
    setError("");
    setMessage("");

    if (!canDeleteExpenses) {
      setError(
        "You do not have permission to delete expenses.",
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Delete expense "${expense.description}" of ${formatRwf(
          expense.amount,
        )}?`,
      );

    if (!confirmed) {
      return;
    }

    setDeletingExpenseId(
      expense.id,
    );

    try {
      const {
        data: deletedExpense,
        error: deleteError,
      } =
        await supabase.rpc(
          "delete_expense",
          {
            p_business_id:
              businessId,

            p_expense_id:
              expense.id,
          },
        );

      if (deleteError) {
        throw new Error(
          deleteError.message ||
            "Unable to delete expense.",
        );
      }

      if (!deletedExpense) {
        throw new Error(
          "The expense could not be deleted.",
        );
      }

      setMessage(
        "Expense deleted successfully.",
      );

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete expense.",
      );
    } finally {
      setDeletingExpenseId("");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-gray-600">
            Loading expenses...
          </p>
        </div>
      </main>
    );
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
              {businessName ||
                "Record business expenses and calculate profit."}
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

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SummaryCard
            title="Total Sales"
            value={formatRwf(
              totalSales,
            )}
          />

          <SummaryCard
            title="Cost of Goods Sold"
            value={formatRwf(
              totalCostOfGoods,
            )}
          />

          <SummaryCard
            title="Gross Profit"
            value={formatRwf(
              grossProfit,
            )}
          />

          <SummaryCard
            title="Total Expenses"
            value={formatRwf(
              totalExpenses,
            )}
          />

          <SummaryCard
            title="Profit After Expenses"
            value={formatRwf(
              profitAfterExpenses,
            )}
            highlight
          />
        </section>

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">
            Profit Overview
          </h2>

          {!canViewSales && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Your account does not have
              permission to view sales, so sales-based
              profit figures are not displayed.
            </div>
          )}

          <div className="mt-5 grid gap-4 md:grid-cols-4">
            <InfoBox
              label="Sales Revenue"
              value={formatRwf(
                totalSales,
              )}
            />

            <InfoBox
              label="Cost of Goods"
              value={formatRwf(
                totalCostOfGoods,
              )}
            />

            <InfoBox
              label="Gross Profit"
              value={formatRwf(
                grossProfit,
              )}
            />

            <InfoBox
              label="Gross Margin"
              value={`${profitMargin.toFixed(
                1,
              )}%`}
            />
          </div>
        </section>

        {canCreateExpenses && (
          <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">
              Add Expense
            </h2>

            <form
              onSubmit={
                handleAddExpense
              }
              className="mt-5 grid gap-4 md:grid-cols-4"
            >
              <div>
                <label
                  htmlFor="expense-description"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Description
                </label>

                <input
                  id="expense-description"
                  type="text"
                  value={description}
                  onChange={(event) =>
                    setDescription(
                      event.target.value,
                    )
                  }
                  disabled={
                    submitting
                  }
                  placeholder="e.g. Shop rent"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
                />
              </div>

              <div>
                <label
                  htmlFor="expense-category"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Category
                </label>

                <select
                  id="expense-category"
                  value={category}
                  onChange={(event) =>
                    setCategory(
                      event.target
                        .value as ExpenseCategory,
                    )
                  }
                  disabled={
                    submitting
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
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
                <label
                  htmlFor="expense-amount"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Amount (RWF)
                </label>

                <input
                  id="expense-amount"
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(event) =>
                    setAmount(
                      event.target.value,
                    )
                  }
                  disabled={
                    submitting
                  }
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black disabled:bg-gray-100"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={
                    submitting
                  }
                  className="w-full rounded-lg bg-black px-5 py-3 font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? "Adding..."
                    : "Add Expense"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Expense History
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Expenses are loaded directly from
                Supabase.
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm text-gray-500">
                Total
              </p>

              <p className="text-lg font-bold text-gray-900">
                {formatRwf(
                  totalExpenses,
                )}
              </p>
            </div>
          </div>

          {expenses.length ===
          0 ? (
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

                    {canDeleteExpenses && (
                      <th className="px-3 py-3">
                        Action
                      </th>
                    )}
                  </tr>
                </thead>

                <tbody>
                  {expenses.map(
                    (expense) => {
                      const deleting =
                        deletingExpenseId ===
                        expense.id;

                      return (
                        <tr
                          key={
                            expense.id
                          }
                          className="border-b last:border-b-0"
                        >
                          <td className="px-3 py-4 text-sm text-gray-600">
                            {new Date(
                              expense.createdAt,
                            ).toLocaleString()}
                          </td>

                          <td className="px-3 py-4 font-medium text-gray-900">
                            {
                              expense.description
                            }
                          </td>

                          <td className="px-3 py-4">
                            {
                              expense.category
                            }
                          </td>

                          <td className="px-3 py-4 font-semibold text-gray-900">
                            {formatRwf(
                              expense.amount,
                            )}
                          </td>

                          {canDeleteExpenses && (
                            <td className="px-3 py-4">
                              <button
                                type="button"
                                onClick={() =>
                                  void handleDeleteExpense(
                                    expense,
                                  )
                                }
                                disabled={
                                  deletingExpenseId !==
                                    "" ||
                                  submitting
                                }
                                className="text-sm font-medium text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {deleting
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl bg-gray-50 p-6">
          <h2 className="text-lg font-bold text-gray-900">
            How RwandaInventory calculates profit
          </h2>

          <div className="mt-4 space-y-2 text-sm text-gray-700">
            <p>
              <strong>
                Gross Profit = Sales − Cost of Goods
                Sold
              </strong>
            </p>

            <p>
              <strong>
                Profit After Expenses = Gross Profit −
                Business Expenses
              </strong>
            </p>

            <p>
              Cost of Goods Sold uses the buying-price
              snapshot stored on each sale item.
            </p>

            <p>
              Expenses include rent, salaries,
              electricity, transport, internet,
              packaging, maintenance, taxes and
              marketing.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function ExpensesPage() {
  return (
    <PermissionGuard permission="expenses.view">
      <ExpensesContent />
    </PermissionGuard>
  );
}