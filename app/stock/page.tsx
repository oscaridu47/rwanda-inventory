"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import PermissionGuard from "../components/PermissionGuard";

import {
  adjustProductQuantity,
  getProducts,
  Product,
  subscribeToProducts,
} from "../lib/products";

import {
  addStockMovement,
  getStockMovements,
  StockMovement,
  subscribeToStockMovements,
} from "../lib/stock";

function StockContent() {
  const [products, setProducts] =
    useState<Product[]>([]);

  const [movements, setMovements] =
    useState<StockMovement[]>([]);

  const [selectedProductId, setSelectedProductId] =
    useState("");

  const [movementType, setMovementType] =
    useState<"received" | "adjustment">(
      "received",
    );

  const [quantity, setQuantity] =
    useState("");

  const [reason, setReason] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  function refreshData() {
    const savedProducts =
      getProducts();

    setProducts(savedProducts);
    setMovements(
      getStockMovements(),
    );

    setSelectedProductId(
      (currentId) => {
        if (
          currentId &&
          savedProducts.some(
            (product) =>
              product.id === currentId,
          )
        ) {
          return currentId;
        }

        return (
          savedProducts[0]?.id ?? ""
        );
      },
    );
  }

  useEffect(() => {
    refreshData();

    const unsubscribeProducts =
      subscribeToProducts(
        refreshData,
      );

    const unsubscribeMovements =
      subscribeToStockMovements(
        refreshData,
      );

    return () => {
      unsubscribeProducts();
      unsubscribeMovements();
    };
  }, []);

  const selectedProduct =
    products.find(
      (product) =>
        product.id ===
        selectedProductId,
    );

  const filteredProducts =
    useMemo(() => {
      const searchText =
        search.trim().toLowerCase();

      if (!searchText) {
        return products;
      }

      return products.filter(
        (product) =>
          product.name
            .toLowerCase()
            .includes(searchText) ||
          product.barcode
            .toLowerCase()
            .includes(searchText) ||
          product.category
            .toLowerCase()
            .includes(searchText),
      );
    }, [products, search]);

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!selectedProduct) {
      setError(
        "Please select a product.",
      );
      return;
    }

    const enteredQuantity =
      Number(quantity);

    if (
      !Number.isFinite(
        enteredQuantity,
      ) ||
      enteredQuantity === 0
    ) {
      setError(
        "Enter a valid quantity greater than or less than zero.",
      );
      return;
    }

    let quantityChange =
      enteredQuantity;

    if (
      movementType === "received" &&
      enteredQuantity < 0
    ) {
      setError(
        "Received stock must be a positive quantity.",
      );
      return;
    }

    if (
      movementType === "adjustment"
    ) {
      quantityChange =
        enteredQuantity;
    }

    const newQuantity =
      selectedProduct.quantity +
      quantityChange;

    if (newQuantity < 0) {
      setError(
        `This adjustment would make stock negative. Current stock is ${selectedProduct.quantity} ${selectedProduct.unit}.`,
      );
      return;
    }

    const movementReason =
      reason.trim() ||
      (movementType ===
      "received"
        ? "Stock received"
        : "Stock adjustment");

    try {
      adjustProductQuantity(
        selectedProduct.id,
        quantityChange,
      );

      addStockMovement(
        selectedProduct,
        quantityChange,
        movementReason,
        movementType,
      );

      setQuantity("");
      setReason("");

      setSuccess(
        `${selectedProduct.name} stock updated successfully. New quantity: ${newQuantity} ${selectedProduct.unit}.`,
      );

      refreshData();
    } catch (submissionError) {
      setError(
        submissionError instanceof
          Error
          ? submissionError.message
          : "Something went wrong while updating stock.",
      );
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Stock Management
            </h1>

            <p className="mt-2 text-gray-600">
              Receive new stock and make
              stock adjustments.
            </p>
          </div>

          <div className="flex gap-3">
            <a
              href="/"
              className="rounded-lg border border-gray-300 bg-white px-5 py-3 text-center font-medium text-gray-700 hover:bg-gray-50"
            >
              Dashboard
            </a>

            <a
              href="/products"
              className="rounded-lg bg-black px-5 py-3 text-center font-medium text-white hover:bg-gray-800"
            >
              View Products
            </a>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow lg:col-span-1">
            <h2 className="text-xl font-semibold text-gray-900">
              Update Stock
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Add received stock or
              correct an existing
              quantity.
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-6 space-y-4"
            >
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Product
                </label>

                <select
                  value={
                    selectedProductId
                  }
                  onChange={(event) =>
                    setSelectedProductId(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-black"
                >
                  <option value="">
                    Select a product
                  </option>

                  {products.map(
                    (product) => (
                      <option
                        key={product.id}
                        value={product.id}
                      >
                        {product.name} —{" "}
                        {
                          product.quantity
                        }{" "}
                        {
                          product.unit
                        }
                      </option>
                    ),
                  )}
                </select>
              </div>

              {selectedProduct && (
                <div className="rounded-lg bg-gray-100 p-4">
                  <p className="text-sm text-gray-500">
                    Current stock
                  </p>

                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {
                      selectedProduct.quantity
                    }{" "}
                    {
                      selectedProduct.unit
                    }
                  </p>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Movement Type
                </label>

                <select
                  value={
                    movementType
                  }
                  onChange={(event) =>
                    setMovementType(
                      event.target
                        .value as
                        | "received"
                        | "adjustment",
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-black"
                >
                  <option value="received">
                    Receive Stock
                  </option>

                  <option value="adjustment">
                    Stock Adjustment
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Quantity
                </label>

                <input
                  type="number"
                  step="any"
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(
                      event.target.value,
                    )
                  }
                  placeholder={
                    movementType ===
                    "received"
                      ? "Example: 20"
                      : "Example: -2 or 5"
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-black"
                />

                {movementType ===
                  "adjustment" && (
                  <p className="mt-1 text-xs text-gray-500">
                    Use a positive number
                    to add stock or a
                    negative number to
                    remove stock.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Reason
                </label>

                <input
                  type="text"
                  value={reason}
                  onChange={(event) =>
                    setReason(
                      event.target.value,
                    )
                  }
                  placeholder="Example: New delivery"
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-black"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                  {success}
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
              >
                Update Stock
              </button>
            </form>
          </div>

          <div className="rounded-xl bg-white p-6 shadow lg:col-span-2">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Current Stock
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Search and view your
                  inventory quantities.
                </p>
              </div>

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search products..."
                className="rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-black"
              />
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[600px] text-left">
                <thead>
                  <tr className="border-b text-sm text-gray-500">
                    <th className="px-3 py-3">
                      Product
                    </th>

                    <th className="px-3 py-3">
                      Category
                    </th>

                    <th className="px-3 py-3">
                      Barcode
                    </th>

                    <th className="px-3 py-3">
                      Quantity
                    </th>

                    <th className="px-3 py-3">
                      Unit
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map(
                    (product) => (
                      <tr
                        key={product.id}
                        className="border-b last:border-b-0"
                      >
                        <td className="px-3 py-4 font-medium text-gray-900">
                          {
                            product.name
                          }
                        </td>

                        <td className="px-3 py-4 text-gray-600">
                          {
                            product.category
                          }
                        </td>

                        <td className="px-3 py-4 text-gray-600">
                          {product.barcode ||
                            "—"}
                        </td>

                        <td className="px-3 py-4 font-semibold text-gray-900">
                          {
                            product.quantity
                          }
                        </td>

                        <td className="px-3 py-4 text-gray-600">
                          {
                            product.unit
                          }
                        </td>
                      </tr>
                    ),
                  )}

                  {filteredProducts.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-8 text-center text-gray-500"
                      >
                        No products found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold text-gray-900">
            Stock Movement History
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Every stock change is
            recorded here.
          </p>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left">
              <thead>
                <tr className="border-b text-sm text-gray-500">
                  <th className="px-3 py-3">
                    Date
                  </th>

                  <th className="px-3 py-3">
                    Product
                  </th>

                  <th className="px-3 py-3">
                    Type
                  </th>

                  <th className="px-3 py-3">
                    Quantity Change
                  </th>

                  <th className="px-3 py-3">
                    Reason
                  </th>
                </tr>
              </thead>

              <tbody>
                {movements.map(
                  (movement) => (
                    <tr
                      key={movement.id}
                      className="border-b last:border-b-0"
                    >
                      <td className="px-3 py-4 text-gray-600">
                        {new Date(
                          movement.createdAt,
                        ).toLocaleString()}
                      </td>

                      <td className="px-3 py-4 font-medium text-gray-900">
                        {
                          movement.productName
                        }
                      </td>

                      <td className="px-3 py-4 capitalize text-gray-600">
                        {
                          movement.type
                        }
                      </td>

                      <td className="px-3 py-4 font-semibold">
                        {movement.quantityChange >
                        0
                          ? "+"
                          : ""}
                        {
                          movement.quantityChange
                        }
                      </td>

                      <td className="px-3 py-4 text-gray-600">
                        {
                          movement.reason
                        }
                      </td>
                    </tr>
                  ),
                )}

                {movements.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-8 text-center text-gray-500"
                    >
                      No stock movements
                      yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function StockPage() {
  return (
    <PermissionGuard permission="stock.view">
      <StockContent />
    </PermissionGuard>
  );
}