"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import PermissionGuard from "../../components/PermissionGuard";
import { getCurrentBusinessId } from "../../lib/auth";

import {
  Product,
  ProductUnit,
  productUnits,
} from "../../lib/products";

import {
  getPackagingConfig,
  getDefaultPackagingConfig,
  PackagingConfig,
  savePackagingConfig,
  loadPackagingConfigsFromSupabase,
  savePackagingConfigToSupabase,
} from "../../lib/packaging";

import { supabase } from "../../lib/supabase";

type ProductRow = {
  id: string;
  business_id: string;
  name: string;
  barcode: string | null;
  category: string | null;
  quantity: number;
  unit: string;
  buying_price: number | null;
  selling_price: number | null;
  created_at: string;
  package_unit: string | null;
  units_per_package: number | null;
};

function mapProduct(
  row: ProductRow,
  businessId: string,
): Product {
  return {
    id: row.id,
    businessId,
    name: row.name,
    barcode: row.barcode ?? "",
    category: row.category ?? "",
    quantity: Number(row.quantity ?? 0),
    unit: row.unit as ProductUnit,
    buyingPrice: Number(row.buying_price ?? 0),
    sellingPrice: Number(row.selling_price ?? 0),
    createdAt: row.created_at,
    packageUnit: row.package_unit
      ? (row.package_unit as ProductUnit)
      : undefined,
    unitsPerPackage:
      row.units_per_package !== null
        ? Number(row.units_per_package)
        : undefined,
  };
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return value % 1 === 0
    ? value.toLocaleString()
    : value.toLocaleString(undefined, {
        maximumFractionDigits: 4,
      });
}

function getInitialFactors(
  product: Product,
): Record<ProductUnit, string> {
  const result = {
    Piece: "",
    Box: "",
    Pack: "",
    Kg: "",
    Litre: "",
  } as Record<ProductUnit, string>;

  const config =
    getPackagingConfig(product.id) ??
    getDefaultPackagingConfig(product);

  for (const unit of productUnits) {
    const value = config.factors?.[unit];

    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value > 0
    ) {
      result[unit] = String(value);
    }
  }

  if (!result[config.baseUnit]) {
    result[config.baseUnit] = "1";
  }

  return result;
}

