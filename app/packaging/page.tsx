"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  getPackagingConfig,
  getPackagingConfigs,
  getDefaultPackagingConfig,
  PackagingConfig,
  savePackagingConfig,
  subscribeToPackagingConfigs,
} from "../lib/packaging";
import {
  getProducts,
  Product,
  ProductUnit,
  productUnits,
  subscribeToProducts,
} from "../lib/products";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-RW").format(value);
}

export default function PackagingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [configs, setConfigs] = useState<PackagingConfig[]>([]);

  const [selectedProductId, setSelectedProductId] = useState("");

  const [baseUnit, setBaseUnit] =
    useState<ProductUnit>("Piece");

  const [factors, setFactors] = useState<
    Record<ProductUnit, string>
  >({
    Piece: "1",
    Box: "",
    Pack: "",
    Kg: "",
    Litre: "",
  });

  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function loadData() {
    const savedProducts = getProducts();
    const savedConfigs = getPackagingConfigs();

    setProducts(savedProducts);
    setConfigs(savedConfigs);

    setSelectedProductId((currentId) => {
      if (
        currentId &&
        savedProducts.some(
          (product) => product.id === currentId,
        )
      ) {
        return currentId;
      }

      return savedProducts[0]?.id ?? "";
    });
  }

  useEffect(() => {
    loadData();

    const unsubscribeProducts =
      subscribeToProducts(loadData);

    const unsubscribePackaging =
      subscribeToPackagingConfigs(loadData);

    return () => {
      unsubscribeProducts();
      unsubscribePackaging();
    };
  }, []);

  const selectedProduct = products.find(
    (product) => product.id === selectedProductId,
  );

  function loadProductPackaging(product: Product) {
    const existingConfig =
      getPackagingConfig(product.id);

    const config =
      existingConfig ??
      getDefaultPackagingConfig(product);

    const newFactors: Record<
      ProductUnit,
      string
    > = {
      Piece: "",
      Box: "",
      Pack: "",
      Kg: "",
      Litre: "",
    };

    for (const unit of productUnits) {
      const factor = config.factors[unit];

      if (
        typeof factor === "number" &&
        Number.isFinite(factor)
      ) {
        newFactors[unit] = String(factor);
      }
    }

    newFactors[config.baseUnit] = "1";

    setBaseUnit(config.baseUnit);
    setFactors(newFactors);
    setError("");
    setSuccess("");
  }

  useEffect(() => {
    if (selectedProduct) {
      loadProductPackaging(selectedProduct);
    }
  }, [selectedProductId]);

  const filteredProducts = useMemo(() => {
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
        product.category
          .toLowerCase()
          .includes(searchText) ||
        product.barcode
          .toLowerCase()
          .includes(searchText),
    );
  }, [products, search]);

  function handleBaseUnitChange(
    newBaseUnit: ProductUnit,
  ) {
    const previousBaseUnit = baseUnit;

    setBaseUnit(newBaseUnit);

    setFactors((current) => {
      const updated = {
        ...current,
      };

      if (previousBaseUnit !== newBaseUnit) {
        updated[previousBaseUnit] = "";
      }

      updated[newBaseUnit] = "1";

      return updated;
    });

    setError("");
    setSuccess("");
  }

  function handleFactorChange(
    unit: ProductUnit,
    value: string,
  ) {
    setFactors((current) => ({
      ...current,
      [unit]: value,
    }));

    setError("");
    setSuccess("");
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!selectedProduct) {
      setError("Please select a product.");
      return;
    }

    const parsedFactors: Partial<
      Record<ProductUnit, number>
    > = {};

    for (const unit of productUnits) {
      const rawValue = factors[unit].trim();

      if (!rawValue) {
        continue;
      }

      const numericValue = Number(rawValue);

      if (
        !Number.isFinite(numericValue) ||
        numericValue <= 0
      ) {
        setError(
          `${unit} conversion must be a positive number.`,
        );
        return;
      }

      parsedFactors[unit] = numericValue;
    }

    parsedFactors[baseUnit] = 1;

    try {
      const config: PackagingConfig = {
        productId: selectedProduct.id,
        baseUnit,
        factors: parsedFactors,
        updatedAt: new Date().toISOString(),
      };

      savePackagingConfig(config);

      setSuccess(
        `Packaging settings for ${selectedProduct.name} were saved successfully.`,
      );

      loadData();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save packaging settings.",
      );
    }
  }

  const selectedConfig = selectedProduct
    ? getPackagingConfig(selectedProduct.id)
    : null;

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Packaging Settings
            </h1>

            <p className="mt-2 text-gray-600">
              Configure how boxes, packs, pieces and
              other units relate to each other.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="/products"
              className="rounded-lg bg-white px-5 py-3 font-medium text-gray-900 shadow hover:bg-gray-50"
            >
              Products
            </a>

            <a
              href="/stock"
              className="rounded-lg bg-white px-5 py-3 font-medium text-gray-900 shadow hover:bg-gray-50"
            >
              Stock
            </a>

            <a
              href="/sales"
              className="rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
            >
              Sales
            </a>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow lg:col-span-1">
            <h2 className="text-xl font-semibold text-gray-900">
              Products
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Choose the product you want to configure.
            </p>

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search products..."
              className="mt-5 w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-black"
            />

            <div className="mt-4 space-y-2">
              {filteredProducts.map((product) => {
                const hasConfig =
                  configs.some(
                    (config) =>
                      config.productId === product.id,
                  );

                const isSelected =
                  product.id === selectedProductId;

                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => {
                      setSelectedProductId(product.id);
                      loadProductPackaging(product);
                    }}
                    className={`w-full rounded-lg border p-4 text-left transition ${
                      isSelected
                        ? "border-black bg-gray-100"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900">
                          {product.name}
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                          Current stock:{" "}
                          {product.quantity}{" "}
                          {product.unit}
                        </p>
                      </div>

                      {hasConfig && (
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                          Configured
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {filteredProducts.length === 0 && (
                <p className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-500">
                  No products found.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow lg:col-span-2">
            {selectedProduct ? (
              <>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedProduct.name}
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Set the smallest/base unit and define
                    how many base units are contained in
                    each other unit.
                  </p>
                </div>

                <form
                  onSubmit={handleSubmit}
                  className="mt-6"
                >
                  <div className="rounded-lg bg-gray-100 p-4">
                    <p className="text-sm font-medium text-gray-700">
                      Current inventory unit
                    </p>

                    <p className="mt-1 text-xl font-bold text-gray-900">
                      {selectedProduct.quantity}{" "}
                      {selectedProduct.unit}
                    </p>
                  </div>

                  <div className="mt-6">
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Base Unit
                    </label>

                    <select
                      value={baseUnit}
                      onChange={(event) =>
                        handleBaseUnitChange(
                          event.target
                            .value as ProductUnit,
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-black"
                    >
                      {productUnits.map((unit) => (
                        <option
                          key={unit}
                          value={unit}
                        >
                          {unit}
                        </option>
                      ))}
                    </select>

                    <p className="mt-2 text-xs text-gray-500">
                      The base unit should normally be
                      the smallest unit you can count or
                      sell.
                    </p>
                  </div>

                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Conversion Factors
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                      Enter how many base units are inside
                      each unit.
                    </p>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {productUnits.map((unit) => {
                        const isBase =
                          unit === baseUnit;

                        return (
                          <div
                            key={unit}
                            className="rounded-lg border border-gray-200 p-4"
                          >
                            <label className="mb-2 block text-sm font-medium text-gray-700">
                              {unit}
                            </label>

                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={factors[unit]}
                              disabled={isBase}
                              onChange={(event) =>
                                handleFactorChange(
                                  unit,
                                  event.target.value,
                                )
                              }
                              placeholder={
                                isBase
                                  ? "1"
                                  : "Example: 24"
                              }
                              className={`w-full rounded-lg border px-3 py-3 outline-none focus:border-black ${
                                isBase
                                  ? "cursor-not-allowed bg-gray-100 text-gray-500"
                                  : "border-gray-300"
                              }`}
                            />

                            <p className="mt-2 text-xs text-gray-500">
                              {isBase
                                ? `1 ${unit} = 1 ${baseUnit}`
                                : factors[unit]
                                  ? `1 ${unit} = ${factors[unit]} ${baseUnit}`
                                  : `Optional: configure ${unit}`}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <h3 className="font-semibold text-gray-900">
                      Example
                    </h3>

                    <p className="mt-2 text-sm text-gray-700">
                      Suppose the base unit is{" "}
                      <strong>Piece</strong>, one Pack
                      contains <strong>6 Pieces</strong>,
                      and one Box contains{" "}
                      <strong>24 Pieces</strong>.
                    </p>

                    <p className="mt-2 text-sm text-gray-700">
                      Enter:
                    </p>

                    <p className="mt-2 text-sm text-gray-700">
                      Piece = 1
                      <br />
                      Pack = 6
                      <br />
                      Box = 24
                    </p>

                    <p className="mt-2 text-sm text-gray-600">
                      Later, the sales system can use these
                      conversions when selling different
                      packaging levels.
                    </p>
                  </div>

                  {selectedConfig && (
                    <div className="mt-6 rounded-lg bg-gray-50 p-4">
                      <p className="text-sm text-gray-500">
                        Saved base unit
                      </p>

                      <p className="mt-1 font-semibold text-gray-900">
                        {selectedConfig.baseUnit}
                      </p>
                    </div>
                  )}

                  {error && (
                    <div className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="mt-6 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                      {success}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="mt-6 w-full rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
                  >
                    Save Packaging Settings
                  </button>
                </form>
              </>
            ) : (
              <div className="flex min-h-[400px] items-center justify-center text-center">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    No product selected
                  </h2>

                  <p className="mt-2 text-gray-500">
                    Add a product first, then select it
                    here to configure its packaging.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 rounded-xl bg-white p-6 shadow">
          <h2 className="text-xl font-semibold text-gray-900">
            How this will work
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-4">
              <p className="font-semibold text-gray-900">
                Stock
              </p>

              <p className="mt-1 text-sm text-gray-600">
                Inventory can have a known relationship
                between boxes, packs and pieces.
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <p className="font-semibold text-gray-900">
                Sales
              </p>

              <p className="mt-1 text-sm text-gray-600">
                A sale can eventually remove the correct
                number of base units from inventory.
              </p>
            </div>

            <div className="rounded-lg bg-gray-50 p-4">
              <p className="font-semibold text-gray-900">
                Reports
              </p>

              <p className="mt-1 text-sm text-gray-600">
                Stock reports will be able to show
                quantities using the appropriate units.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}