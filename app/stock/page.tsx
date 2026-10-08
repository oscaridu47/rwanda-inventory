"use client";

import Link from "next/link";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import PermissionGuard from "../components/PermissionGuard";

import {
  formatProductStock,
  getPackageUnit,
  getUnitsPerPackage,
  ProductUnit,
  productUnits,
} from "../lib/products";

import {
  getCurrentBusinessId,
  getCurrentUser,
} from "../lib/auth";

import { hasPermission } from "../lib/permissions";

import {
  getStockMovements,
  getStockProducts,
  recordStockMovement,
  StockMovement,
  StockProduct,
} from "../lib/stock";

import {
  loadPackagingConfigsFromSupabase,
  PackagingConfig,
  toBaseQuantity,
  getUnitFactor,
} from "../lib/packaging";

type MovementType =
  | "received"
  | "adjustment";

function StockContent() {
  const [products, setProducts] =
    useState<StockProduct[]>([]);

  const [movements, setMovements] =
    useState<StockMovement[]>([]);

  const [packagingConfigs, setPackagingConfigs] =
    useState<Record<string, PackagingConfig>>({});

  const [selectedProductId, setSelectedProductId] =
    useState("");

  const [movementType, setMovementType] =
    useState<MovementType>("received");

  const [quantity, setQuantity] =
    useState("");

  const [selectedUnit, setSelectedUnit] =
    useState<ProductUnit | "">("");

  const [reason, setReason] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [historyLoading, setHistoryLoading] =
    useState(false);

  const currentUser =
    getCurrentUser();

  const canReceiveStock =
    currentUser
      ? hasPermission(
          currentUser.role,
          "stock.receive",
          currentUser.permissions,
        )
      : false;

  const canAdjustStock =
    currentUser
      ? hasPermission(
          currentUser.role,
          "stock.adjust",
          currentUser.permissions,
        )
      : false;

  const canViewHistory =
    currentUser
      ? hasPermission(
          currentUser.role,
          "stock.history",
          currentUser.permissions,
        )
      : false;

  async function refreshProducts() {
    try {
      const savedProducts =
        await getStockProducts();

      setProducts(savedProducts);

      const businessId =
        getCurrentBusinessId();

      if (businessId) {
        try {
          const savedPackagingConfigs =
            await loadPackagingConfigsFromSupabase(
              businessId,
            );

          const configMap: Record<
            string,
            PackagingConfig
          > = {};

          for (
            const config of
              savedPackagingConfigs
          ) {
            configMap[
              config.productId
            ] = config;
          }

          setPackagingConfigs(
            configMap,
          );
        } catch {
          setPackagingConfigs({});
        }
      }

      setSelectedProductId(
        (currentId) => {
          if (
            currentId &&
            savedProducts.some(
              (product) =>
                product.id ===
                currentId,
            )
          ) {
            return currentId;
          }

          return (
            savedProducts[0]?.id ??
            ""
          );
        },
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load stock.",
      );
    }
  }

  async function refreshHistory() {
    if (!canViewHistory) {
      setMovements([]);
      return;
    }

    setHistoryLoading(true);

    try {
      const savedMovements =
        await getStockMovements();

      setMovements(
        savedMovements,
      );
    } catch (historyError) {
      setMovements([]);

      setError(
        historyError instanceof Error
          ? historyError.message
          : "Unable to load stock history.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  async function refreshData() {
    setError("");
    setLoading(true);

    try {
      await refreshProducts();
      await refreshHistory();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshData();

    function handleFocus() {
      void refreshData();
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
  }, []);

  const selectedProduct =
    products.find(
      (product) =>
        product.id ===
        selectedProductId,
    );

  const selectedPackagingConfig =
    selectedProduct
      ? packagingConfigs[
          selectedProduct.id
        ]
      : undefined;

  /*
   * Determine which units can be used
   * for the selected product.
   *
   * New system:
   * Uses Packaging Settings factors.
   *
   * Old system:
   * Falls back to packageUnit /
   * unitsPerPackage.
   */
  const availableUnits =
    useMemo(() => {
      if (!selectedProduct) {
        return [] as ProductUnit[];
      }

      if (selectedPackagingConfig) {
        const units: ProductUnit[] = [];

        for (
          const unit of productUnits
        ) {
          if (
            unit ===
            selectedPackagingConfig.baseUnit
          ) {
            units.push(unit);
            continue;
          }

          const factor =
            getUnitFactor(
              selectedPackagingConfig,
              unit,
            );

          if (
            factor !== undefined &&
            factor > 0
          ) {
            units.push(unit);
          }
        }

        return units;
      }

      const units: ProductUnit[] = [
        selectedProduct.unit,
      ];

      const packageUnit =
        getPackageUnit(
          selectedProduct as any,
        );

      if (
        packageUnit !==
        selectedProduct.unit
      ) {
        units.push(packageUnit);
      }

      return units;
    }, [
      selectedProduct,
      selectedPackagingConfig,
    ]);

  /*
   * Keep the selected unit valid
   * whenever the product changes.
   */
  useEffect(() => {
    if (!selectedProduct) {
      setSelectedUnit("");
      return;
    }

    const config =
      packagingConfigs[
        selectedProduct.id
      ];

    const defaultUnit =
      config?.baseUnit ??
      getPackageUnit(
        selectedProduct as any,
      );

    setSelectedUnit(
      availableUnits.includes(
        defaultUnit,
      )
        ? defaultUnit
        : availableUnits[0] ??
            selectedProduct.unit,
    );

    setQuantity("");
    setError("");
    setSuccess("");
  }, [
    selectedProductId,
    selectedProduct,
    packagingConfigs,
    availableUnits,
  ]);

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
    }, [
      products,
      search,
    ]);

  /*
   * Convert the entered quantity
   * into the product's base unit.
   */
  function calculateBaseQuantity(
    enteredQuantity: number,
  ): number {
    if (!selectedProduct) {
      throw new Error(
        "Please select a product.",
      );
    }

    const unit =
      selectedUnit ||
      selectedProduct.unit;

    const absoluteQuantity =
      Math.abs(enteredQuantity);

    if (selectedPackagingConfig) {
      return toBaseQuantity(
        selectedPackagingConfig,
        absoluteQuantity,
        unit,
      );
    }

    /*
     * Backward-compatible fallback
     * for products without a saved
     * Packaging Settings configuration.
     */
    if (
      unit !==
      selectedProduct.unit
    ) {
      return (
        absoluteQuantity *
        getUnitsPerPackage(
          selectedProduct as any,
        )
      );
    }

    return absoluteQuantity;
  }

  const quantityPreview =
    useMemo(() => {
      if (
        !selectedProduct ||
        !quantity.trim()
      ) {
        return null;
      }

      const enteredQuantity =
        Number(quantity);

      if (
        !Number.isFinite(
          enteredQuantity,
        ) ||
        enteredQuantity === 0
      ) {
        return null;
      }

      try {
        const baseQuantity =
          calculateBaseQuantity(
            enteredQuantity,
          );

        const signedBaseQuantity =
          movementType ===
          "adjustment"
            ? enteredQuantity < 0
              ? -baseQuantity
              : baseQuantity
            : baseQuantity;

        const newStock =
          selectedProduct.quantity +
          signedBaseQuantity;

        const unit =
          selectedUnit ||
          selectedProduct.unit;

        return {
          baseQuantity:
            signedBaseQuantity,
          newStock,
          unit,
          baseUnit:
            selectedProduct.unit,
        };
      } catch {
        return null;
      }
    }, [
      selectedProduct,
      quantity,
      selectedUnit,
      movementType,
      selectedPackagingConfig,
    ]);

  async function handleSubmit(
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

    if (
      movementType === "received" &&
      !canReceiveStock
    ) {
      setError(
        "You do not have permission to receive stock.",
      );
      return;
    }

    if (
      movementType === "adjustment" &&
      !canAdjustStock
    ) {
      setError(
        "You do not have permission to adjust stock.",
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

    if (
      movementType === "received" &&
      enteredQuantity <= 0
    ) {
      setError(
        "Received stock must be a positive quantity.",
      );
      return;
    }

    let baseQuantity: number;

    try {
      baseQuantity =
        calculateBaseQuantity(
          enteredQuantity,
        );

      if (
        !Number.isFinite(
          baseQuantity,
        ) ||
        baseQuantity <= 0
      ) {
        throw new Error(
          "The selected unit has an invalid conversion factor.",
        );
      }
    } catch (conversionError) {
      setError(
        conversionError instanceof
          Error
          ? conversionError.message
          : "Unable to convert this quantity.",
      );
      return;
    }

    const baseQuantityChange =
      movementType === "adjustment"
        ? enteredQuantity < 0
          ? -baseQuantity
          : baseQuantity
        : baseQuantity;

    const newQuantity =
      selectedProduct.quantity +
      baseQuantityChange;

    if (newQuantity < 0) {
      setError(
        `This adjustment would make stock negative. Current stock is ${formatProductStock(
          selectedProduct as any,
        )}.`,
      );
      return;
    }

    const movementReason =
      reason.trim() ||
      (movementType === "received"
        ? "Stock received"
        : "Stock adjustment");

    setSaving(true);

    try {
      const result =
        await recordStockMovement(
          selectedProduct.id,
          baseQuantityChange,
          movementReason,
          movementType,
        );

      setQuantity("");
      setReason("");

      setSuccess(
        `${selectedProduct.name} updated successfully. New stock: ${formatProductStock(
          result.product as any,
        )}.`,
      );

      /*
       * Refresh from Supabase.
       * The database remains the source
       * of truth.
       */
      await refreshProducts();
      await refreshHistory();
    } catch (submissionError) {
      setError(
        submissionError instanceof
          Error
          ? submissionError.message
          : "Something went wrong while updating stock.",
      );
    } finally {
      setSaving(false);
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
              stock adjustments using
              your product's units.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              href="/"
              className="rounded-lg border border-gray-300 bg-white px-5 py-3 text-center font-medium text-gray-700 hover:bg-gray-50"
            >
              Dashboard
            </Link>

            <Link
              href="/products"
              className="rounded-lg bg-black px-5 py-3 text-center font-medium text-white hover:bg-gray-800"
            >
              View Products
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {/* UPDATE STOCK */}
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
              {/* PRODUCT */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Product
                </label>

                <select
                  value={
                    selectedProductId
                  }
                  onChange={(event) => {
                    setSelectedProductId(
                      event.target.value,
                    );

                    setQuantity("");
                    setError("");
                    setSuccess("");
                  }}
                  disabled={
                    loading ||
                    saving ||
                    products.length ===
                      0
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-black disabled:bg-gray-100"
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

              {/* CURRENT STOCK */}
              {selectedProduct && (
                <div className="rounded-lg bg-gray-100 p-4">
                  <p className="text-sm text-gray-500">
                    Current stock
                  </p>

                  <p className="mt-1 text-2xl font-bold text-gray-900">
                    {formatProductStock(
                      selectedProduct as any,
                    )}
                  </p>

                  {selectedPackagingConfig ? (
                    <p className="mt-2 text-xs text-gray-500">
                      Base unit:{" "}
                      <strong>
                        {
                          selectedPackagingConfig.baseUnit
                        }
                      </strong>
                    </p>
                  ) : (
                    selectedProduct.packageUnit !==
                      selectedProduct.unit && (
                      <p className="mt-2 text-xs text-gray-500">
                        1{" "}
                        {
                          selectedProduct.packageUnit
                        }{" "}
                        ={" "}
                        {
                          selectedProduct.unitsPerPackage
                        }{" "}
                        {
                          selectedProduct.unit
                        }
                      </p>
                    )
                  )}
                </div>
              )}

              {/* MOVEMENT TYPE */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Movement Type
                </label>

                <select
                  value={
                    movementType
                  }
                  onChange={(event) => {
                    setMovementType(
                      event.target
                        .value as MovementType,
                    );

                    setQuantity("");
                    setError("");
                    setSuccess("");
                  }}
                  disabled={saving}
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-black disabled:bg-gray-100"
                >
                  <option value="received">
                    Receive Stock
                  </option>

                  <option value="adjustment">
                    Stock Adjustment
                  </option>
                </select>
              </div>

              {/* PERMISSION MESSAGE */}
              {movementType ===
                "received" &&
                !canReceiveStock && (
                  <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
                    Your account does not
                    have permission to
                    receive stock.
                  </div>
                )}

              {movementType ===
                "adjustment" &&
                !canAdjustStock && (
                  <div className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-800">
                    Your account does not
                    have permission to
                    adjust stock.
                  </div>
                )}

              {/* UNIT */}
              {selectedProduct && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Unit
                  </label>

                  <select
                    value={
                      selectedUnit
                    }
                    onChange={(event) => {
                      setSelectedUnit(
                        event.target
                          .value as ProductUnit,
                      );

                      setQuantity("");
                      setError("");
                      setSuccess("");
                    }}
                    disabled={
                      saving ||
                      availableUnits.length ===
                        0
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-black disabled:bg-gray-100"
                  >
                    {availableUnits.map(
                      (unit) => (
                        <option
                          key={unit}
                          value={unit}
                        >
                          {unit}
                        </option>
                      ),
                    )}
                  </select>

                  {selectedPackagingConfig &&
                    selectedUnit && (
                      <div className="mt-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-800">
                        {selectedUnit ===
                        selectedPackagingConfig.baseUnit ? (
                          <p>
                            1{" "}
                            {
                              selectedPackagingConfig.baseUnit
                            }{" "}
                            = 1{" "}
                            {
                              selectedPackagingConfig.baseUnit
                            }
                          </p>
                        ) : (
                          <p>
                            1{" "}
                            {selectedUnit}{" "}
                            ={" "}
                            {getUnitFactor(
                              selectedPackagingConfig,
                              selectedUnit,
                            )}{" "}
                            {
                              selectedPackagingConfig.baseUnit
                            }
                          </p>
                        )}
                      </div>
                    )}
                </div>
              )}

              {/* QUANTITY */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Quantity
                  {selectedUnit
                    ? ` (${selectedUnit})`
                    : ""}
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
                  disabled={
                    saving ||
                    (movementType ===
                      "received" &&
                      !canReceiveStock) ||
                    (movementType ===
                      "adjustment" &&
                      !canAdjustStock)
                  }
                  placeholder={
                    movementType ===
                    "received"
                      ? `Example: 2 ${
                          selectedUnit ??
                          ""
                        }`
                      : `Example: -1 or 2 ${
                          selectedUnit ??
                          ""
                        }`
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-black disabled:bg-gray-100"
                />

                {selectedProduct &&
                  selectedUnit && (
                    <p className="mt-1 text-xs text-gray-500">
                      Enter quantity in{" "}
                      <strong>
                        {selectedUnit}
                      </strong>
                      .
                    </p>
                  )}

                {movementType ===
                  "adjustment" && (
                  <p className="mt-1 text-xs text-gray-500">
                    Positive = add stock.
                    Negative = remove
                    stock.
                  </p>
                )}
              </div>

              {/* CONVERSION PREVIEW */}
              {selectedProduct &&
                quantityPreview && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm font-medium text-blue-900">
                      Stock calculation
                    </p>

                    <div className="mt-2 space-y-1 text-sm text-blue-800">
                      <p>
                        Entered:{" "}
                        <strong>
                          {quantity}{" "}
                          {
                            quantityPreview.unit
                          }
                        </strong>
                      </p>

                      <p>
                        Base-unit change:{" "}
                        <strong>
                          {quantityPreview.baseQuantity >
                          0
                            ? "+"
                            : ""}
                          {
                            quantityPreview.baseQuantity
                          }{" "}
                          {
                            quantityPreview.baseUnit
                          }
                        </strong>
                      </p>

                      <p>
                        New stock:{" "}
                        <strong>
                          {
                            quantityPreview.newStock
                          }{" "}
                          {
                            quantityPreview.baseUnit
                          }
                        </strong>
                      </p>
                    </div>
                  </div>
                )}

              {/* REASON */}
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
                  disabled={
                    saving ||
                    (movementType ===
                      "received" &&
                      !canReceiveStock) ||
                    (movementType ===
                      "adjustment" &&
                      !canAdjustStock)
                  }
                  placeholder="Example: New delivery"
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-black disabled:bg-gray-100"
                />
              </div>

              {/* ERROR */}
              {error && (
                <div
                  aria-live="polite"
                  className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              {/* SUCCESS */}
              {success && (
                <div
                  aria-live="polite"
                  className="rounded-lg bg-green-50 p-3 text-sm text-green-700"
                >
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={
                  saving ||
                  loading ||
                  !selectedProduct ||
                  !selectedUnit ||
                  (movementType ===
                    "received" &&
                    !canReceiveStock) ||
                  (movementType ===
                    "adjustment" &&
                    !canAdjustStock)
                }
                className="w-full rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {saving
                  ? "Updating..."
                  : movementType ===
                    "received"
                    ? "Receive Stock"
                    : "Apply Adjustment"}
              </button>
            </form>
          </div>

          {/* CURRENT STOCK */}
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
              <table className="w-full min-w-[700px] text-left">
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
                      Stock
                    </th>

                    <th className="px-3 py-3">
                      Base Unit
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-8 text-center text-gray-500"
                      >
                        Loading stock...
                      </td>
                    </tr>
                  ) : (
                    <>
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
                              {
                                product.barcode ||
                                "—"
                              }
                            </td>

                            <td className="px-3 py-4 font-semibold text-gray-900">
                              {formatProductStock(
                                product as any,
                              )}
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
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* STOCK HISTORY */}
        <div className="mt-8 rounded-xl bg-white p-6 shadow">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Stock Movement History
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Every stock change is
                recorded in Supabase.
              </p>
            </div>

            {historyLoading && (
              <span className="text-sm text-gray-500">
                Loading history...
              </span>
            )}
          </div>

          {!canViewHistory ? (
            <div className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
              Your account does not
              have permission to view
              stock history.
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[800px] text-left">
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
                    (movement) => {
                      const movementProduct =
                        products.find(
                          (product) =>
                            product.id ===
                            movement.productId,
                        );

                      const movementUnit =
                        movementProduct?.unit ??
                        "Piece";

                      return (
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
                            }{" "}
                            {movementUnit}
                          </td>

                          <td className="px-3 py-4 text-gray-600">
                            {
                              movement.reason
                            }
                          </td>
                        </tr>
                      );
                    },
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
          )}
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