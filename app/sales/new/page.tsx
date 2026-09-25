"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import PermissionGuard from "@/app/components/PermissionGuard";

import {
  getCurrentUser,
  type User,
} from "@/app/lib/auth";

import {
  getBusinessByOwnerUserId,
  getBusinessById,
  type Business,
} from "@/app/lib/businesses";

import {
  getProducts,
  adjustProductQuantity,
  subscribeToProducts,
  type Product,
} from "@/app/lib/products";

import {
  createSale,
  type SaleItem,
} from "@/app/lib/sales";

type CartItem = SaleItem;

function RecordSaleContent() {
  const [user, setUser] = useState<User | null>(null);

  const [business, setBusiness] =
    useState<Business | null>(null);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [selectedProductId, setSelectedProductId] =
    useState("");

  const [quantity, setQuantity] =
    useState("1");

  const [cart, setCart] =
    useState<CartItem[]>([]);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  useEffect(() => {
    const currentUser = getCurrentUser();

    if (!currentUser) {
      return;
    }

    setUser(currentUser);

    let currentBusiness: Business | null = null;

    if (currentUser.role === "owner") {
      currentBusiness =
        getBusinessByOwnerUserId(
          currentUser.id,
        );
    } else {
      const storedBusinessId =
        localStorage.getItem(
          "rwanda-inventory-current-business",
        );

      if (storedBusinessId) {
        currentBusiness =
          getBusinessById(
            storedBusinessId,
          );
      }
    }

    setBusiness(currentBusiness);

    function loadProducts() {
      setProducts(getProducts());
    }

    loadProducts();

    const unsubscribe =
      subscribeToProducts(loadProducts);

    return unsubscribe;
  }, []);

  const selectedProduct = useMemo(() => {
    return products.find(
      (product) =>
        product.id === selectedProductId,
    );
  }, [
    products,
    selectedProductId,
  ]);

  function addToCart() {
    setError("");
    setMessage("");

    if (!selectedProduct) {
      setError(
        "Please select a product.",
      );
      return;
    }

    const requestedQuantity =
      Number(quantity);

    if (
      !Number.isFinite(
        requestedQuantity,
      ) ||
      requestedQuantity <= 0
    ) {
      setError(
        "Please enter a valid quantity.",
      );
      return;
    }

    if (
      requestedQuantity >
      selectedProduct.quantity
    ) {
      setError(
        `Only ${selectedProduct.quantity} ${selectedProduct.unit} available in stock.`,
      );
      return;
    }

    const existingItem = cart.find(
      (item) =>
        item.productId ===
        selectedProduct.id,
    );

    const newQuantity =
      existingItem
        ? existingItem.quantity +
          requestedQuantity
        : requestedQuantity;

    if (
      newQuantity >
      selectedProduct.quantity
    ) {
      setError(
        `You cannot sell more than ${selectedProduct.quantity} ${selectedProduct.unit} of ${selectedProduct.name}.`,
      );
      return;
    }

    const sellingPrice =
      selectedProduct.sellingPrice;

    const buyingPrice =
      selectedProduct.buyingPrice;

    const total =
      newQuantity * sellingPrice;

    const profit =
      (sellingPrice - buyingPrice) *
      newQuantity;

    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.productId ===
          selectedProduct.id
            ? {
                ...item,
                quantity:
                  newQuantity,
                unitPrice:
                  sellingPrice,
                buyingPrice:
                  buyingPrice,
                sellingPrice:
                  sellingPrice,
                total:
                  total,
                profit:
                  profit,
              }
            : item,
        ),
      );
    } else {
      const item: CartItem = {
        productId:
          selectedProduct.id,

        productName:
          selectedProduct.name,

        quantity:
          requestedQuantity,

        unit:
          selectedProduct.unit,

        unitPrice:
          sellingPrice,

        buyingPrice:
          buyingPrice,

        sellingPrice:
          sellingPrice,

        total:
          requestedQuantity *
          sellingPrice,

        profit:
          (sellingPrice -
            buyingPrice) *
          requestedQuantity,
      };

      setCart([
        ...cart,
        item,
      ]);
    }

    setSelectedProductId("");
    setQuantity("1");
  }

  function removeFromCart(
    productId: string,
  ) {
    setCart(
      cart.filter(
        (item) =>
          item.productId !==
          productId,
      ),
    );
  }

  function updateCartQuantity(
    productId: string,
    newValue: string,
  ) {
    const newQuantity =
      Number(newValue);

    if (
      !Number.isFinite(
        newQuantity,
      ) ||
      newQuantity <= 0
    ) {
      return;
    }

    const product = products.find(
      (item) =>
        item.id === productId,
    );

    if (!product) {
      return;
    }

    if (
      newQuantity >
      product.quantity
    ) {
      setError(
        `Only ${product.quantity} ${product.unit} available for ${product.name}.`,
      );
      return;
    }

    setError("");

    const sellingPrice =
      product.sellingPrice;

    const buyingPrice =
      product.buyingPrice;

    const total =
      newQuantity * sellingPrice;

    const profit =
      (sellingPrice - buyingPrice) *
      newQuantity;

    setCart(
      cart.map((item) =>
        item.productId ===
        productId
          ? {
              ...item,
              quantity:
                newQuantity,
              unitPrice:
                sellingPrice,
              buyingPrice:
                buyingPrice,
              sellingPrice:
                sellingPrice,
              total:
                total,
              profit:
                profit,
            }
          : item,
      ),
    );
  }

  const total = cart.reduce(
    (sum, item) =>
      sum + item.total,
    0,
  );

  const totalProfit = cart.reduce(
    (sum, item) =>
      sum + (item.profit ?? 0),
    0,
  );

  const totalCost = cart.reduce(
    (sum, item) =>
      sum +
      (item.buyingPrice ?? 0) *
        item.quantity,
    0,
  );

  function completeSale() {
    setError("");
    setMessage("");

    if (!user) {
      setError(
        "You are not logged in.",
      );
      return;
    }

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

    if (cart.length === 0) {
      setError(
        "Please add at least one product to the sale.",
      );
      return;
    }

    /*
     * Check stock one more time before
     * completing the sale.
     */
    for (const item of cart) {
      const currentProduct =
        products.find(
          (product) =>
            product.id ===
            item.productId,
        );

      if (!currentProduct) {
        setError(
          `${item.productName} no longer exists.`,
        );
        return;
      }

      if (
        item.quantity >
        currentProduct.quantity
      ) {
        setError(
          `Not enough stock for ${item.productName}. Available: ${currentProduct.quantity} ${currentProduct.unit}.`,
        );
        return;
      }
    }

    const sale = createSale({
      businessId:
        business.id,
      items: cart,
    });

    if (!sale) {
      setError(
        "The sale could not be recorded.",
      );
      return;
    }

    /*
     * Deduct sold quantities from stock.
     */
    for (const item of cart) {
      const currentProduct =
        products.find(
          (product) =>
            product.id ===
            item.productId,
        );

      if (!currentProduct) {
        continue;
      }

      adjustProductQuantity(
        currentProduct.id,
        -item.quantity,
      );
    }

    setCart([]);
    setSelectedProductId("");
    setQuantity("1");

    setMessage(
      `Sale recorded successfully. Total: ${sale.total.toLocaleString()} RWF. Profit: ${sale.profit?.toLocaleString() ?? "0"} RWF`,
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-600">
          Loading...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Record Sale
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              {business
                ? business.businessName
                : "RwandaInventory"}
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

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="text-xl font-bold text-gray-900">
              Add Products
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Select a product and enter the quantity
              being sold.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
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
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
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
                        {product.name} —
                        Stock:{" "}
                        {
                          product.quantity
                        }{" "}
                        {
                          product.unit
                        } —{" "}
                        {product.sellingPrice.toLocaleString()}{" "}
                        RWF
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Quantity
                </label>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
                />
              </div>
            </div>

            {selectedProduct && (
              <div className="mt-4 rounded-xl bg-gray-50 p-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-gray-500">
                      Product
                    </p>

                    <p className="font-semibold text-gray-900">
                      {
                        selectedProduct.name
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Available Stock
                    </p>

                    <p className="font-semibold text-gray-900">
                      {
                        selectedProduct.quantity
                      }{" "}
                      {
                        selectedProduct.unit
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Buying Price
                    </p>

                    <p className="font-semibold text-gray-900">
                      {selectedProduct.buyingPrice.toLocaleString()}{" "}
                      RWF
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Selling Price
                    </p>

                    <p className="font-semibold text-gray-900">
                      {selectedProduct.sellingPrice.toLocaleString()}{" "}
                      RWF
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={addToCart}
              className="mt-5 rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
            >
              Add to Sale
            </button>

            <div className="mt-8">
              <h3 className="text-lg font-bold text-gray-900">
                Current Sale
              </h3>

              {cart.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
                  No products added
                  yet.
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b text-sm text-gray-500">
                        <th className="px-3 py-3">
                          Product
                        </th>

                        <th className="px-3 py-3">
                          Buying
                        </th>

                        <th className="px-3 py-3">
                          Selling
                        </th>

                        <th className="px-3 py-3">
                          Quantity
                        </th>

                        <th className="px-3 py-3">
                          Profit
                        </th>

                        <th className="px-3 py-3">
                          Total
                        </th>

                        <th className="px-3 py-3">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {cart.map(
                        (item) => (
                          <tr
                            key={
                              item.productId
                            }
                            className="border-b"
                          >
                            <td className="px-3 py-4 font-medium text-gray-900">
                              {
                                item.productName
                              }
                            </td>

                            <td className="px-3 py-4">
                              {(
                                item.buyingPrice ??
                                0
                              ).toLocaleString()}{" "}
                              RWF
                            </td>

                            <td className="px-3 py-4">
                              {(
                                item.sellingPrice ??
                                item.unitPrice
                              ).toLocaleString()}{" "}
                              RWF
                            </td>

                            <td className="px-3 py-4">
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={
                                  item.quantity
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateCartQuantity(
                                    item.productId,
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                className="w-24 rounded-lg border border-gray-300 px-3 py-2"
                              />
                            </td>

                            <td className="px-3 py-4 font-semibold text-green-700">
                              {(
                                item.profit ??
                                0
                              ).toLocaleString()}{" "}
                              RWF
                            </td>

                            <td className="px-3 py-4 font-semibold">
                              {item.total.toLocaleString()}{" "}
                              RWF
                            </td>

                            <td className="px-3 py-4">
                              <button
                                type="button"
                                onClick={() =>
                                  removeFromCart(
                                    item.productId,
                                  )
                                }
                                className="text-sm font-medium text-red-600 hover:text-red-800"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <aside className="h-fit rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">
              Sale Summary
            </h2>

            <div className="mt-6 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">
                  Items
                </span>

                <span className="font-medium text-gray-900">
                  {cart.length}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-500">
                  Cost of Goods
                </span>

                <span className="font-medium text-gray-900">
                  {totalCost.toLocaleString()} RWF
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-500">
                  Gross Profit
                </span>

                <span className="font-semibold text-green-700">
                  {totalProfit.toLocaleString()} RWF
                </span>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between">
                  <span className="text-lg font-semibold text-gray-900">
                    Total
                  </span>

                  <span className="text-2xl font-bold text-gray-900">
                    {total.toLocaleString()}{" "}
                    RWF
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={completeSale}
              disabled={
                cart.length === 0
              }
              className="mt-6 w-full rounded-lg bg-black px-5 py-3 font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Complete Sale
            </button>

            <Link
              href="/sales"
              className="mt-3 block w-full rounded-lg border border-gray-300 px-5 py-3 text-center font-medium text-gray-700 hover:bg-gray-50"
            >
              View Sales History
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default function NewSalePage() {
  return (
    <PermissionGuard permission="sales.create">
      <RecordSaleContent />
    </PermissionGuard>
  );
}