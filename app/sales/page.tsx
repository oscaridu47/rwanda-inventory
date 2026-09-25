"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import BarcodeScanner from "../components/BarcodeScanner";
import PermissionGuard from "../components/PermissionGuard";

import {
  adjustProductQuantity,
  getProducts,
  Product,
  subscribeToProducts,
} from "../lib/products";

import {
  createSale,
  getSalesByBusinessId,
  type Sale,
} from "../lib/sales";

import { getCurrentUser } from "../lib/auth";

import {
  getBusinessByOwnerUserId,
} from "../lib/businesses";

function formatRwf(value: number) {
  return new Intl.NumberFormat("en-RW").format(
    value,
  );
}

function SalesContent() {
  const [products, setProducts] =
    useState<Product[]>([]);

  const [sales, setSales] =
    useState<Sale[]>([]);

  const [selectedProductId, setSelectedProductId] =
    useState("");

  const [quantity, setQuantity] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [scannerOpen, setScannerOpen] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  function refreshData() {
    const savedProducts =
      getProducts();

    setProducts(savedProducts);

    const currentUser =
      getCurrentUser();

    if (!currentUser) {
      setSales([]);
      return;
    }

    const business =
      getBusinessByOwnerUserId(
        currentUser.id,
      );

    if (!business) {
      setSales([]);
      return;
    }

    setSales(
      getSalesByBusinessId(
        business.id,
      ),
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

    return () => {
      unsubscribeProducts();
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
        search
          .trim()
          .toLowerCase();

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

  const enteredQuantity =
    Number(quantity);

  const saleTotal =
    selectedProduct &&
    Number.isFinite(
      enteredQuantity,
    ) &&
    enteredQuantity > 0
      ? enteredQuantity *
        selectedProduct.sellingPrice
      : 0;

  function handleBarcodeScan(
    scannedBarcode: string,
  ) {
    const cleanBarcode =
      String(
        scannedBarcode ?? "",
      ).trim();

    if (!cleanBarcode) {
      setError(
        "The scanner did not return a valid barcode. Please try scanning again.",
      );

      setSuccess("");
      setScannerOpen(false);

      return;
    }

    const foundProduct =
      products.find(
        (product) => {
          const productBarcode =
            String(
              product.barcode ?? "",
            ).trim();

          return (
            productBarcode.length > 0 &&
            productBarcode ===
              cleanBarcode
          );
        },
      );

    if (!foundProduct) {
      setError(
        `No product was found with barcode ${cleanBarcode}. Please add this barcode to a product first.`,
      );

      setSuccess("");
      setScannerOpen(false);

      return;
    }

    setSelectedProductId(
      foundProduct.id,
    );

    setSearch(
      foundProduct.name,
    );

    setQuantity("");

    setError("");

    setSuccess(
      `${foundProduct.name} found and selected automatically.`,
    );

    setScannerOpen(false);
  }

  function openBarcodeScanner() {
    setError("");
    setSuccess("");
    setScannerOpen(true);
  }

  function closeBarcodeScanner() {
    setScannerOpen(false);
  }

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

    if (
      !Number.isFinite(
        enteredQuantity,
      ) ||
      enteredQuantity <= 0
    ) {
      setError(
        "Enter a valid quantity greater than zero.",
      );

      return;
    }

    if (
      enteredQuantity >
      selectedProduct.quantity
    ) {
      setError(
        `Not enough stock. ${selectedProduct.name} currently has ${selectedProduct.quantity} ${selectedProduct.unit} available.`,
      );

      return;
    }

    const currentUser =
      getCurrentUser();

    if (!currentUser) {
      setError(
        "You are not logged in.",
      );

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

    if (
      business.status !==
      "active"
    ) {
      setError(
        "Your business is not active. You cannot record sales yet.",
      );

      return;
    }

    const saleItem = {
      productId:
        selectedProduct.id,

      productName:
        selectedProduct.name,

      quantity:
        enteredQuantity,

      unit:
        selectedProduct.unit,

      unitPrice:
        selectedProduct.sellingPrice,

      total:
        enteredQuantity *
        selectedProduct.sellingPrice,
    };

    try {
      const sale =
        createSale({
          businessId:
            business.id,

          items: [saleItem],
        });

      if (!sale) {
        setError(
          "The sale could not be recorded.",
        );

        return;
      }

      adjustProductQuantity(
        selectedProduct.id,
        -enteredQuantity,
      );

      setQuantity("");

      setSuccess(
        `Sale recorded successfully. ${enteredQuantity} ${selectedProduct.unit} of ${selectedProduct.name} sold for ${formatRwf(sale.total)} RWF.`,
      );

      refreshData();
    } catch (submissionError) {
      setError(
        submissionError instanceof
          Error
          ? submissionError.message
          : "Something went wrong while recording the sale.",
      );
    }
  }

  const totalSalesValue =
    sales.reduce(
      (sum, sale) =>
        sum + sale.total,
      0,
    );

  const todaySalesValue =
    sales
      .filter((sale) => {
        const saleDate =
          new Date(
            sale.createdAt,
          );

        const today =
          new Date();

        return (
          saleDate.getFullYear() ===
            today.getFullYear() &&
          saleDate.getMonth() ===
            today.getMonth() &&
          saleDate.getDate() ===
            today.getDate()
        );
      })
      .reduce(
        (sum, sale) =>
          sum + sale.total,
        0,
      );

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Sales
            </h1>

            <p className="mt-2 text-gray-600">
              Record sales and automatically
              reduce inventory.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="/"
              className="rounded-lg border border-gray-300 bg-white px-5 py-3 text-center font-medium text-gray-900 hover:bg-gray-50"
            >
              Dashboard
            </a>

            <a
              href="/sales/new"
              className="rounded-lg bg-black px-5 py-3 text-center font-medium text-white hover:bg-gray-800"
            >
              New Sale
            </a>

            <a
              href="/products"
              className="rounded-lg bg-white px-5 py-3 text-center font-medium text-gray-900 shadow hover:bg-gray-50"
            >
              Products
            </a>

            <a
              href="/stock"
              className="rounded-lg bg-white px-5 py-3 text-center font-medium text-gray-900 shadow hover:bg-gray-50"
            >
              Stock
            </a>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-gray-500">
              Today&apos;s Sales
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {formatRwf(
                todaySalesValue,
              )}{" "}
              RWF
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-gray-500">
              Total Sales
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {formatRwf(
                totalSalesValue,
              )}{" "}
              RWF
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-gray-500">
              Transactions
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {sales.length}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-xl bg-white p-6 shadow">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Barcode Sale
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Scan a product barcode to
                select it automatically.
              </p>
            </div>

            {!scannerOpen && (
              <button
                type="button"
                onClick={
                  openBarcodeScanner
                }
                className="rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
              >
                Scan Barcode
              </button>
            )}
          </div>

          {scannerOpen && (
            <div className="mt-6">
              <BarcodeScanner
                onScan={
                  handleBarcodeScan
                }
                onClose={
                  closeBarcodeScanner
                }
              />
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow lg:col-span-1">
            <h2 className="text-xl font-semibold text-gray-900">
              Record Sale
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Choose a product and enter
              the quantity sold.
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
                  onChange={(event) => {
                    setSelectedProductId(
                      event.target.value,
                    );

                    setQuantity("");

                    setError("");
                    setSuccess("");
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-black"
                >
                  <option value="">
                    Select a product
                  </option>

                  {products.map(
                    (product) => (
                      <option
                        key={
                          product.id
                        }
                        value={
                          product.id
                        }
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

                  <p className="mt-3 text-sm text-gray-500">
                    Barcode
                  </p>

                  <p className="mt-1 break-all text-sm font-semibold text-gray-900">
                    {selectedProduct.barcode ||
                      "No barcode"}
                  </p>

                  <p className="mt-3 text-sm text-gray-500">
                    Selling price
                  </p>

                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {formatRwf(
                      selectedProduct.sellingPrice,
                    )}{" "}
                    RWF /{" "}
                    {
                      selectedProduct.unit
                    }
                  </p>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Quantity Sold
                </label>

                <input
                  type="number"
                  min="0"
                  step="any"
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(
                      event.target.value,
                    )
                  }
                  placeholder="Example: 2"
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 outline-none focus:border-black"
                />
              </div>

              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    Sale Total
                  </span>

                  <span className="text-xl font-bold text-gray-900">
                    {formatRwf(
                      saleTotal,
                    )}{" "}
                    RWF
                  </span>
                </div>
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
                Record Sale
              </button>
            </form>
          </div>

          <div className="rounded-xl bg-white p-6 shadow lg:col-span-2">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Products Available for Sale
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Search your inventory before
                  making a sale.
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
              <table className="w-full min-w-[650px] text-left">
                <thead>
                  <tr className="border-b text-sm text-gray-500">
                    <th className="px-3 py-3">
                      Product
                    </th>

                    <th className="px-3 py-3">
                      Category
                    </th>

                    <th className="px-3 py-3">
                      Stock
                    </th>

                    <th className="px-3 py-3">
                      Selling Price
                    </th>

                    <th className="px-3 py-3">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map(
                    (product) => (
                      <tr
                        key={
                          product.id
                        }
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

                        <td className="px-3 py-4 text-gray-900">
                          {
                            product.quantity
                          }{" "}
                          {
                            product.unit
                          }
                        </td>

                        <td className="px-3 py-4 text-gray-900">
                          {formatRwf(
                            product.sellingPrice,
                          )}{" "}
                          RWF
                        </td>

                        <td className="px-3 py-4">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProductId(
                                product.id,
                              );

                              setQuantity("");

                              setError("");
                              setSuccess("");
                            }}
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50"
                          >
                            Select
                          </button>
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
            Sales History
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Every sale recorded in the system
            appears here.
          </p>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead>
                <tr className="border-b text-sm text-gray-500">
                  <th className="px-3 py-3">
                    Date
                  </th>

                  <th className="px-3 py-3">
                    Sale ID
                  </th>

                  <th className="px-3 py-3">
                    Products
                  </th>

                  <th className="px-3 py-3">
                    Quantity
                  </th>

                  <th className="px-3 py-3">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {sales.map(
                  (sale) => {
                    const totalQuantity =
                      sale.items.reduce(
                        (
                          sum,
                          item,
                        ) =>
                          sum +
                          item.quantity,
                        0,
                      );

                    const productNames =
                      sale.items
                        .map(
                          (item) =>
                            item.productName,
                        )
                        .join(", ");

                    return (
                      <tr
                        key={
                          sale.id
                        }
                        className="border-b last:border-b-0"
                      >
                        <td className="px-3 py-4 text-gray-600">
                          {new Date(
                            sale.createdAt,
                          ).toLocaleString()}
                        </td>

                        <td className="px-3 py-4 text-xs text-gray-500">
                          {sale.id}
                        </td>

                        <td className="px-3 py-4 font-medium text-gray-900">
                          {
                            productNames
                          }
                        </td>

                        <td className="px-3 py-4 text-gray-600">
                          {
                            totalQuantity
                          }
                        </td>

                        <td className="px-3 py-4 font-semibold text-gray-900">
                          {formatRwf(
                            sale.total,
                          )}{" "}
                          RWF
                        </td>
                      </tr>
                    );
                  },
                )}

                {sales.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-8 text-center text-gray-500"
                    >
                      No sales recorded
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

export default function SalesPage() {
  return (
    <PermissionGuard permission="sales.view">
      <SalesContent />
    </PermissionGuard>
  );
}