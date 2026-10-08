"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

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

type SaleItem = {
  id: string;
  saleId: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  buyingPrice: number;
  totalPrice: number;
};

type Sale = {
  id: string;
  businessId: string;
  userId: string | null;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  customerName: string | null;
  createdAt: string;
  items: SaleItem[];
};

type DatabaseProduct = {
  id: string;
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

type DatabaseSale = {
  id: string;
  business_id: string;
  user_id: string | null;
  total_amount: number | string;
  payment_method: PaymentMethod;
  customer_name: string | null;
  created_at: string;
};

type DatabaseSaleItem = {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number | string;
  unit: string;
  unit_price: number | string;
  buying_price: number | string;
  total_price: number | string;
  created_at: string;
};

function formatRwf(value: number) {
  return new Intl.NumberFormat("en-RW").format(
    value,
  );
}

function mapProduct(
  row: DatabaseProduct,
): Product {
  return {
    id: row.id,
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

function mapSale(
  row: DatabaseSale,
  items: DatabaseSaleItem[],
): Sale {
  return {
    id: row.id,
    businessId: row.business_id,
    userId: row.user_id,
    totalAmount: Number(
      row.total_amount,
    ),
    paymentMethod:
      row.payment_method,
    customerName:
      row.customer_name,
    createdAt:
      row.created_at,
    items: items.map((item) => ({
      id: item.id,
      saleId: item.sale_id,
      productName:
        item.product_name,
      quantity: Number(
        item.quantity,
      ),
      unit: item.unit,
      unitPrice: Number(
        item.unit_price,
      ),
      buyingPrice: Number(
        item.buying_price,
      ),
      totalPrice: Number(
        item.total_price,
      ),
    })),
  };
}

function paymentLabel(
  method: PaymentMethod,
) {
  switch (method) {
    case "mobile_money":
      return "Mobile Money";

    case "cash":
      return "Cash";

    case "card":
      return "Card";

    case "credit":
      return "Credit";

    default:
      return "Other";
  }
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

function SalesContent() {
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

  const [sales, setSales] =
    useState<Sale[]>([]);

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
    useState("");

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

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
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
          "id, name, barcode, category, quantity, unit, buying_price, selling_price",
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

      const mappedProducts = (
        productRows ?? []
      ).map((row) =>
        mapProduct(
          row as DatabaseProduct,
        ),
      );

      setProducts(
        mappedProducts,
      );

      /*
       * Load the new packaging
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

      const {
        data: saleRows,
        error: saleError,
      } = await supabase
        .from("sales")
        .select(
          "id, business_id, user_id, total_amount, payment_method, customer_name, created_at",
        )
        .eq(
          "business_id",
          currentUser.businessId,
        )
        .order(
          "created_at",
          {
            ascending: false,
          },
        );

      if (saleError) {
        throw new Error(
          saleError.message,
        );
      }

      const typedSales =
        (saleRows ?? []) as DatabaseSale[];

      if (typedSales.length === 0) {
        setSales([]);
        setLoading(false);
        return;
      }

      const saleIds =
        typedSales.map(
          (sale) => sale.id,
        );

      const {
        data: itemRows,
        error: itemError,
      } = await supabase
        .from("sale_items")
        .select(
          "id, sale_id, product_id, product_name, quantity, unit, unit_price, buying_price, total_price, created_at",
        )
        .in(
          "sale_id",
          saleIds,
        );

      if (itemError) {
        throw new Error(
          itemError.message,
        );
      }

      const typedItems =
        (itemRows ?? []) as DatabaseSaleItem[];

      setSales(
        typedSales.map((sale) =>
          mapSale(
            sale,
            typedItems.filter(
              (item) =>
                item.sale_id ===
                sale.id,
            ),
          ),
        ),
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
    products.find(
      (product) =>
        product.id ===
        selectedProductId,
    );

  const selectedPackaging =
    selectedProduct
      ? packagingConfigs[
          selectedProduct.id
        ]
      : undefined;

  /*
   * Build the units that can be sold.
   *
   * The base unit is always available.
   *
   * Additional units come from the
   * packaging_configs factors.
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
   * Find the conversion factor
   * for the currently selected
   * sale unit.
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
   * Stock is stored in the
   * product's base unit.
   *
   * Convert it to the selected
   * sale unit for display.
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
   * A package price is therefore:
   *
   * base selling price ×
   * package factor
   */
  const selectedUnitPrice =
    selectedProduct
      ? selectedProduct.sellingPrice *
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

  const enteredQuantity =
    Number(quantity);

  const saleTotal =
    selectedProduct &&
    Number.isFinite(
      enteredQuantity,
    ) &&
    enteredQuantity > 0
      ? enteredQuantity *
        selectedUnitPrice
      : 0;

  function selectProduct(
    product: Product,
  ) {
    setSelectedProductId(
      product.id,
    );

    /*
     * Always start a newly selected
     * product at its base unit.
     */
    setSelectedUnit(
      product.unit,
    );

    setQuantity("");
    setError("");
    setSuccess("");
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

    setSelectedProductId(
      product.id,
    );

    setSelectedUnit(
      product.unit,
    );

    setQuantity("1");
    setSearch(product.name);

    setError("");

    setSuccess(
      `${product.name} selected automatically.`,
    );

    setScannerOpen(false);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

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

    /*
     * Piece, Box and Pack are
     * normally sold as whole units.
     *
     * Kg and Litre can be sold
     * fractionally.
     */
    if (
      !unitAllowsFraction(
        selectedUnit,
      ) &&
      !Number.isInteger(
        enteredQuantity,
      )
    ) {
      setError(
        `${selectedUnit} must be sold as a whole number.`,
      );
      return;
    }

    if (
      enteredQuantity >
      availableSaleQuantity
    ) {
      setError(
        `Insufficient stock. Available: ${formatQuantity(
          availableSaleQuantity,
        )} ${selectedUnit}.`,
      );
      return;
    }

    /*
     * Verify that the selected unit
     * is actually configured for
     * this product.
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

    setSubmitting(true);

    try {
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

          p_items: [
            {
              product_id:
                selectedProduct.id,

              quantity:
                enteredQuantity,

              unit:
                selectedUnit,

              unit_price:
                selectedUnitPrice,
            },
          ],
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

      const soldUnit =
        selectedUnit;

      const soldQuantity =
        enteredQuantity;

      const soldProductName =
        selectedProduct.name;

      setQuantity("");
      setCustomerName("");

      setSuccess(
        `Sale recorded successfully. ${formatQuantity(
          soldQuantity,
        )} ${soldUnit} of ${soldProductName} sold for ${formatRwf(
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

  const totalSalesValue =
    sales.reduce(
      (sum, sale) =>
        sum + sale.totalAmount,
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
          sum +
          sale.totalAmount,
        0,
      );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-gray-600">
          Loading sales...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Sales
            </h1>

            <p className="mt-2 text-gray-600">
              {businessName ||
                "Record and manage business sales."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="/"
              className="rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-900"
            >
              Dashboard
            </a>

            <a
              href="/sales/new"
              className="rounded-lg bg-black px-5 py-3 font-medium text-white"
            >
              New Sale
            </a>

            <a
              href="/products"
              className="rounded-lg bg-white px-5 py-3 font-medium text-gray-900 shadow"
            >
              Products
            </a>

            <a
              href="/stock"
              className="rounded-lg bg-white px-5 py-3 font-medium text-gray-900 shadow"
            >
              Stock
            </a>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {success}
          </div>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-gray-500">
              Today&apos;s Sales
            </p>

            <p className="mt-2 text-3xl font-bold">
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

            <p className="mt-2 text-3xl font-bold">
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

            <p className="mt-2 text-3xl font-bold">
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

            <button
              type="button"
              onClick={() => {
                setError("");
                setSuccess("");
                setScannerOpen(true);
              }}
              disabled={scannerOpen}
              className="rounded-lg bg-black px-5 py-3 font-medium text-white disabled:opacity-50"
            >
              Scan Barcode
            </button>
          </div>

          {scannerOpen && (
            <div className="mt-6">
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
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl bg-white p-6 shadow">
            <h2 className="text-xl font-semibold text-gray-900">
              Record Sale
            </h2>

            <form
              onSubmit={
                handleSubmit
              }
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
                      setQuantity("");
                    }
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-3"
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
                <>
                  <div className="rounded-lg bg-gray-100 p-4">
                    <p className="text-sm text-gray-500">
                      Current stock
                    </p>

                    <p className="mt-1 text-2xl font-bold">
                      {formatQuantity(
                        selectedProduct.quantity,
                      )}{" "}
                      {
                        selectedProduct.unit
                      }
                    </p>

                    {selectedConversion !==
                      1 && (
                      <p className="mt-2 text-sm text-gray-500">
                        Available for sale:{" "}
                        <span className="font-semibold text-gray-700">
                          {formatQuantity(
                            availableSaleQuantity,
                          )}{" "}
                          {
                            selectedUnit
                          }
                        </span>
                      </p>
                    )}

                    <p className="mt-3 text-sm text-gray-500">
                      Base selling price
                    </p>

                    <p className="mt-1 text-lg font-semibold">
                      {formatRwf(
                        selectedProduct.sellingPrice,
                      )}{" "}
                      RWF /{" "}
                      {
                        selectedProduct.unit
                      }
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Sale Unit
                    </label>

                    <select
                      value={
                        selectedUnit
                      }
                      onChange={(
                        event,
                      ) => {
                        setSelectedUnit(
                          event.target
                            .value,
                        );
                        setQuantity("");
                        setError("");
                        setSuccess("");
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-3"
                    >
                      {saleUnits.map(
                        ({
                          unit,
                          factor,
                        }) => (
                          <option
                            key={
                              unit
                            }
                            value={
                              unit
                            }
                          >
                            {unit}
                            {factor !==
                              1
                              ? ` — 1 ${unit} = ${formatQuantity(
                                  factor,
                                )} ${
                                  selectedProduct.unit
                                }`
                              : ""}
                          </option>
                        ),
                      )}
                    </select>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="flex justify-between gap-4">
                      <span className="text-sm text-gray-500">
                        Selling price
                      </span>

                      <span className="font-semibold">
                        {formatRwf(
                          selectedUnitPrice,
                        )}{" "}
                        RWF /{" "}
                        {
                          selectedUnit
                        }
                      </span>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Quantity Sold
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
                  className="w-full rounded-lg border border-gray-300 px-3 py-3"
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

              <div className="rounded-lg border bg-gray-50 p-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">
                    Sale Total
                  </span>

                  <span className="text-xl font-bold">
                    {formatRwf(
                      saleTotal,
                    )}{" "}
                    RWF
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  submitting
                }
                className="w-full rounded-lg bg-black px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {submitting
                  ? "Recording Sale..."
                  : "Record Sale"}
              </button>
            </form>
          </div>

          <div className="rounded-xl bg-white p-6 shadow lg:col-span-2">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Products Available for Sale
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Products are loaded directly
                  from Supabase.
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
                className="rounded-lg border border-gray-300 px-3 py-3"
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
                        className="border-b"
                      >
                        <td className="px-3 py-4 font-medium">
                          {
                            product.name
                          }
                        </td>

                        <td className="px-3 py-4 text-gray-600">
                          {
                            product.category ||
                            "—"
                          }
                        </td>

                        <td className="px-3 py-4">
                          {formatQuantity(
                            product.quantity,
                          )}{" "}
                          {
                            product.unit
                          }
                        </td>

                        <td className="px-3 py-4">
                          {formatRwf(
                            product.sellingPrice,
                          )}{" "}
                          RWF
                        </td>

                        <td className="px-3 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              selectProduct(
                                product,
                              )
                            }
                            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium"
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
          <h2 className="text-xl font-semibold">
            Sales History
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Sales are loaded directly from
            Supabase.
          </p>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left">
              <thead>
                <tr className="border-b text-sm text-gray-500">
                  <th className="px-3 py-3">
                    Date
                  </th>

                  <th className="px-3 py-3">
                    Products
                  </th>

                  <th className="px-3 py-3">
                    Quantity
                  </th>

                  <th className="px-3 py-3">
                    Payment
                  </th>

                  <th className="px-3 py-3">
                    Customer
                  </th>

                  <th className="px-3 py-3">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {sales.map((sale) => {
                  const quantityDisplay =
                    sale.items
                      .map(
                        (item) =>
                          `${formatQuantity(
                            item.quantity,
                          )} ${
                            item.unit
                          }`,
                      )
                      .join(", ");

                  return (
                    <tr
                      key={sale.id}
                      className="border-b"
                    >
                      <td className="px-3 py-4 text-sm text-gray-600">
                        {new Date(
                          sale.createdAt,
                        ).toLocaleString()}
                      </td>

                      <td className="px-3 py-4 font-medium">
                        {sale.items
                          .map(
                            (item) =>
                              item.productName,
                          )
                          .join(", ") ||
                          "—"}
                      </td>

                      <td className="px-3 py-4">
                        {
                          quantityDisplay
                        }
                      </td>

                      <td className="px-3 py-4">
                        {paymentLabel(
                          sale.paymentMethod,
                        )}
                      </td>

                      <td className="px-3 py-4">
                        {sale.customerName ||
                          "Walk-in Customer"}
                      </td>

                      <td className="px-3 py-4 font-semibold">
                        {formatRwf(
                          sale.totalAmount,
                        )}{" "}
                        RWF
                      </td>
                    </tr>
                  );
                })}

                {sales.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={6}
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