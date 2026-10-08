"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import PermissionGuard from "@/app/components/PermissionGuard";
import {
  getCurrentBusinessId,
} from "@/app/lib/auth";
import {
  isProductUnit,
  productUnits,
  type Product,
  type ProductUnit,
} from "@/app/lib/products";
import { supabase } from "@/app/lib/supabase";

const currencyFormatter =
  new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: "RWF",
    maximumFractionDigits: 0,
  });

type ProductRow = {
  id: string;
  business_id: string;
  name: string | null;
  barcode: string | null;
  category: string | null;
  quantity: number | string | null;
  unit: string | null;
  package_unit: string | null;
  units_per_package: number | string | null;
  buying_price: number | string | null;
  selling_price: number | string | null;
  created_at: string | null;
};

function toNumber(
  value: number | string | null | undefined,
  fallback = 0,
): number {
  const parsed =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function toProductUnit(
  value: string | null | undefined,
  fallback: ProductUnit,
): ProductUnit {
  if (
    typeof value === "string" &&
    isProductUnit(value)
  ) {
    return value;
  }

  return fallback;
}

function mapProductRow(
  row: ProductRow,
): Product {
  const baseUnit = toProductUnit(
    row.unit,
    "Piece",
  );

  const packageUnit = toProductUnit(
    row.package_unit,
    baseUnit,
  );

  const unitsPerPackage = Math.max(
    0.000001,
    toNumber(
      row.units_per_package,
      1,
    ),
  );

  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name ?? "",
    barcode: row.barcode ?? "",
    category: row.category ?? "",
    quantity: Math.max(
      0,
      toNumber(row.quantity),
    ),
    unit: baseUnit,
    packageUnit,
    unitsPerPackage,
    buyingPrice: Math.max(
      0,
      toNumber(row.buying_price),
    ),
    sellingPrice: Math.max(
      0,
      toNumber(row.selling_price),
    ),
    createdAt:
      row.created_at ??
      new Date().toISOString(),
  };
}

function ProductsContent() {
  const [products, setProducts] =
    useState<Product[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  const loadProducts =
    useCallback(async () => {
      setError("");

      const businessId =
        getCurrentBusinessId();

      if (!businessId) {
        setProducts([]);
        setError(
          "No business is connected to this account. Please sign in again.",
        );
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        /*
         * The business_id filter is useful for correctness
         * and performance.
         *
         * Supabase RLS is still the real security boundary.
         */
        const {
          data,
          error: fetchError,
        } = await supabase
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
          .eq(
            "business_id",
            businessId,
          )
          .order(
            "created_at",
            {
              ascending: false,
            },
          );

        if (fetchError) {
          throw new Error(
            fetchError.message,
          );
        }

        const mappedProducts =
          ((data ?? []) as ProductRow[]).map(
            mapProductRow,
          );

        setProducts(
          mappedProducts,
        );
      } catch (err) {
        setProducts([]);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load products.",
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadProducts();

    /*
     * Refresh when the user returns to this page/window.
     * This helps pick up products added or edited elsewhere
     * without requiring browser localStorage events.
     */
    function handleFocus() {
      void loadProducts();
    }

    window.addEventListener(
      "focus",
      handleFocus,
    );

    return () => {
      window.removeEventListener(
        "focus",
        handleFocus,
      );
    };
  }, [loadProducts]);

  async function handleDelete(
    product: Product,
  ) {
    setError("");

    const shouldDelete =
      window.confirm(
        `Delete "${product.name}"? This action cannot be undone.`,
      );

    if (!shouldDelete) {
      return;
    }

    const businessId =
      getCurrentBusinessId();

    if (!businessId) {
      setError(
        "No business is connected to this account.",
      );
      return;
    }

    setDeletingId(product.id);

    try {
      const {
        error: deleteError,
      } = await supabase
        .from("products")
        .delete()
        .eq(
          "id",
          product.id,
        )
        .eq(
          "business_id",
          businessId,
        );

      if (deleteError) {
        throw new Error(
          deleteError.message,
        );
      }

      /*
       * RLS controls whether this delete actually
       * succeeds. If the user does not have the
       * required permission, Supabase will prevent
       * unauthorized deletion.
       */
      await loadProducts();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The product could not be deleted. Please try again.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Products
            </h1>

            <p className="mt-2 text-gray-600">
              Manage your inventory products.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/"
              className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
            >
              Dashboard
            </Link>

            <Link
              href="/products/add"
              className="rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
            >
              Add Product
            </Link>
          </div>
        </div>

        <div className="mt-8 rounded-xl bg-white p-6 shadow">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Product List
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {products.length} product
                {products.length === 1
                  ? ""
                  : "s"} registered
              </p>
            </div>

            {loading && (
              <span className="text-sm text-gray-500">
                Loading...
              </span>
            )}
          </div>

          <div className="mt-6 border-t pt-6">
            {error && (
              <p
                aria-live="polite"
                className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600"
              >
                {error}
              </p>
            )}

            {loading ? (
              <div className="py-10 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

                <p className="mt-4 text-sm text-gray-500">
                  Loading products...
                </p>
              </div>
            ) : products.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-gray-500">
                  No products added yet.
                </p>

                <Link
                  href="/products/add"
                  className="mt-4 inline-block rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
                >
                  Add Your First Product
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="border-b text-gray-500">
                    <tr>
                      <th className="px-3 py-3 font-medium">
                        Product
                      </th>

                      <th className="px-3 py-3 font-medium">
                        Barcode
                      </th>

                      <th className="px-3 py-3 font-medium">
                        Category
                      </th>

                      <th className="px-3 py-3 font-medium">
                        Quantity
                      </th>

                      <th className="px-3 py-3 font-medium">
                        Buying Price
                      </th>

                      <th className="px-3 py-3 font-medium">
                        Selling Price
                      </th>

                      <th className="px-3 py-3 font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {products.map(
                      (product) => (
                        <tr
                          className="border-b last:border-0"
                          key={product.id}
                        >
                          <td className="px-3 py-4 font-medium text-gray-900">
                            {product.name}
                          </td>

                          <td className="px-3 py-4 text-gray-600">
                            {product.barcode || "—"}
                          </td>

                          <td className="px-3 py-4 text-gray-600">
                            {product.category || "—"}
                          </td>

                          <td className="px-3 py-4 text-gray-600">
                            {product.quantity}{" "}
                            {product.unit}
                          </td>

                          <td className="px-3 py-4 text-gray-600">
                            {currencyFormatter.format(
                              product.buyingPrice,
                            )}
                          </td>

                          <td className="px-3 py-4 text-gray-600">
                            {currencyFormatter.format(
                              product.sellingPrice,
                            )}
                          </td>

                          <td className="px-3 py-4">
                            <div className="flex items-center gap-3">
                              <Link
                                href={`/products/add?productId=${product.id}`}
                                className="font-medium text-blue-700 hover:text-blue-900"
                              >
                                Edit
                              </Link>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDelete(
                                    product,
                                  )
                                }
                                disabled={
                                  deletingId ===
                                  product.id
                                }
                                className="font-medium text-red-700 hover:text-red-900 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {deletingId ===
                                product.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ProductsPage() {
  return (
    <PermissionGuard permission="products.view">
      <ProductsContent />
    </PermissionGuard>
  );
}