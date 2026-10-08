"use client";

import { useEffect, useMemo, useState } from "react";
import PermissionGuard from "../components/PermissionGuard";
import { getCurrentBusinessId } from "../lib/auth";
import { supabase } from "../lib/supabase";

type ReportProduct = {
  id: string;
  businessId: string;
  name: string;
  barcode: string;
  category: string;
  quantity: number;
  unit: string;
  packageUnit?: string | null;
  unitsPerPackage?: number;
  buyingPrice: number;
  sellingPrice: number;
  createdAt: string;
};

type ReportSaleItem = {
  id: string;
  saleId: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  buyingPrice: number;
  totalPrice: number;
  createdAt: string;
};

type ReportSale = {
  id: string;
  businessId: string;
  userId: string | null;
  total: number;
  paymentMethod: string;
  customerName: string | null;
  createdAt: string;
  items: ReportSaleItem[];
  profit: number;
};

type Expense = {
  id: string;
  businessId: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  createdAt: string;
};

type DateFilter =
  | "all"
  | "today"
  | "week"
  | "month"
  | "custom";

function formatMoney(amount: number) {
  return `${Number(amount || 0).toLocaleString()} RWF`;
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
  sale: ReportSale,
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

function isExpenseInDateRange(
  expense: Expense,
  filter: DateFilter,
  customStart: string,
  customEnd: string,
) {
  if (filter === "all") {
    return true;
  }

  const expenseDate = new Date(
    expense.createdAt || expense.date,
  );

  if (Number.isNaN(expenseDate.getTime())) {
    return false;
  }

  if (filter === "today") {
    return expenseDate >= getStartOfToday();
  }

  if (filter === "week") {
    return expenseDate >= getStartOfWeek();
  }

  if (filter === "month") {
    return expenseDate >= getStartOfMonth();
  }

  if (filter === "custom") {
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
}

async function loadSupabaseReportData(
  businessId: string,
) {
  /*
   * Load products, sales and expenses independently.
   *
   * This intentionally does not use the old localStorage
   * helpers from products.ts and sales.ts.
   */

  const [
    productsResult,
    salesResult,
    expensesResult,
  ] = await Promise.all([
    supabase
      .from("products")
      .select(
        `
          id,
          business_id,
          name,
          barcode,
          category,
          quantity,
          unit,
          package_unit,
          units_per_package,
          buying_price,
          selling_price,
          created_at
        `,
      )
      .eq("business_id", businessId),

    supabase
      .from("sales")
      .select(
        `
          id,
          business_id,
          user_id,
          total_amount,
          payment_method,
          customer_name,
          created_at
        `,
      )
      .eq("business_id", businessId),

    supabase
      .from("expenses")
      .select(
        `
          id,
          business_id,
          category,
          amount,
          description,
          created_at
        `,
      )
      .eq("business_id", businessId),
  ]);

  if (productsResult.error) {
    throw new Error(
      `Products report query failed: ${productsResult.error.message}`,
    );
  }

  if (salesResult.error) {
    throw new Error(
      `Sales report query failed: ${salesResult.error.message}`,
    );
  }

  if (expensesResult.error) {
    throw new Error(
      `Expenses report query failed: ${expensesResult.error.message}`,
    );
  }

  const productRows = productsResult.data ?? [];
  const saleRows = salesResult.data ?? [];
  const expenseRows = expensesResult.data ?? [];

  /*
   * Load sale_items separately.
   *
   * We do this instead of relying on a Supabase relationship
   * name because the current database structure is already known
   * and this is safer for this report.
   */

  let saleItemRows: Array<{
    id: string;
    sale_id: string;
    product_id: string | null;
    product_name: string;
    quantity: number;
    unit: string;
    unit_price: number;
    buying_price: number;
    total_price: number;
    created_at: string;
  }> = [];

  if (saleRows.length > 0) {
    const saleIds = saleRows.map(
      (sale) => sale.id,
    );

    const saleItemsResult = await supabase
      .from("sale_items")
      .select(
        `
          id,
          sale_id,
          product_id,
          product_name,
          quantity,
          unit,
          unit_price,
          buying_price,
          total_price,
          created_at
        `,
      )
      .in("sale_id", saleIds);

    if (saleItemsResult.error) {
      throw new Error(
        `Sale items report query failed: ${saleItemsResult.error.message}`,
      );
    }

    saleItemRows = saleItemsResult.data ?? [];
  }

  const products: ReportProduct[] =
    productRows.map((product) => ({
      id: String(product.id),
      businessId: String(product.business_id),
      name: String(product.name ?? ""),
      barcode: String(product.barcode ?? ""),
      category: String(product.category ?? ""),
      quantity: Number(product.quantity ?? 0),
      unit: String(product.unit ?? ""),
      packageUnit:
        product.package_unit ?? null,
      unitsPerPackage: Number(
        product.units_per_package ?? 1,
      ),
      buyingPrice: Number(
        product.buying_price ?? 0,
      ),
      sellingPrice: Number(
        product.selling_price ?? 0,
      ),
      createdAt: String(
        product.created_at ?? "",
      ),
    }));

  const itemsBySaleId =
    new Map<string, ReportSaleItem[]>();

  saleItemRows.forEach((item) => {
    const mappedItem: ReportSaleItem = {
      id: String(item.id),
      saleId: String(item.sale_id),
      productId: item.product_id
        ? String(item.product_id)
        : null,
      productName: String(
        item.product_name ?? "",
      ),
      quantity: Number(item.quantity ?? 0),
      unit: String(item.unit ?? ""),
      unitPrice: Number(
        item.unit_price ?? 0,
      ),
      buyingPrice: Number(
        item.buying_price ?? 0,
      ),
      totalPrice: Number(
        item.total_price ?? 0,
      ),
      createdAt: String(
        item.created_at ?? "",
      ),
    };

    const existing =
      itemsBySaleId.get(
        mappedItem.saleId,
      ) ?? [];

    existing.push(mappedItem);

    itemsBySaleId.set(
      mappedItem.saleId,
      existing,
    );
  });

  const sales: ReportSale[] =
    saleRows.map((sale) => {
      const saleId = String(sale.id);

      const items =
        itemsBySaleId.get(saleId) ?? [];

      const profit = items.reduce(
        (sum, item) => {
          const revenue =
            Number(item.totalPrice || 0);

          const cost =
            Number(item.buyingPrice || 0) *
            Number(item.quantity || 0);

          return sum + (revenue - cost);
        },
        0,
      );

      return {
        id: saleId,
        businessId: String(
          sale.business_id,
        ),
        userId: sale.user_id
          ? String(sale.user_id)
          : null,
        total: Number(
          sale.total_amount ?? 0,
        ),
        paymentMethod: String(
          sale.payment_method ?? "",
        ),
        customerName:
          sale.customer_name
            ? String(sale.customer_name)
            : null,
        createdAt: String(
          sale.created_at ?? "",
        ),
        items,
        profit,
      };
    });

  const expenses: Expense[] =
    expenseRows.map((expense) => ({
      id: String(expense.id),
      businessId: String(
        expense.business_id,
      ),
      description: String(
        expense.description ?? "",
      ),
      category: String(
        expense.category ?? "Other",
      ),
      amount: Number(
        expense.amount ?? 0,
      ),
      date: String(
        expense.created_at ?? "",
      ),
      createdAt: String(
        expense.created_at ?? "",
      ),
    }));

  return {
    products,
    sales,
    expenses,
  };
}

function ReportsContent() {
  const [products, setProducts] = useState<
    ReportProduct[]
  >([]);

  const [sales, setSales] = useState<
    ReportSale[]
  >([]);

  const [expenses, setExpenses] = useState<
    Expense[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [dateFilter, setDateFilter] =
    useState<DateFilter>("all");

  const [customStart, setCustomStart] =
    useState("");

  const [customEnd, setCustomEnd] =
    useState("");

  async function loadReportData() {
    setLoading(true);
    setError("");

    const businessId =
      getCurrentBusinessId();

    if (!businessId) {
      setProducts([]);
      setSales([]);
      setExpenses([]);
      setError(
        "No business is currently selected for this account.",
      );
      setLoading(false);
      return;
    }

    try {
      const reportData =
        await loadSupabaseReportData(
          businessId,
        );

      setProducts(reportData.products);
      setSales(reportData.sales);
      setExpenses(reportData.expenses);
    } catch (loadError) {
      console.error(
        "Reports loading error:",
        loadError,
      );

      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to load report data.";

      setError(message);
      setProducts([]);
      setSales([]);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReportData();

    const handleChange = () => {
      void loadReportData();
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
    return expenses.filter((expense) =>
      isExpenseInDateRange(
        expense,
        dateFilter,
        customStart,
        customEnd,
      ),
    );
  }, [
    expenses,
    dateFilter,
    customStart,
    customEnd,
  ]);

  const totalSales = useMemo(() => {
    return filteredSales.reduce(
      (sum, sale) =>
        sum + Number(sale.total || 0),
      0,
    );
  }, [filteredSales]);

  const totalCost = useMemo(() => {
    return filteredSales.reduce(
      (saleTotal, sale) => {
        const saleCost =
          sale.items.reduce(
            (itemTotal, item) => {
              return (
                itemTotal +
                Number(
                  item.buyingPrice || 0,
                ) *
                  Number(
                    item.quantity || 0,
                  )
              );
            },
            0,
          );

        return saleTotal + saleCost;
      },
      0,
    );
  }, [filteredSales]);

  const grossProfit =
    totalSales - totalCost;

  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce(
      (sum, expense) =>
        sum +
        Number(expense.amount || 0),
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
          Number(
            product.buyingPrice || 0,
          ),
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
            Number(
              item.quantity || 0,
            ),
          0,
        ),
      0,
    );
  }, [filteredSales]);

  const topSellingProducts =
    useMemo(() => {
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
            item.productId
              ? products.find(
                  (productItem) =>
                    productItem.id ===
                    item.productId,
                )
              : undefined;

          const productId =
            item.productId ??
            `unknown-${item.productName}`;

          const name =
            item.productName ||
            product?.name ||
            "Unknown Product";

          const quantity =
            Number(item.quantity || 0);

          const revenue =
            Number(item.totalPrice || 0);

          const existing =
            productMap.get(productId);

          if (existing) {
            existing.quantity +=
              quantity;

            existing.revenue +=
              revenue;
          } else {
            productMap.set(productId, {
              productId,
              name,
              quantity,
              revenue,
            });
          }
        });
      });

      return Array.from(
        productMap.values(),
      )
        .sort(
          (a, b) =>
            b.quantity - a.quantity,
        )
        .slice(0, 10);
    }, [filteredSales, products]);

  const mostProfitableProducts =
    useMemo(() => {
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
            item.productId
              ? products.find(
                  (productItem) =>
                    productItem.id ===
                    item.productId,
                )
              : undefined;

          const productId =
            item.productId ??
            `unknown-${item.productName}`;

          const name =
            item.productName ||
            product?.name ||
            "Unknown Product";

          const quantity =
            Number(item.quantity || 0);

          const revenue =
            Number(item.totalPrice || 0);

          const cost =
            Number(
              item.buyingPrice || 0,
            ) * quantity;

          const profit =
            revenue - cost;

          const existing =
            productMap.get(productId);

          if (existing) {
            existing.revenue +=
              revenue;

            existing.profit +=
              profit;
          } else {
            productMap.set(productId, {
              productId,
              name,
              revenue,
              profit,
            });
          }
        });
      });

      return Array.from(
        productMap.values(),
      )
        .sort(
          (a, b) =>
            b.profit - a.profit,
        )
        .slice(0, 10);
    }, [filteredSales, products]);

  const expenseBreakdown =
    useMemo(() => {
      const map = new Map<
        string,
        number
      >();

      filteredExpenses.forEach(
        (expense) => {
          const category =
            expense.category ||
            "Other";

          map.set(
            category,
            (map.get(category) || 0) +
              Number(
                expense.amount || 0,
              ),
          );
        },
      );

      return Array.from(
        map.entries(),
      )
        .map(
          ([category, amount]) => ({
            category,
            amount,
          }),
        )
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

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-semibold">
              Reports could not load
            </p>

            <p className="mt-1">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                void loadReportData()
              }
              className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        )}

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
                  dateFilter ===
                  filter.value
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
              {filteredSales.length ===
              1
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
              {expenseBreakdown.length ===
              0 ? (
                <p className="text-sm text-gray-500">
                  No expenses recorded for
                  this period.
                </p>
              ) : (
                <div className="space-y-3">
                  {expenseBreakdown.map(
                    (expense) => (
                      <div
                        key={
                          expense.category
                        }
                        className="flex items-center justify-between gap-4"
                      >
                        <span className="text-sm text-gray-700">
                          {
                            expense.category
                          }
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
            {topSellingProducts.length ===
            0 ? (
              <p className="p-5 text-sm text-gray-500">
                No sales found for this
                period.
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
                      <tr
                        key={
                          product.productId
                        }
                      >
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
                No product profit data
                found for this period.
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
                      <tr
                        key={
                          product.productId
                        }
                      >
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
                No sales found for this
                period.
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
                      <tr
                        key={sale.id}
                      >
                        <td className="px-5 py-3">
                          {formatDate(
                            sale.createdAt,
                          )}
                        </td>

                        <td className="px-5 py-3">
                          {sale.items.reduce(
                            (
                              sum,
                              item,
                            ) =>
                              sum +
                              Number(
                                item.quantity ||
                                  0,
                              ),
                            0,
                          )}
                        </td>

                        <td className="px-5 py-3 font-medium">
                          {formatMoney(
                            sale.total,
                          )}
                        </td>

                        <td className="px-5 py-3 font-medium">
                          {formatMoney(
                            sale.profit,
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
            {filteredExpenses.length ===
            0 ? (
              <p className="p-5 text-sm text-gray-500">
                No expenses found for this
                period.
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
                          b.createdAt ||
                            b.date ||
                            "",
                        ).getTime() -
                        new Date(
                          a.createdAt ||
                            a.date ||
                            "",
                        ).getTime(),
                    )
                    .slice(0, 20)
                    .map((expense) => (
                      <tr
                        key={expense.id}
                      >
                        <td className="px-5 py-3">
                          {formatDate(
                            expense.createdAt ||
                              expense.date,
                          )}
                        </td>

                        <td className="px-5 py-3">
                          {
                            expense.description
                          }
                        </td>

                        <td className="px-5 py-3">
                          {
                            expense.category
                          }
                        </td>

                        <td className="px-5 py-3 font-medium">
                          {formatMoney(
                            expense.amount,
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