export default function PackagingSettingsPage() {
  const [businessId, setBusinessId] =
    useState<string | null>(null);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [search, setSearch] =
    useState("");

  const [selectedProductId, setSelectedProductId] =
    useState("");

  const [baseUnit, setBaseUnit] =
    useState<ProductUnit>("Piece");

  const [factors, setFactors] =
    useState<Record<ProductUnit, string>>({
      Piece: "1",
      Box: "",
      Pack: "",
      Kg: "",
      Litre: "",
    });

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const currentBusinessId =
          await getCurrentBusinessId();

        if (!currentBusinessId) {
          throw new Error(
            "No business is currently selected.",
          );
        }

        if (cancelled) {
          return;
        }

        setBusinessId(currentBusinessId);

        const { data, error: productsError } =
          await supabase
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
                buying_price,
                selling_price,
                created_at,
                package_unit,
                units_per_package
              `,
            )
            .eq(
              "business_id",
              currentBusinessId,
            )
            .order("name", {
              ascending: true,
            });

        if (productsError) {
          throw new Error(
            productsError.message ||
              "Failed to load products.",
          );
        }

        const mappedProducts =
          (data ?? []).map((row) =>
            mapProduct(
              row as ProductRow,
              currentBusinessId,
            ),
          );

        if (cancelled) {
          return;
        }

        setProducts(mappedProducts);

        await loadPackagingConfigsFromSupabase(
          currentBusinessId,
        );
      } catch (err) {
        if (cancelled) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load packaging settings.",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedProduct = useMemo(
    () =>
      products.find(
        (product) =>
          product.id === selectedProductId,
      ),
    [products, selectedProductId],
  );

  const filteredProducts = useMemo(() => {
    const cleanSearch =
      search.trim().toLowerCase();

    if (!cleanSearch) {
      return products;
    }

    return products.filter((product) => {
      return (
        product.name
          .toLowerCase()
          .includes(cleanSearch) ||
        product.barcode
          .toLowerCase()
          .includes(cleanSearch) ||
        product.category
          .toLowerCase()
          .includes(cleanSearch)
      );
    });
  }, [products, search]);

  function selectProduct(product: Product) {
    setSelectedProductId(product.id);
    setMessage("");
    setError("");

    const config =
      getPackagingConfig(product.id) ??
      getDefaultPackagingConfig(product);

    setBaseUnit(config.baseUnit);
    setFactors(getInitialFactors(product));
  }

  function updateFactor(
    unit: ProductUnit,
    value: string,
  ) {
    setFactors((current) => ({
      ...current,
      [unit]: value,
    }));
  }

  async function handleSave() {
    setMessage("");
    setError("");

    if (!businessId) {
      setError(
        "No business is currently selected.",
      );
      return;
    }

    if (!selectedProduct) {
      setError(
        "Please select a product first.",
      );
      return;
    }

    const numericFactors: Partial<
      Record<ProductUnit, number>
    > = {};

    for (const unit of productUnits) {
      const rawValue =
        factors[unit]?.trim();

      if (!rawValue) {
        continue;
      }

      const value = Number(rawValue);

      if (
        !Number.isFinite(value) ||
        value <= 0
      ) {
        setError(
          `${unit} conversion factor must be greater than 0.`,
        );
        return;
      }

      numericFactors[unit] = value;
    }

    numericFactors[baseUnit] = 1;

    const config: PackagingConfig = {
      productId: selectedProduct.id,
      baseUnit,
      factors: numericFactors,
      updatedAt: new Date().toISOString(),
    };

    setSaving(true);

    try {
      await savePackagingConfigToSupabase(
        businessId,
        config,
      );

      savePackagingConfig(config);

      setMessage(
        "Packaging configuration saved successfully.",
      );
    } catch (err) {
      savePackagingConfig(config);

      setError(
        `Database save failed, but the configuration was kept locally for offline use. ${
          err instanceof Error
            ? err.message
            : ""
        }`,
      );
    } finally {
      setSaving(false);
    }
  }

  function clearSelection() {
    setSelectedProductId("");
    setMessage("");
    setError("");

    setBaseUnit("Piece");

    setFactors({
      Piece: "1",
      Box: "",
      Pack: "",
      Kg: "",
      Litre: "",
    });
  }

  return (
    <PermissionGuard permission="settings.manage">
      <main className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6">
            <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
              <Link
                href="/business-settings"
                className="hover:text-gray-900"
              >
                Business Settings
              </Link>

              <span>/</span>

              <span className="text-gray-900">
                Packaging
              </span>
            </div>

            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Packaging Settings
                </h1>

                <p className="mt-1 text-sm text-gray-600">
                  Configure packaging and unit
                  conversions for your products.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href="/products"
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Products
                </Link>

                <Link
                  href="/stock"
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Stock
                </Link>

                <Link
                  href="/sales"
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Sales
                </Link>
              </div>
            </div>
          </div>

          {message && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              {message}
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {loading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500">
              Loading packaging settings...
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
              <section className="rounded-xl border border-gray-200 bg-white p-4">
                <h2 className="font-semibold text-gray-900">
                  Products
                </h2>

                <p className="mt-1 mb-4 text-xs text-gray-500">
                  Select a product to configure its
                  packaging.
                </p>

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="Search product or barcode..."
                  className="mb-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                />

                <div className="max-h-[600px] space-y-2 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <div className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">
                      No products found.
                    </div>
                  ) : (
                    filteredProducts.map(
                      (product) => {
                        const isSelected =
                          product.id ===
                          selectedProductId;

                        const config =
                          getPackagingConfig(
                            product.id,
                          );

                        return (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() =>
                              selectProduct(
                                product,
                              )
                            }
                            className={`w-full rounded-lg border p-3 text-left ${
                              isSelected
                                ? "border-gray-900 bg-gray-50"
                                : "border-gray-200 hover:border-gray-400"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate font-medium text-gray-900">
                                  {product.name}
                                </div>

                                {product.barcode && (
                                  <div className="mt-1 truncate text-xs text-gray-500">
                                    {product.barcode}
                                  </div>
                                )}
                              </div>

                              {config && (
                                <span className="shrink-0 rounded-full bg-green-100 px-2 py-1 text-[10px] font-medium text-green-700">
                                  Configured
                                </span>
                              )}
                            </div>

                            <div className="mt-2 text-xs text-gray-500">
                              Stock:{" "}
                              <span className="font-medium text-gray-700">
                                {formatNumber(
                                  product.quantity,
                                )}{" "}
                                {product.unit}
                              </span>
                            </div>
                          </button>
                        );
                      },
                    )
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-gray-200 bg-white p-5">
                {!selectedProduct ? (
                  <div className="flex min-h-[450px] items-center justify-center text-center">
                    <div>
                      <div className="mx-auto mb-4 text-4xl">
                        📦
                      </div>

                      <h2 className="font-semibold text-gray-900">
                        Select a product
                      </h2>

                      <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
                        Choose a product from the list
                        to configure its packaging.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-6 flex flex-col justify-between gap-3 border-b border-gray-200 pb-5 md:flex-row">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">
                          {selectedProduct.name}
                        </h2>

                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                          <span className="rounded-full bg-gray-100 px-2 py-1">
                            Stock:{" "}
                            {formatNumber(
                              selectedProduct.quantity,
                            )}{" "}
                            {selectedProduct.unit}
                          </span>

                          {selectedProduct.barcode && (
                            <span className="rounded-full bg-gray-100 px-2 py-1">
                              Barcode:{" "}
                              {selectedProduct.barcode}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={clearSelection}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="mb-6">
                      <label className="mb-2 block text-sm font-semibold text-gray-900">
                        Base Unit
                      </label>

                      <p className="mb-3 text-xs text-gray-500">
                        The base unit is the inventory
                        unit used for this product.
                      </p>

                      <select
                        value={baseUnit}
                        onChange={(event) => {
                          const unit =
                            event.target
                              .value as ProductUnit;

                          setBaseUnit(unit);

                          setFactors(
                            (current) => ({
                              ...current,
                              [unit]: "1",
                            }),
                          );
                        }}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm md:max-w-sm"
                      >
                        {productUnits.map(
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
                    </div>

                    <div className="mb-6">
                      <h3 className="font-semibold text-gray-900">
                        Conversion Factors
                      </h3>

                      <p className="mt-1 mb-4 text-xs text-gray-500">
                        Enter how many base units are
                        contained in one of each
                        package/unit.
                      </p>

                      <div className="grid gap-4 sm:grid-cols-2">
                        {productUnits.map(
                          (unit) => {
                            const isBase =
                              unit === baseUnit;

                            return (
                              <div
                                key={unit}
                                className="rounded-lg border border-gray-200 p-4"
                              >
                                <label className="mb-2 block text-sm font-medium text-gray-800">
                                  1 {unit}
                                </label>

                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min="0.000001"
                                    step="any"
                                    value={
                                      factors[
                                        unit
                                      ] ?? ""
                                    }
                                    onChange={(event) =>
                                      updateFactor(
                                        unit,
                                        event.target
                                          .value,
                                      )
                                    }
                                    disabled={
                                      isBase
                                    }
                                    className={`w-full rounded-lg border px-3 py-2.5 text-sm ${
                                      isBase
                                        ? "cursor-not-allowed bg-gray-100 text-gray-500"
                                        : "border-gray-300"
                                    }`}
                                    placeholder={
                                      isBase
                                        ? "1"
                                        : "e.g. 12"
                                    }
                                  />

                                  <span className="whitespace-nowrap text-xs text-gray-500">
                                    {baseUnit}
                                  </span>
                                </div>

                                {isBase && (
                                  <p className="mt-2 text-xs text-gray-500">
                                    Base unit is always
                                    equal to 1.
                                  </p>
                                )}
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>

                    <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                      <h3 className="text-sm font-semibold text-blue-900">
                        Example
                      </h3>

                      <p className="mt-1 text-sm text-blue-800">
                        If the base unit is Piece and
                        one Box contains 24 Pieces:
                      </p>

                      <p className="mt-2 font-medium text-blue-900">
                        1 Box = 24 Piece
                      </p>
                    </div>

                    <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-5 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void handleSave()
                        }
                        disabled={saving}
                        className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                      >
                        {saving
                          ? "Saving..."
                          : "Save Packaging"}
                      </button>
                    </div>
                  </>
                )}
              </section>
            </div>
          )}
        </div>
      </main>
    </PermissionGuard>
  );
}