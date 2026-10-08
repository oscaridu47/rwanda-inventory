"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import BarcodeScanner from "@/app/components/BarcodeScanner";
import PermissionGuard from "@/app/components/PermissionGuard";

import {
  hydrateCurrentUser,
  type User,
} from "@/app/lib/auth";

import { supabase } from "@/app/lib/supabase";

type PaymentMethod =
  | "cash"
  | "mobile_money"
  | "card"
  | "credit"
  | "other";

type Product = {
  id: string;
  businessId: string;
  name: string;
  barcode: string;
  category: string;
  quantity: number;
  unit: string;
  buyingPrice: number;
  sellingPrice: number;
};

type PackagingConfig = {
  productId: string;
  baseUnit: string;
  factors: Record<string, number>;
};

type DatabaseProduct = {
  id: string;
  business_id: string;
  name: string;
  barcode: string | null;
  category: string | null;
  quantity: number | string;
  unit: string;
  buying_price: number | string;
  selling_price: number | string;
};

type DatabasePackagingConfig = {
  product_id: string;
  base_unit: string;
  factors: unknown;
};

type CartItem = {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  buyingPrice: number;
  total: number;
};

function mapProduct(
  row: DatabaseProduct,
): Product {
  return {
    id: row.id,
    businessId: row.business_id,
    name: row.name,
    barcode: row.barcode ?? "",
    category: row.category ?? "",
    quantity: Number(row.quantity),
    unit: row.unit,
    buyingPrice: Number(
      row.buying_price,
    ),
    sellingPrice: Number(
      row.selling_price,
    ),
  };
}

function normalizePackagingFactors(
  value: unknown,
): Record<string, number> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  const result: Record<
    string,
    number
  > = {};

  for (const [
    key,
    rawValue,
  ] of Object.entries(
    value as Record<
      string,
      unknown
    >,
  )) {
    const numericValue =
      Number(rawValue);

    if (
      Number.isFinite(
        numericValue,
      ) &&
      numericValue > 0
    ) {
      result[key] =
        numericValue;
    }
  }

  return result;
}

function mapPackagingConfig(
  row: DatabasePackagingConfig,
): PackagingConfig {
  return {
    productId:
      row.product_id,
    baseUnit:
      row.base_unit,
    factors:
      normalizePackagingFactors(
        row.factors,
      ),
  };
}

function formatRwf(
  value: number,
) {
  return new Intl.NumberFormat(
    "en-RW",
  ).format(value);
}

function formatQuantity(
  value: number,
) {
  if (Number.isInteger(value)) {
    return value.toString();
  }

  return value
    .toFixed(3)
    .replace(/0+$/, "")
    .replace(/\.$/, "");
}

function unitAllowsFraction(
  unit: string,
) {
  return (
    unit === "Kg" ||
    unit === "Litre"
  );
}

const paymentMethods: {
  value: PaymentMethod;
  label: string;
}[] = [
  {
    value: "cash",
    label: "Cash",
  },
  {
    value: "mobile_money",
    label: "Mobile Money",
  },
  {
    value: "card",
    label: "Card",
  },
  {
    value: "credit",
    label: "Credit",
  },
  {
    value: "other",
    label: "Other",
  },
];

