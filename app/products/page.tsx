"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

import {
  deleteProduct,
  getProducts,
  Product,
  subscribeToProducts,
} from "@/app/lib/products";

import PermissionGuard from "@/app/components/PermissionGuard";

const currencyFormatter =
  new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: "RWF",
    maximumFractionDigits: 0,
  });

function ProductsContent() {
  const [products, setProducts] =
    useState<Product[]>([]);

  const [error, setError] =
    useState("");

  function refreshProducts() {
    setProducts(getProducts());
  }

  useEffect(() => {
    refreshProducts();

    const unsubscribe =
      subscribeToProducts(
        refreshProducts,
      );

    return () => {
      unsubscribe();
    };
  }, []);

  function handleDelete(
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

    if (!deleteProduct(product.id)) {
      setError(
        "The product could not be deleted. Please try again.",
      );

      return;
    }

    refreshProducts();
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

            {products.length === 0 ? (
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
                            {product.barcode}
                          </td>

                          <td className="px-3 py-4 text-gray-600">
                            {product.category}
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
                                className="font-medium text-red-700 hover:text-red-900"
                              >
                                Delete
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