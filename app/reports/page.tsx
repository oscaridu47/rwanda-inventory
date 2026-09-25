"use client";

import { useEffect, useMemo, useState } from "react";
import PermissionGuard from "../components/PermissionGuard";
import { getCurrentBusinessId } from "../lib/auth";
import { getProductsByBusinessId, type Product } from "../lib/products";
import { getSalesByBusinessId, type Sale } from "../lib/sales";

type Expense = {
  id: string;
  businessId?: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  createdAt?: string;
};

type DateFilter =
  | "all"
  | "today"
  | "week"
  | "month"
  | "custom";

const EXPENSES_STORAGE_KEY = "rwanda-inventory-expenses";

function formatMoney(amount: number) {
  return `${amount.toLocaleString()} RWF`;
}

function formatDate(date: string) {
  if (!date) return "-";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString();
}

function getStartOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function getStartOfWeek() {
  const date = new Date();
  const day = date.getDay();
  const difference = day === 0 ? 6 : day - 1;

  date.setDate(date.getDate() - difference);
  date.setHours(0, 0, 0, 0);

  return date;
}

function getStartOfMonth() {
  const date = new Date();

  date.setDate(1);
  date.setHours(0, 0, 0, 0);

  return date;
}

function isSaleInDateRange(
  sale: Sale,
  filter: DateFilter,
  customStart: string,
  customEnd: string,
) {
  if (filter === "all") {
    return true;
  }

  const saleDate = new Date(sale.createdAt);

  if (Number.isNaN(saleDate.getTime())) {
    return false;
  }

  if (filter === "today") {
    return saleDate >= getStartOfToday();
  }

  if (filter === "week") {
    return saleDate >= getStartOfWeek();
  }

  if (filter === "month") {
    return saleDate >= getStartOfMonth();
  }

  if (filter === "custom") {
    const start = customStart
      ? new Date(`${customStart}T00:00:00`)
      : null;

    const end = customEnd
      ? new Date(`${customEnd}T23:59:59.999`)
      : null;

    if (start && saleDate < start) {
      return false;
    }

    if (end && saleDate > end) {
      return false;
    }

    return true;
  }

  return true;
}

function ReportsContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [loading, setLoading] = useState(true);

  const [dateFilter, setDateFilter] =
    useState<DateFilter>("all");

  const [customStart, setCustomStart] =
    useState("");

  const [customEnd, setCustomEnd] =
    useState("");

  function loadReportData() {
    const businessId = getCurrentBusinessId();

    if (!businessId) {
      setProducts([]);
      setSales([]);
      setExpenses([]);
      setLoading(false);
      return;
    }

    const businessProducts =
      getProductsByBusinessId(businessId);

    const businessSales =
      getSalesByBusinessId(businessId);

    setProducts(businessProducts);
    setSales(businessSales);

    try {
      const storedExpenses =
        localStorage.getItem(
          EXPENSES_STORAGE_KEY,
        );

      if (!storedExpenses) {
        setExpenses([]);
      } else {
        const parsedExpenses =
          JSON.parse(storedExpenses);

        if (Array.isArray(parsedExpenses)) {
          const businessExpenses =
            parsedExpenses.filter(
              (expense): expense is Expense =>
                expense &&
                typeof expense === "object" &&
                expense.businessId === businessId &&
                typeof expense.amount === "number",
            );

          setExpenses(businessExpenses);
        } else {
          setExpenses([]);
        }
      }
    } catch {
      setExpenses([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadReportData();

    const handleChange = () => {
      loadReportData();
    };

    window.addEventListener(
      "rwanda-inventory-sales-changed",
      handleChange,
    );

    window.addEventListener(
      "rwanda-inventory-products-changed",
      handleChange,
    );

    window.addEventListener(
      "rwanda-inventory-expenses-changed",
      handleChange,
    );

    window.addEventListener(
      "storage",
      handleChange,
    );

    return () => {
      window.removeEventListener(
        "rwanda-inventory-sales-changed",
        handleChange,
      );

      window.removeEventListener(
        "rwanda-inventory-products-changed",
        handleChange,
      );

      window.removeEventListener(
        "rwanda-inventory-expenses-changed",
        handleChange,
      );

      window.removeEventListener(
        "storage",
        handleChange,
      );
    };
  }, []);

  const filteredSales = useMemo(() => {
    return sales.filter((sale) =>
      isSaleInDateRange(
        sale,
        dateFilter,
        customStart,
        customEnd,
      ),
    );
  }, [
    sales,
    dateFilter,
    customStart,
    customEnd,
  ]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const expenseDate = new Date(
        expense.date || expense.createdAt || "",
      );

      if (Number.isNaN(expenseDate.getTime())) {
        return false;
      }

      if (dateFilter === "all") {
        return true;
      }

      if (dateFilter === "today") {
        return expenseDate >= getStartOfToday();
      }

      if (dateFilter === "week") {
        return expenseDate >= getStartOfWeek();
      }

      if (dateFilter === "month") {
        return expenseDate >= getStartOfMonth();
      }

      if (dateFilter === "custom") {
        const start = customStart
          ? new Date(`${customStart}T00:00:00`)
          : null;

        const end = customEnd
          ? new Date(`${customEnd}T23:59:59.999`)
          : null;

        if (start && expenseDate < start) {
          return false;
        }

        if (end && expenseDate > end) {
          return false;
        }

        return true;
      }

      return true;
    });
  }, [
    expenses,
    dateFilter,
    customStart,
    customEnd,
  ]);

  const totalSales = useMemo(() => {
    return filteredSales.reduce(
      (sum, sale) => sum + Number(sale.total || 0),
      0,
    );
  }, [filteredSales]);

  const totalCost = useMemo(() => {
    return filteredSales.reduce(
      (saleTotal, sale) => {
        const saleCost = sale.items.reduce(
          (itemTotal, item) => {
            const product = products.find(
              (productItem) =>
                productItem.id === item.productId,
            );

            const buyingPrice =
              typeof item.buyingPrice === "number"
                ? item.buyingPrice
                : product?.buyingPrice ?? 0;

            return (
              itemTotal +
              buyingPrice * Number(item.quantity || 0)
            );
          },
          0,
        );

        return saleTotal + saleCost;
      },
      0,
    );
  }, [filteredSales, products]);

  const grossProfit = totalSales - totalCost;

  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce(
      (sum, expense) =>
        sum + Number(expense.amount || 0),
      0,
    );
  }, [filteredExpenses]);

  const profitAfterExpenses =
    grossProfit - totalExpenses;

  const stockValue = useMemo(() => {
    return products.reduce(
      (sum, product) =>
        sum +
        Number(product.quantity || 0) *
          Number(product.buyingPrice || 0),
      0,
    );
  }, [products]);

  const totalUnitsSold = useMemo(() => {
    return filteredSales.reduce(
      (saleTotal, sale) =>
        saleTotal +
        sale.items.reduce(
          (itemTotal, item) =>
            itemTotal +
            Number(item.quantity || 0),
          0,
        ),
      0,
    );
  }, [filteredSales]);

  const topSellingProducts = useMemo(() => {
    const productMap = new Map<
      string,
      {
        productId: string;
        name: string;
        quantity: number;
        revenue: number;
      }
    >();

    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const product =
          products.find(
            (productItem) =>
              productItem.id === item.productId,
          );

        const name =
          item.productName ||
          product?.name ||
          "Unknown Product";

        const existing =
          productMap.get(item.productId);

        const quantity =
          Number(item.quantity || 0);

        const revenue =
          Number(item.sellingPrice || 0) *
          quantity;

        if (existing) {
          existing.quantity += quantity;
          existing.revenue += revenue;
        } else {
          productMap.set(item.productId, {
            productId: item.productId,
            name,
            quantity,
            revenue,
          });
        }
      });
    });

    return Array.from(productMap.values())
      .sort(
        (a, b) =>
          b.quantity - a.quantity,
      )
      .slice(0, 10);
  }, [filteredSales, products]);

  const mostProfitableProducts = useMemo(() => {
    const productMap = new Map<
      string,
      {
        productId: string;
        name: string;
        profit: number;
        revenue: number;
      }
    >();

    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const product =
          products.find(
            (productItem) =>
              productItem.id === item.productId,
          );

        const name =
          item.productName ||
          product?.name ||
          "Unknown Product";

        const quantity =
          Number(item.quantity || 0);

        const sellingPrice =
          Number(item.sellingPrice || 0);

        const buyingPrice =
          typeof item.buyingPrice === "number"
            ? item.buyingPrice
            : product?.buyingPrice ?? 0;

        const revenue =
          sellingPrice * quantity;

        const cost =
          buyingPrice * quantity;

        const profit = revenue - cost;

        const existing =
          productMap.get(item.productId);

        if (existing) {
          existing.revenue += revenue;
          existing.profit += profit;
        } else {
          productMap.set(item.productId, {
            productId: item.productId,
            name,
            revenue,
            profit,
          });
        }
      });
    });

    return Array.from(productMap.values())
      .sort(
        (a, b) =>
          b.profit - a.profit,
      )
      .slice(0, 10);
  }, [filteredSales, products]);

  const expenseBreakdown = useMemo(() => {
    const map = new Map<
      string,
      number
    >();

    filteredExpenses.forEach((expense) => {
      const category =
        expense.category || "Other";

      map.set(
        category,
        (map.get(category) || 0) +
          Number(expense.amount || 0),
      );
    });

    return Array.from(map.entries())
      .map(([category, amount]) => ({
        category,
        amount,
      }))
      .sort(
        (a, b) =>
          b.amount - a.amount,
      );
  }, [filteredExpenses]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="rounded-xl border bg-white p-6">
          Loading reports...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Reports
          </h1>

          <p className="mt-1 text-sm text-gray-600">
            View sales, profit, expenses, and
            stock information for your business.
          </p>
        </div>

        {/* Date Filters */}
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {[
              {
                value: "all",
                label: "All Time",
              },
              {
                value: "today",
                label: "Today",
              },
              {
                value: "week",
                label: "This Week",
              },
              {
                value: "month",
                label: "This Month",
              },
              {
                value: "custom",
                label: "Custom",
              },
            ].map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() =>
                  setDateFilter(
                    filter.value as DateFilter,
                  )
                }
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  dateFilter === filter.value
                    ? "bg-black text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {dateFilter === "custom" && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Start Date
                </label>

                <input
                  type="date"
                  value={customStart}
                  onChange={(event) =>
                    setCustomStart(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  End Date
                </label>

                <input
                  type="date"
                  value={customEnd}
                  onChange={(event) =>
                    setCustomEnd(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>
            </div>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Total Sales
            </p>

            <p className="mt-2 text-2xl font-bold">
              {formatMoney(totalSales)}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              {filteredSales.length} sale
              {filteredSales.length === 1
                ? ""
                : "s"}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Cost of Goods Sold
            </p>

            <p className="mt-2 text-2xl font-bold">
              {formatMoney(totalCost)}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Gross Profit
            </p>

            <p className="mt-2 text-2xl font-bold">
              {formatMoney(grossProfit)}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Expenses
            </p>

            <p className="mt-2 text-2xl font-bold">
              {formatMoney(totalExpenses)}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Profit After Expenses
            </p>

            <p className="mt-2 text-2xl font-bold">
              {formatMoney(
                profitAfterExpenses,
              )}
            </p>
          </div>

          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Stock Value
            </p>

            <p className="mt-2 text-2xl font-bold">
              {formatMoney(stockValue)}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              {products.length} product
              {products.length === 1
                ? ""
                : "s"}
            </p>
          </div>
        </div>

        {/* Sales Overview */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border bg-white shadow-sm">
            <div className="border-b p-5">
              <h2 className="text-lg font-semibold">
                Sales Overview
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-4 p-5">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">
                  Sales Transactions
                </p>

                <p className="mt-2 text-xl font-bold">
                  {filteredSales.length}
                </p>
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-sm text-gray-500">
                  Units Sold
                </p>

                <p className="mt-2 text-xl font-bold">
                  {totalUnitsSold}
                </p>
              </div>
            </div>
          </section>

          {/* Expense Breakdown */}
          <section className="rounded-xl border bg-white shadow-sm">
            <div className="border-b p-5">
              <h2 className="text-lg font-semibold">
                Expense Breakdown
              </h2>
            </div>

            <div className="p-5">
              {expenseBreakdown.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No expenses recorded for this
                  period.
                </p>
              ) : (
                <div className="space-y-3">
                  {expenseBreakdown.map(
                    (expense) => (
                      <div
                        key={expense.category}
                        className="flex items-center justify-between gap-4"
                      >
                        <span className="text-sm text-gray-700">
                          {expense.category}
                        </span>

                        <span className="text-sm font-semibold">
                          {formatMoney(
                            expense.amount,
                          )}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Top Selling Products */}
        <section className="rounded-xl border bg-white shadow-sm">
          <div className="border-b p-5">
            <h2 className="text-lg font-semibold">
              Top Selling Products
            </h2>
          </div>

          <div className="overflow-x-auto">
            {topSellingProducts.length === 0 ? (
              <p className="p-5 text-sm text-gray-500">
                No sales found for this period.
              </p>
            ) : (
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 font-medium">
                      Product
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Quantity Sold
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Revenue
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {topSellingProducts.map(
                    (product) => (
                      <tr key={product.productId}>
                        <td className="px-5 py-3">
                          {product.name}
                        </td>

                        <td className="px-5 py-3">
                          {product.quantity}
                        </td>

                        <td className="px-5 py-3 font-medium">
                          {formatMoney(
                            product.revenue,
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Most Profitable Products */}
        <section className="rounded-xl border bg-white shadow-sm">
          <div className="border-b p-5">
            <h2 className="text-lg font-semibold">
              Most Profitable Products
            </h2>
          </div>

          <div className="overflow-x-auto">
            {mostProfitableProducts.length ===
            0 ? (
              <p className="p-5 text-sm text-gray-500">
                No product profit data found for
                this period.
              </p>
            ) : (
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 font-medium">
                      Product
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Revenue
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Profit
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {mostProfitableProducts.map(
                    (product) => (
                      <tr key={product.productId}>
                        <td className="px-5 py-3">
                          {product.name}
                        </td>

                        <td className="px-5 py-3">
                          {formatMoney(
                            product.revenue,
                          )}
                        </td>

                        <td className="px-5 py-3 font-medium">
                          {formatMoney(
                            product.profit,
                          )}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Recent Sales */}
        <section className="rounded-xl border bg-white shadow-sm">
          <div className="border-b p-5">
            <h2 className="text-lg font-semibold">
              Recent Sales
            </h2>
          </div>

          <div className="overflow-x-auto">
            {filteredSales.length === 0 ? (
              <p className="p-5 text-sm text-gray-500">
                No sales found for this period.
              </p>
            ) : (
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 font-medium">
                      Date
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Items
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Total
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Profit
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {[...filteredSales]
                    .sort(
                      (a, b) =>
                        new Date(
                          b.createdAt,
                        ).getTime() -
                        new Date(
                          a.createdAt,
                        ).getTime(),
                    )
                    .slice(0, 20)
                    .map((sale) => (
                      <tr key={sale.id}>
                        <td className="px-5 py-3">
                          {formatDate(
                            sale.createdAt,
                          )}
                        </td>

                        <td className="px-5 py-3">
                          {sale.items.reduce(
                            (sum, item) =>
                              sum +
                              Number(
                                item.quantity || 0,
                              ),
                            0,
                          )}
                        </td>

                        <td className="px-5 py-3 font-medium">
                          {formatMoney(
                            Number(
                              sale.total || 0,
                            ),
                          )}
                        </td>

                        <td className="px-5 py-3 font-medium">
                          {formatMoney(
                            Number(
                              sale.profit || 0,
                            ),
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Expense History */}
        <section className="rounded-xl border bg-white shadow-sm">
          <div className="border-b p-5">
            <h2 className="text-lg font-semibold">
              Expense History
            </h2>
          </div>

          <div className="overflow-x-auto">
            {filteredExpenses.length === 0 ? (
              <p className="p-5 text-sm text-gray-500">
                No expenses found for this period.
              </p>
            ) : (
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 font-medium">
                      Date
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Description
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Category
                    </th>

                    <th className="px-5 py-3 font-medium">
                      Amount
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {[...filteredExpenses]
                    .sort(
                      (a, b) =>
                        new Date(
                          b.date ||
                            b.createdAt ||
                            "",
                        ).getTime() -
                        new Date(
                          a.date ||
                            a.createdAt ||
                            "",
                        ).getTime(),
                    )
                    .slice(0, 20)
                    .map((expense) => (
                      <tr key={expense.id}>
                        <td className="px-5 py-3">
                          {formatDate(
                            expense.date ||
                              expense.createdAt ||
                              "",
                          )}
                        </td>

                        <td className="px-5 py-3">
                          {expense.description}
                        </td>

                        <td className="px-5 py-3">
                          {expense.category}
                        </td>

                        <td className="px-5 py-3 font-medium">
                          {formatMoney(
                            Number(
                              expense.amount || 0,
                            ),
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Data Status */}
        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">
            Report Data
          </h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-500">
                Products
              </p>

              <p className="mt-1 text-xl font-bold">
                {products.length}
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-500">
                Sales
              </p>

              <p className="mt-1 text-xl font-bold">
                {sales.length}
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <p className="text-sm text-gray-500">
                Expenses
              </p>

              <p className="mt-1 text-xl font-bold">
                {expenses.length}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <PermissionGuard permission="reports.view">
      <ReportsContent />
    </PermissionGuard>
  );
}