function RecordSaleContent() {
  const [user, setUser] =
    useState<User | null>(null);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [
    packagingConfigs,
    setPackagingConfigs,
  ] = useState<
    Record<
      string,
      PackagingConfig
    >
  >({});

  const [
    businessName,
    setBusinessName,
  ] = useState("");

  const [businessId, setBusinessId] =
    useState("");

  const [
    businessStatus,
    setBusinessStatus,
  ] = useState("");

  const [
    selectedProductId,
    setSelectedProductId,
  ] = useState("");

  const [
    selectedUnit,
    setSelectedUnit,
  ] = useState("");

  const [quantity, setQuantity] =
    useState("1");

  const [cart, setCart] =
    useState<CartItem[]>([]);

  const [
    customerName,
    setCustomerName,
  ] = useState("");

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState<PaymentMethod>("cash");

  const [search, setSearch] =
    useState("");

  const [
    scannerOpen,
    setScannerOpen,
  ] = useState(false);

  const [loading, setLoading] =
    useState(true);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  async function loadData() {
    setError("");

    try {
      const currentUser =
        await hydrateCurrentUser();

      if (!currentUser) {
        setLoading(false);
        return;
      }

      if (!currentUser.businessId) {
        setError(
          "Your account is not connected to a business.",
        );
        setLoading(false);
        return;
      }

      setUser(currentUser);

      setBusinessId(
        currentUser.businessId,
      );

      const {
        data: business,
        error: businessError,
      } = await supabase
        .from("businesses")
        .select(
          "id, name, status",
        )
        .eq(
          "id",
          currentUser.businessId,
        )
        .maybeSingle();

      if (businessError) {
        throw new Error(
          businessError.message,
        );
      }

      if (!business) {
        throw new Error(
          "Your business could not be found.",
        );
      }

      setBusinessName(
        business.name,
      );

      setBusinessStatus(
        business.status,
      );

      const {
        data: productRows,
        error: productError,
      } = await supabase
        .from("products")
        .select(
          "id, business_id, name, barcode, category, quantity, unit, buying_price, selling_price",
        )
        .eq(
          "business_id",
          currentUser.businessId,
        )
        .order("name", {
          ascending: true,
        });

      if (productError) {
        throw new Error(
          productError.message,
        );
      }

      setProducts(
        (
          (productRows ??
            []) as DatabaseProduct[]
        ).map(mapProduct),
      );

      /*
       * Load the packaging
       * configuration for this
       * business.
       */
      const {
        data: packagingRows,
        error: packagingError,
      } = await supabase
        .from("packaging_configs")
        .select(
          "product_id, base_unit, factors",
        )
        .eq(
          "business_id",
          currentUser.businessId,
        );

      if (packagingError) {
        throw new Error(
          packagingError.message,
        );
      }

      const packagingMap: Record<
        string,
        PackagingConfig
      > = {};

      (
        packagingRows ?? []
      ).forEach((row) => {
        const config =
          mapPackagingConfig(
            row as DatabasePackagingConfig,
          );

        packagingMap[
          config.productId
        ] = config;
      });

      setPackagingConfigs(
        packagingMap,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load sales data.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const selectedProduct =
    useMemo(
      () =>
        products.find(
          (product) =>
            product.id ===
            selectedProductId,
        ),
      [
        products,
        selectedProductId,
      ],
    );

  const selectedPackaging =
    selectedProduct
      ? packagingConfigs[
          selectedProduct.id
        ]
      : undefined;

  /*
   * Build the units available
   * for the selected product.
   *
   * The base unit is always
   * available.
   *
   * Additional units come from
   * packaging_configs.
   */
  const saleUnits = useMemo(() => {
    if (!selectedProduct) {
      return [];
    }

    const units: {
      unit: string;
      factor: number;
    }[] = [
      {
        unit:
          selectedProduct.unit,
        factor: 1,
      },
    ];

    if (
      selectedPackaging &&
      selectedPackaging.baseUnit ===
        selectedProduct.unit
    ) {
      for (const [
        unit,
        factor,
      ] of Object.entries(
        selectedPackaging.factors,
      )) {
        if (
          unit ===
          selectedProduct.unit
        ) {
          continue;
        }

        if (
          !Number.isFinite(
            factor,
          ) ||
          factor <= 0
        ) {
          continue;
        }

        units.push({
          unit,
          factor,
        });
      }
    }

    return units;
  }, [
    selectedProduct,
    selectedPackaging,
  ]);

  /*
   * Conversion factor from the
   * selected sale unit to the
   * product base unit.
   */
  const selectedConversion =
    useMemo(() => {
      if (!selectedProduct) {
        return 1;
      }

      if (
        selectedUnit ===
        selectedProduct.unit
      ) {
        return 1;
      }

      if (
        !selectedPackaging ||
        selectedPackaging.baseUnit !==
          selectedProduct.unit
      ) {
        return 1;
      }

      const factor =
        selectedPackaging.factors[
          selectedUnit
        ];

      return Number.isFinite(
        factor,
      ) && factor > 0
        ? factor
        : 1;
    }, [
      selectedProduct,
      selectedUnit,
      selectedPackaging,
    ]);

  /*
   * Product stock is stored in
   * the base unit.
   *
   * Convert it to the selected
   * sale unit.
   */
  const availableSaleQuantity =
    selectedProduct
      ? selectedProduct.quantity /
        selectedConversion
      : 0;

  /*
   * Selling price is stored for
   * the base unit.
   *
   * Therefore:
   *
   * package price =
   * base price × conversion factor
   */
  const selectedUnitPrice =
    selectedProduct
      ? selectedProduct.sellingPrice *
        selectedConversion
      : 0;

  const selectedBuyingPrice =
    selectedProduct
      ? selectedProduct.buyingPrice *
        selectedConversion
      : 0;

  const filteredProducts =
    useMemo(() => {
      const text =
        search.trim().toLowerCase();

      if (!text) {
        return products;
      }

      return products.filter(
        (product) =>
          product.name
            .toLowerCase()
            .includes(text) ||
          product.barcode
            .toLowerCase()
            .includes(text) ||
          product.category
            .toLowerCase()
            .includes(text),
      );
    }, [products, search]);

  const total = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum + item.total,
        0,
      ),
    [cart],
  );

  const totalCost = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum +
          item.buyingPrice *
            item.quantity,
        0,
      ),
    [cart],
  );

  const totalProfit =
    total - totalCost;

  function selectProduct(
    product: Product,
  ) {
    setSelectedProductId(
      product.id,
    );

    setSelectedUnit(
      product.unit,
    );

    setQuantity("1");

    setError("");
    setMessage("");
  }

  function addToCart() {
    setError("");
    setMessage("");

    if (!selectedProduct) {
      setError(
        "Please select a product.",
      );
      return;
    }

    if (!selectedUnit) {
      setError(
        "Please select a sale unit.",
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
        "Please enter a valid quantity greater than zero.",
      );
      return;
    }

    if (
      !unitAllowsFraction(
        selectedUnit,
      ) &&
      !Number.isInteger(
        requestedQuantity,
      )
    ) {
      setError(
        `${selectedUnit} must be sold as a whole number.`,
      );
      return;
    }

    /*
     * Make sure the selected unit
     * is configured.
     */
    const validUnit =
      saleUnits.some(
        (item) =>
          item.unit ===
          selectedUnit,
      );

    if (!validUnit) {
      setError(
        `${selectedUnit} is not configured for this product.`,
      );
      return;
    }

    const existingItem =
      cart.find(
        (item) =>
          item.productId ===
            selectedProduct.id &&
          item.unit ===
            selectedUnit,
      );

    const newQuantity =
      existingItem
        ? existingItem.quantity +
          requestedQuantity
        : requestedQuantity;

    if (
      newQuantity >
      availableSaleQuantity
    ) {
      setError(
        `Only ${formatQuantity(
          availableSaleQuantity,
        )} ${selectedUnit} of ${selectedProduct.name} is available.`,
      );
      return;
    }

    const newItem: CartItem = {
      productId:
        selectedProduct.id,

      productName:
        selectedProduct.name,

      quantity:
        newQuantity,

      unit:
        selectedUnit,

      unitPrice:
        selectedUnitPrice,

      buyingPrice:
        selectedBuyingPrice,

      total:
        newQuantity *
        selectedUnitPrice,
    };

    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.productId ===
            selectedProduct.id &&
          item.unit ===
            selectedUnit
            ? newItem
            : item,
        ),
      );
    } else {
      setCart([
        ...cart,
        newItem,
      ]);
    }

    setSelectedProductId("");
    setSelectedUnit("");
    setQuantity("1");
  }

  function updateCartQuantity(
    productId: string,
    unit: string,
    value: string,
  ) {
    const newQuantity =
      Number(value);

    if (
      !Number.isFinite(
        newQuantity,
      ) ||
      newQuantity <= 0
    ) {
      return;
    }

    const product =
      products.find(
        (item) =>
          item.id === productId,
      );

    if (!product) {
      return;
    }

    const config =
      packagingConfigs[
        product.id
      ];

    let conversion = 1;

    if (
      unit !== product.unit &&
      config &&
      config.baseUnit ===
        product.unit
    ) {
      const factor =
        config.factors[unit];

      if (
        Number.isFinite(
          factor,
        ) &&
        factor > 0
      ) {
        conversion = factor;
      }
    }

    const available =
      product.quantity /
      conversion;

    if (
      newQuantity >
      available
    ) {
      setError(
        `Only ${formatQuantity(
          available,
        )} ${unit} of ${product.name} is available.`,
      );
      return;
    }

    setError("");

    const productBaseBuyingPrice =
      product.buyingPrice;

    const productBaseSellingPrice =
      product.sellingPrice;

    const unitPrice =
      productBaseSellingPrice *
      conversion;

    const buyingPrice =
      productBaseBuyingPrice *
      conversion;

    setCart(
      cart.map((item) =>
        item.productId ===
          productId &&
        item.unit === unit
          ? {
              ...item,
              quantity:
                newQuantity,
              unitPrice,
              buyingPrice,
              total:
                newQuantity *
                unitPrice,
            }
          : item,
      ),
    );
  }

  function removeFromCart(
    productId: string,
    unit: string,
  ) {
    setCart(
      cart.filter(
        (item) =>
          !(
            item.productId ===
              productId &&
            item.unit === unit
          ),
      ),
    );
  }

  function handleBarcodeScan(
    barcode: string,
  ) {
    const cleanBarcode =
      barcode.trim();

    if (!cleanBarcode) {
      setError(
        "The scanner did not return a valid barcode.",
      );
      setScannerOpen(false);
      return;
    }

    const product =
      products.find(
        (item) =>
          item.barcode.trim() ===
          cleanBarcode,
      );

    if (!product) {
      setError(
        `No product was found with barcode ${cleanBarcode}.`,
      );
      setScannerOpen(false);
      return;
    }

    selectProduct(product);

    setSearch(product.name);

    setQuantity("1");

    setError("");

    setMessage(
      `${product.name} selected.`,
    );

    setScannerOpen(false);
  }

  async function completeSale() {
    setError("");
    setMessage("");

    if (!user) {
      setError(
        "You are not logged in.",
      );
      return;
    }

    if (!businessId) {
      setError(
        "Your account is not connected to a business.",
      );
      return;
    }

    if (
      businessStatus !==
      "active"
    ) {
      setError(
        "Your business is not active. You cannot record sales yet.",
      );
      return;
    }

    if (cart.length === 0) {
      setError(
        "Add at least one product to the sale.",
      );
      return;
    }

    setSubmitting(true);

    try {
      const items = cart.map(
        (item) => ({
          product_id:
            item.productId,

          quantity:
            item.quantity,

          unit:
            item.unit,

          unit_price:
            item.unitPrice,
        }),
      );

      const {
        data: sale,
        error: saleError,
      } = await supabase.rpc(
        "record_sale",
        {
          p_business_id:
            businessId,

          p_payment_method:
            paymentMethod,

          p_customer_name:
            customerName.trim() ||
            null,

          p_items: items,
        },
      );

      if (saleError) {
        throw new Error(
          saleError.message ||
            "The sale could not be recorded.",
        );
      }

      if (!sale) {
        throw new Error(
          "The sale was not returned by Supabase.",
        );
      }

      setCart([]);
      setSelectedProductId("");
      setSelectedUnit("");
      setQuantity("1");
      setCustomerName("");

      setMessage(
        `Sale recorded successfully. Total: ${formatRwf(
          Number(
            sale.total_amount,
          ),
        )} RWF.`,
      );

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to record the sale.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
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
              {businessName ||
                "RwandaInventory"}
            </p>
          </div>

          <Link
            href="/sales"
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Sales
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            {message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="text-xl font-bold text-gray-900">
              Add Products
            </h2>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  setScannerOpen(
                    true,
                  )
                }
                disabled={
                  scannerOpen
                }
                className="rounded-lg bg-black px-4 py-3 font-medium text-white disabled:opacity-50"
              >
                Scan Barcode
              </button>

              <Link
                href="/products/add"
                className="rounded-lg border border-gray-300 px-4 py-3 font-medium text-gray-700 hover:bg-gray-50"
              >
                Add Product
              </Link>
            </div>

            {scannerOpen && (
              <div className="mt-5">
                <BarcodeScanner
                  onScan={
                    handleBarcodeScan
                  }
                  onClose={() =>
                    setScannerOpen(
                      false,
                    )
                  }
                />
              </div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Product
                </label>

                <select
                  value={
                    selectedProductId
                  }
                  onChange={(event) => {
                    const product =
                      products.find(
                        (item) =>
                          item.id ===
                          event.target
                            .value,
                      );

                    if (product) {
                      selectProduct(
                        product,
                      );
                    } else {
                      setSelectedProductId(
                        "",
                      );
                      setSelectedUnit(
                        "",
                      );
                      setQuantity(
                        "1",
                      );
                    }
                  }}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3"
                >
                  <option value="">
                    Select a product
                  </option>

                  {filteredProducts.map(
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
                        {formatQuantity(
                          product.quantity,
                        )}{" "}
                        {
                          product.unit
                        }
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Sale Unit
                </label>

                <select
                  value={
                    selectedUnit
                  }
                  onChange={(event) => {
                    setSelectedUnit(
                      event.target
                        .value,
                    );
                    setQuantity("1");
                    setError("");
                    setMessage("");
                  }}
                  disabled={
                    !selectedProduct
                  }
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 disabled:bg-gray-100"
                >
                  {!selectedProduct && (
                    <option value="">
                      Select product first
                    </option>
                  )}

                  {saleUnits.map(
                    ({
                      unit,
                      factor,
                    }) => (
                      <option
                        key={unit}
                        value={unit}
                      >
                        {unit}
                        {factor !==
                        1
                          ? ` — 1 ${unit} = ${formatQuantity(
                              factor,
                            )} ${
                              selectedProduct?.unit ??
                              ""
                            }`
                          : ""}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Search Products
              </label>

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target
                      .value,
                  )
                }
                placeholder="Search products..."
                className="w-full rounded-lg border border-gray-300 px-4 py-3"
              />
            </div>

            {selectedProduct && (
              <div className="mt-5 rounded-xl bg-gray-50 p-5">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs text-gray-500">
                      Product
                    </p>

                    <p className="font-semibold">
                      {
                        selectedProduct.name
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Base Stock
                    </p>

                    <p className="font-semibold">
                      {formatQuantity(
                        selectedProduct.quantity,
                      )}{" "}
                      {
                        selectedProduct.unit
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Available
                    </p>

                    <p className="font-semibold">
                      {formatQuantity(
                        availableSaleQuantity,
                      )}{" "}
                      {
                        selectedUnit
                      }
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500">
                      Selling Price
                    </p>

                    <p className="font-semibold">
                      {formatRwf(
                        selectedUnitPrice,
                      )}{" "}
                      RWF /{" "}
                      {
                        selectedUnit
                      }
                    </p>
                  </div>
                </div>

                {selectedConversion !==
                  1 && (
                  <p className="mt-4 text-sm text-gray-600">
                    1{" "}
                    {
                      selectedUnit
                    }{" "}
                    ={" "}
                    {formatQuantity(
                      selectedConversion,
                    )}{" "}
                    {
                      selectedProduct.unit
                    }
                  </p>
                )}

                <p className="mt-2 text-sm text-gray-500">
                  Base buying price:{" "}
                  {formatRwf(
                    selectedProduct.buyingPrice,
                  )}{" "}
                  RWF /{" "}
                  {
                    selectedProduct.unit
                  }
                </p>
              </div>
            )}

            <div className="mt-5">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Quantity
              </label>

              <input
                type="number"
                min="0"
                step={
                  selectedUnit &&
                  unitAllowsFraction(
                    selectedUnit,
                  )
                    ? "any"
                    : "1"
                }
                value={quantity}
                onChange={(event) =>
                  setQuantity(
                    event.target
                      .value,
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3"
              />

              {selectedProduct &&
                selectedUnit && (
                  <p className="mt-2 text-xs text-gray-500">
                    Available:{" "}
                    {formatQuantity(
                      availableSaleQuantity,
                    )}{" "}
                    {
                      selectedUnit
                    }
                  </p>
                )}
            </div>

            <button
              type="button"
              onClick={
                addToCart
              }
              className="mt-5 rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800"
            >
              Add to Sale
            </button>

            <div className="mt-8">
              <h3 className="text-lg font-bold">
                Current Sale
              </h3>

              {cart.length ===
              0 ? (
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
                          Unit
                        </th>

                        <th className="px-3 py-3">
                          Price
                        </th>

                        <th className="px-3 py-3">
                          Quantity
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
                            key={`${item.productId}-${item.unit}`}
                            className="border-b"
                          >
                            <td className="px-3 py-4 font-medium">
                              {
                                item.productName
                              }
                            </td>

                            <td className="px-3 py-4">
                              {
                                item.unit
                              }
                            </td>

                            <td className="px-3 py-4">
                              {formatRwf(
                                item.unitPrice,
                              )}{" "}
                              RWF
                            </td>

                            <td className="px-3 py-4">
                              <input
                                type="number"
                                min="0"
                                step={
                                  unitAllowsFraction(
                                    item.unit,
                                  )
                                    ? "any"
                                    : "1"
                                }
                                value={
                                  item.quantity
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateCartQuantity(
                                    item.productId,
                                    item.unit,
                                    event
                                      .target
                                      .value,
                                  )
                                }
                                className="w-24 rounded-lg border border-gray-300 px-3 py-2"
                              />
                            </td>

                            <td className="px-3 py-4 font-semibold">
                              {formatRwf(
                                item.total,
                              )}{" "}
                              RWF
                            </td>

                            <td className="px-3 py-4">
                              <button
                                type="button"
                                onClick={() =>
                                  removeFromCart(
                                    item.productId,
                                    item.unit,
                                  )
                                }
                                className="text-sm font-medium text-red-600"
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
            <h2 className="text-xl font-bold">
              Sale Summary
            </h2>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Customer Name
                </label>

                <input
                  type="text"
                  value={
                    customerName
                  }
                  onChange={(event) =>
                    setCustomerName(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Optional"
                  className="w-full rounded-lg border border-gray-300 px-3 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Payment Method
                </label>

                <select
                  value={
                    paymentMethod
                  }
                  onChange={(event) =>
                    setPaymentMethod(
                      event.target
                        .value as PaymentMethod,
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-3"
                >
                  {paymentMethods.map(
                    (method) => (
                      <option
                        key={
                          method.value
                        }
                        value={
                          method.value
                        }
                      >
                        {
                          method.label
                        }
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">
                    Items
                  </span>

                  <span className="font-medium">
                    {cart.length}
                  </span>
                </div>

                <div className="mt-3 flex justify-between text-sm">
                  <span className="text-gray-500">
                    Cost
                  </span>

                  <span className="font-medium">
                    {formatRwf(
                      totalCost,
                    )}{" "}
                    RWF
                  </span>
                </div>

                <div className="mt-3 flex justify-between text-sm">
                  <span className="text-gray-500">
                    Gross Profit
                  </span>

                  <span className="font-semibold text-green-700">
                    {formatRwf(
                      totalProfit,
                    )}{" "}
                    RWF
                  </span>
                </div>

                <div className="mt-4 flex justify-between border-t pt-4">
                  <span className="text-lg font-semibold">
                    Total
                  </span>

                  <span className="text-2xl font-bold">
                    {formatRwf(total)}{" "}
                    RWF
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                void completeSale()
              }
              disabled={
                cart.length === 0 ||
                submitting
              }
              className="mt-6 w-full rounded-lg bg-black px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {submitting
                ? "Recording Sale..."
                : "Complete Sale"}
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