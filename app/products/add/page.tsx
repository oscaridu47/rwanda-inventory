"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";

import BarcodeScanner from "@/app/components/BarcodeScanner";
import PermissionGuard from "@/app/components/PermissionGuard";

import {
  formatProductStock,
  getPackageUnit,
  getUnitsPerPackage,
  isProductUnit,
  productUnits,
  Product,
  ProductUnit,
} from "@/app/lib/products";

import {
  getCurrentBusinessId,
} from "@/app/lib/auth";

import { supabase } from "@/app/lib/supabase";

function AddProductFallback() {
  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900">
          Add Product
        </h1>

        <p className="mt-2 text-gray-600">
          Loading...
        </p>
      </div>
    </main>
  );
}

function normalizeProductName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeBarcode(value: string) {
  return value.trim();
}

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

function getDatabaseErrorMessage(
  message: string,
): string {
  const lowerMessage =
    message.toLowerCase();

  if (
    lowerMessage.includes("duplicate") ||
    lowerMessage.includes("23505")
  ) {
    return "A product with this barcode already exists in this business.";
  }

  if (
    lowerMessage.includes("permission") ||
    lowerMessage.includes("not authorized") ||
    lowerMessage.includes("forbidden")
  ) {
    return "You do not have permission to perform this action.";
  }

  if (
    lowerMessage.includes("stock") &&
    lowerMessage.includes("negative")
  ) {
    return "The operation would make stock negative.";
  }

  return message;
}

function ProductForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const productId =
    searchParams.get("productId");

  const [products, setProducts] =
    useState<Product[]>([]);

  const [productsLoaded, setProductsLoaded] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [isSaving, setIsSaving] =
    useState(false);

  const [scannerOpen, setScannerOpen] =
    useState(false);

  const [barcode, setBarcode] =
    useState("");

  const [productName, setProductName] =
    useState("");

  const [category, setCategory] =
    useState("");

  const [quantity, setQuantity] =
    useState("");

  const [unit, setUnit] =
    useState<ProductUnit>("Piece");

  const [packageUnit, setPackageUnit] =
    useState<ProductUnit>("Piece");

  const [unitsPerPackage, setUnitsPerPackage] =
    useState("1");

  const [buyingPrice, setBuyingPrice] =
    useState("");

  const [sellingPrice, setSellingPrice] =
    useState("");

  const isEditing =
    Boolean(productId);

  /* =====================================================
     LOAD PRODUCTS
  ===================================================== */

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setProductsLoaded(false);
      setError("");

      const businessId =
        getCurrentBusinessId();

      if (!businessId) {
        if (!cancelled) {
          setProducts([]);
          setError(
            "No business is connected to this account. Please sign in again.",
          );
          setProductsLoaded(true);
        }

        return;
      }

      try {
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

        if (!cancelled) {
          const rows =
            (data ?? []) as ProductRow[];

          setProducts(
            rows.map(mapProductRow),
          );

          setProductsLoaded(true);
        }
      } catch (loadError) {
        if (!cancelled) {
          setProducts([]);

          setError(
            loadError instanceof Error
              ? getDatabaseErrorMessage(
                  loadError.message,
                )
              : "Unable to load products.",
          );

          setProductsLoaded(true);
        }
      }
    }

    void loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  const productToEdit =
    productId
      ? products.find(
          (product) =>
            product.id === productId,
        )
      : undefined;

  /* =====================================================
     LOAD PRODUCT WHEN EDITING
  ===================================================== */

  useEffect(() => {
    if (!productToEdit) {
      if (!productId) {
        setBarcode("");
        setProductName("");
        setCategory("");
        setQuantity("");
        setUnit("Piece");
        setPackageUnit("Piece");
        setUnitsPerPackage("1");
        setBuyingPrice("");
        setSellingPrice("");
      }

      return;
    }

    setBarcode(
      String(
        productToEdit.barcode ?? "",
      ),
    );

    setProductName(
      productToEdit.name,
    );

    setCategory(
      productToEdit.category,
    );

    setQuantity("");

    setUnit(
      productToEdit.unit,
    );

    setPackageUnit(
      getPackageUnit(
        productToEdit,
      ),
    );

    setUnitsPerPackage(
      String(
        getUnitsPerPackage(
          productToEdit,
        ),
      ),
    );

    setBuyingPrice(
      String(
        productToEdit.buyingPrice,
      ),
    );

    setSellingPrice(
      String(
        productToEdit.sellingPrice,
      ),
    );
  }, [
    productToEdit,
    productId,
  ]);

  /* =====================================================
     FIND PRODUCT BY BARCODE
  ===================================================== */

  const barcodeMatch =
    useMemo(() => {
      if (isEditing) {
        return undefined;
      }

      const cleanBarcode =
        normalizeBarcode(barcode);

      if (!cleanBarcode) {
        return undefined;
      }

      return products.find(
        (product) => {
          const existingBarcode =
            normalizeBarcode(
              String(
                product.barcode ?? "",
              ),
            );

          return (
            existingBarcode.length > 0 &&
            existingBarcode ===
              cleanBarcode
          );
        },
      );
    }, [
      barcode,
      products,
      isEditing,
    ]);

  /* =====================================================
     FIND PRODUCTS BY NAME
  ===================================================== */

  const nameMatches =
    useMemo(() => {
      if (isEditing) {
        return [];
      }

      const cleanName =
        normalizeProductName(
          productName,
        );

      if (!cleanName) {
        return [];
      }

      return products.filter(
        (product) =>
          normalizeProductName(
            product.name,
          ) === cleanName,
      );
    }, [
      productName,
      products,
      isEditing,
    ]);

  const duplicateName =
    nameMatches.length > 1;

  const nameMatch =
    nameMatches.length === 1
      ? nameMatches[0]
      : undefined;

  /* =====================================================
     IDENTIFIER CONFLICT
  ===================================================== */

  const identifierConflict =
    useMemo(() => {
      if (
        isEditing ||
        !barcodeMatch ||
        !nameMatch
      ) {
        return false;
      }

      return (
        barcodeMatch.id !==
        nameMatch.id
      );
    }, [
      barcodeMatch,
      nameMatch,
      isEditing,
    ]);

  /* =====================================================
     EXISTING PRODUCT
     
     Barcode gets priority.
     
     If barcode is empty, exact name is used.
  ===================================================== */

  const existingProduct =
    isEditing ||
    identifierConflict
      ? undefined
      : barcodeMatch ??
        nameMatch;

  const isExistingProductMode =
    Boolean(
      existingProduct &&
        !isEditing,
    );

  /* =====================================================
     AUTOMATICALLY FILL EXISTING PRODUCT INFORMATION
  ===================================================== */

  useEffect(() => {
    if (!existingProduct) {
      return;
    }

    setProductName(
      existingProduct.name,
    );

    if (existingProduct.barcode) {
      setBarcode(
        String(
          existingProduct.barcode,
        ),
      );
    }

    setCategory(
      existingProduct.category,
    );

    setUnit(
      existingProduct.unit,
    );

    setPackageUnit(
      getPackageUnit(
        existingProduct,
      ),
    );

    setUnitsPerPackage(
      String(
        getUnitsPerPackage(
          existingProduct,
        ),
      ),
    );

    setBuyingPrice(
      String(
        existingProduct.buyingPrice,
      ),
    );

    setSellingPrice(
      String(
        existingProduct.sellingPrice,
      ),
    );
  }, [existingProduct]);

  /* =====================================================
     BARCODE SCANNER
  ===================================================== */

  function handleBarcodeScan(
    scannedBarcode: string,
  ) {
    const cleanBarcode =
      String(
        scannedBarcode ?? "",
      ).trim();

    if (!cleanBarcode) {
      setError(
        "The scanner did not return a valid barcode. Please try again.",
      );

      setSuccess("");
      setScannerOpen(false);

      return;
    }

    setError("");
    setSuccess("");
    setScannerOpen(false);

    setBarcode(cleanBarcode);

    const foundProduct =
      products.find(
        (product) => {
          const existingBarcode =
            normalizeBarcode(
              String(
                product.barcode ?? "",
              ),
            );

          return (
            existingBarcode.length > 0 &&
            existingBarcode ===
              cleanBarcode
          );
        },
      );

    if (foundProduct) {
      setProductName(
        foundProduct.name,
      );

      setCategory(
        foundProduct.category,
      );

      setUnit(
        foundProduct.unit,
      );

      setPackageUnit(
        getPackageUnit(
          foundProduct,
        ),
      );

      setUnitsPerPackage(
        String(
          getUnitsPerPackage(
            foundProduct,
          ),
        ),
      );

      setBuyingPrice(
        String(
          foundProduct.buyingPrice,
        ),
      );

      setSellingPrice(
        String(
          foundProduct.sellingPrice,
        ),
      );

      setSuccess(
        `${foundProduct.name} recognized. Enter only the quantity you are adding.`,
      );

      return;
    }

    setSuccess(
      `Barcode ${cleanBarcode} is new. Enter the product name and product details.`,
    );
  }

  function openBarcodeScanner() {
    setError("");
    setSuccess("");
    setScannerOpen(true);
  }

  function closeBarcodeScanner() {
    setScannerOpen(false);
  }

  /* =====================================================
     PRODUCT NAME CHANGE
  ===================================================== */

  function handleProductNameChange(
    value: string,
  ) {
    setProductName(value);

    if (isEditing) {
      return;
    }

    setError("");
    setSuccess("");
  }

  /* =====================================================
     BARCODE CHANGE
  ===================================================== */

  function handleBarcodeChange(
    value: string,
  ) {
    setBarcode(value);

    if (isEditing) {
      return;
    }

    setError("");
    setSuccess("");
  }

  /* =====================================================
     SUBMIT
  ===================================================== */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const name =
      productName.trim();

    const cleanBarcode =
      barcode.trim();

    const cleanCategory =
      category.trim();

    const enteredQuantity =
      Number(quantity);

    const enteredBuyingPrice =
      Number(buyingPrice);

    const enteredSellingPrice =
      Number(sellingPrice);

    const enteredUnitsPerPackage =
      Number(unitsPerPackage);

    const businessId =
      getCurrentBusinessId();

    if (!businessId) {
      setError(
        "No business is connected to this account. Please sign in again.",
      );

      return;
    }

    if (!name) {
      setError(
        "Product name is required.",
      );

      return;
    }

    if (identifierConflict) {
      setError(
        `The barcode belongs to "${barcodeMatch?.name}", but the product name belongs to "${nameMatch?.name}". Clear one identifier or use the correct barcode.`,
      );

      return;
    }

    if (
      duplicateName &&
      !barcodeMatch
    ) {
      setError(
        "More than one product has this name. Please scan or enter its barcode so the correct product can be identified.",
      );

      return;
    }

    /* ===================================================
       EXISTING PRODUCT / ADD STOCK

       IMPORTANT:
       This now uses the secure stock RPC.

       It does NOT directly update products.quantity.

       The RPC:
       - checks membership
       - checks stock.receive permission
       - locks the product
       - updates quantity
       - records stock movement
       - prevents negative stock
       =================================================== */

    if (existingProduct) {
      if (
        !Number.isFinite(
          enteredQuantity,
        ) ||
        enteredQuantity <= 0
      ) {
        setError(
          `Enter a quantity greater than 0 in ${getPackageUnit(
            existingProduct,
          )}.`,
        );

        return;
      }

      const stockUnit =
        getPackageUnit(
          existingProduct,
        );

      const conversionFactor =
        stockUnit ===
        existingProduct.unit
          ? 1
          : getUnitsPerPackage(
              existingProduct,
            );

      const baseQuantity =
        enteredQuantity *
        conversionFactor;

      if (
        !Number.isFinite(
          baseQuantity,
        ) ||
        baseQuantity <= 0
      ) {
        setError(
          "The calculated stock quantity is invalid.",
        );

        return;
      }

      setIsSaving(true);

      try {
        const {
          data,
          error: rpcError,
        } = await supabase.rpc(
          "record_stock_movement",
          {
            p_business_id:
              businessId,

            p_product_id:
              existingProduct.id,

            p_quantity_change:
              baseQuantity,

            p_reason:
              `Stock received through Products: ${enteredQuantity} ${stockUnit}`,

            p_movement_type:
              "receive",
          },
        );

        if (rpcError) {
          throw new Error(
            getDatabaseErrorMessage(
              rpcError.message,
            ),
          );
        }

        if (!data) {
          throw new Error(
            "The stock operation returned no result.",
          );
        }

        const rpcResult =
          data as {
            product?: ProductRow;
            movement?: {
              id?: string;
              product_id?: string;
              movement_type?: string;
              quantity?: number | string;
              reason?: string;
              created_at?: string;
            };
          };

        if (!rpcResult.product) {
          throw new Error(
            "The stock operation returned an incomplete product result.",
          );
        }

        if (!rpcResult.movement) {
          throw new Error(
            "The stock operation returned an incomplete movement result.",
          );
        }

        const updatedProduct =
          mapProductRow(
            rpcResult.product,
          );

        const quantityText =
          `${enteredQuantity} ${stockUnit}${
            enteredQuantity === 1
              ? ""
              : "s"
          }`;

        setSuccess(
          `${existingProduct.name}: ${quantityText} added successfully. New stock: ${formatProductStock(
            updatedProduct,
          )}.`,
        );

        setProducts(
          (currentProducts) =>
            currentProducts.map(
              (product) =>
                product.id ===
                updatedProduct.id
                  ? updatedProduct
                  : product,
            ),
        );

        setQuantity("");

        window.setTimeout(() => {
          router.push("/products");
        }, 1000);

        return;
      } catch (saveError) {
        const message =
          saveError instanceof Error
            ? saveError.message
            : "Please try again.";

        setError(
          `Stock could not be added. ${getDatabaseErrorMessage(
            message,
          )}`,
        );

        return;
      } finally {
        setIsSaving(false);
      }
    }

    /* ===================================================
       EDIT MODE

       Existing stock is NEVER changed here.
       =================================================== */

    if (productId) {
      if (!productToEdit) {
        setError(
          "This product no longer exists.",
        );

        return;
      }

      if (!cleanCategory) {
        setError(
          "Category is required.",
        );

        return;
      }

      if (
        !Number.isFinite(
          enteredBuyingPrice,
        ) ||
        !Number.isFinite(
          enteredSellingPrice,
        ) ||
        enteredBuyingPrice < 0 ||
        enteredSellingPrice < 0
      ) {
        setError(
          "Please enter valid prices.",
        );

        return;
      }

      if (
        !Number.isFinite(
          enteredUnitsPerPackage,
        ) ||
        enteredUnitsPerPackage <= 0
      ) {
        setError(
          "Units per package must be greater than 0.",
        );

        return;
      }

      const finalUnitsPerPackage =
        packageUnit ===
        productToEdit.unit
          ? 1
          : enteredUnitsPerPackage;

      setIsSaving(true);

      try {
        const {
          data: updatedRows,
          error: updateError,
        } = await supabase
          .from("products")
          .update({
            name,
            barcode:
              cleanBarcode,
            category:
              cleanCategory,
            quantity:
              productToEdit.quantity,
            unit:
              productToEdit.unit,
            package_unit:
              packageUnit,
            units_per_package:
              finalUnitsPerPackage,
            buying_price:
              enteredBuyingPrice,
            selling_price:
              enteredSellingPrice,
          })
          .eq(
            "id",
            productId,
          )
          .eq(
            "business_id",
            businessId,
          )
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
          .single();

        if (updateError) {
          throw new Error(
            getDatabaseErrorMessage(
              updateError.message,
            ),
          );
        }

        if (!updatedRows) {
          throw new Error(
            "This product could not be updated. Please try again.",
          );
        }

        router.push(
          "/products",
        );

        return;
      } catch (saveError) {
        const message =
          saveError instanceof Error
            ? saveError.message
            : "Please try again.";

        setError(
          `The product could not be updated. ${getDatabaseErrorMessage(
            message,
          )}`,
        );
      } finally {
        setIsSaving(false);
      }

      return;
    }

    /* ===================================================
       NEW PRODUCT
       =================================================== */

    if (!cleanCategory) {
      setError(
        "Category is required for a new product.",
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
        "Initial quantity must be greater than 0.",
      );

      return;
    }

    if (
      !Number.isFinite(
        enteredBuyingPrice,
      ) ||
      !Number.isFinite(
        enteredSellingPrice,
      ) ||
      enteredBuyingPrice < 0 ||
      enteredSellingPrice < 0
    ) {
      setError(
        "Please enter valid buying and selling prices.",
      );

      return;
    }

    if (
      !Number.isFinite(
        enteredUnitsPerPackage,
      ) ||
      enteredUnitsPerPackage <= 0
    ) {
      setError(
        "Units per package must be greater than 0.",
      );

      return;
    }

    const finalUnitsPerPackage =
      packageUnit === unit
        ? 1
        : enteredUnitsPerPackage;

    const baseQuantity =
      packageUnit === unit
        ? enteredQuantity
        : enteredQuantity *
          finalUnitsPerPackage;

    if (
      !Number.isFinite(
        baseQuantity,
      ) ||
      baseQuantity <= 0
    ) {
      setError(
        "The calculated stock quantity is invalid.",
      );

      return;
    }

    setIsSaving(true);

    try {
      const {
        data: insertedProduct,
        error: insertError,
      } = await supabase
        .from("products")
        .insert({
          business_id:
            businessId,
          name,
          barcode:
            cleanBarcode,
          category:
            cleanCategory,
          quantity:
            baseQuantity,
          unit,
          package_unit:
            packageUnit,
          units_per_package:
            finalUnitsPerPackage,
          buying_price:
            enteredBuyingPrice,
          selling_price:
            enteredSellingPrice,
        })
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
        .single();

      if (insertError) {
        throw new Error(
          getDatabaseErrorMessage(
            insertError.message,
          ),
        );
      }

      if (!insertedProduct) {
        throw new Error(
          "The product was created but no product record was returned.",
        );
      }

      /*
       * The product itself is created with its initial quantity.
       *
       * We do not call record_stock_movement here because
       * the product does not yet exist before this INSERT.
       *
       * Initial stock history can be handled separately in
       * the database migration/reconciliation step.
       */

      router.push(
        "/products",
      );
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Please try again.";

      setError(
        `The product could not be saved. ${getDatabaseErrorMessage(
          message,
        )}`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  /* =====================================================
     LOADING
  ===================================================== */

  if (!productsLoaded) {
    return <AddProductFallback />;
  }

  /* =====================================================
     PRODUCT NOT FOUND
  ===================================================== */

  if (
    productId &&
    !productToEdit
  ) {
    return (
      <main className="min-h-screen bg-gray-100 p-6">
        <div className="mx-auto max-w-2xl rounded-xl bg-white p-6 shadow">
          <h1 className="text-2xl font-bold text-gray-900">
            Product not found
          </h1>

          <p className="mt-2 text-gray-600">
            This product may have already
            been deleted.
          </p>

          <Link
            className="mt-4 inline-block rounded-lg bg-black px-5 py-3 text-white"
            href="/products"
          >
            Back to Products
          </Link>
        </div>
      </main>
    );
  }

  /* =====================================================
     EDIT MODE
     ===================================================== */

  const currentEditStock =
    productToEdit
      ? formatProductStock(
          productToEdit,
        )
      : "";

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEditing
                ? "Edit Product"
                : isExistingProductMode
                  ? "Add Stock"
                  : "Add Product"}
            </h1>

            <p className="mt-2 text-gray-600">
              {isEditing
                ? "Update product information without changing its existing stock."
                : isExistingProductMode
                  ? "Product recognized. Enter the quantity you are adding."
                  : "Enter a product name or scan a barcode to get started."}
            </p>
          </div>

          <Link
            href="/"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Dashboard
          </Link>
        </div>

        <form
          className="mt-8 rounded-2xl bg-white p-5 shadow sm:p-7"
          onSubmit={handleSubmit}
        >
          <div className="space-y-6">
            {/* =================================================
               IDENTIFICATION
            ================================================= */}

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-gray-900">
                  Product Identification
                </h2>

                <p className="mt-1 text-sm text-gray-600">
                  You can identify a product using its
                  name or barcode. Barcode is optional.
                </p>
              </div>

              <div>
                <label
                  className="block text-sm font-semibold text-gray-900"
                  htmlFor="name"
                >
                  Product Name
                </label>

                <input
                  className={`mt-2 h-14 w-full rounded-xl border px-4 text-lg outline-none transition focus:border-black focus:ring-2 focus:ring-gray-200 ${
                    isExistingProductMode
                      ? "border-green-300 bg-green-50"
                      : "border-gray-300 bg-white"
                  }`}
                  value={productName}
                  onChange={(event) =>
                    handleProductNameChange(
                      event.target.value,
                    )
                  }
                  id="name"
                  name="name"
                  placeholder="e.g. Coca-Cola 500ml"
                  required
                  readOnly={
                    isExistingProductMode
                  }
                  type="text"
                  autoComplete="off"
                />
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <label
                    className="block text-sm font-semibold text-gray-900"
                    htmlFor="barcode"
                  >
                    Barcode
                    <span className="ml-2 font-normal text-gray-500">
                      Optional
                    </span>
                  </label>

                  {barcode.trim() && (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                      Barcode entered
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                  <input
                    className={`h-16 w-full rounded-xl border px-5 font-mono text-2xl font-bold tracking-wider outline-none transition focus:border-black focus:ring-2 focus:ring-gray-200 sm:h-[72px] ${
                      isExistingProductMode
                        ? "border-green-300 bg-green-50"
                        : "border-gray-300 bg-white"
                    }`}
                    value={barcode}
                    onChange={(event) =>
                      handleBarcodeChange(
                        event.target.value,
                      )
                    }
                    id="barcode"
                    name="barcode"
                    placeholder="Scan or type barcode"
                    readOnly={
                      isExistingProductMode
                    }
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label="Barcode"
                  />

                  {!isEditing &&
                    !isExistingProductMode && (
                      <button
                        type="button"
                        onClick={
                          openBarcodeScanner
                        }
                        className="h-16 shrink-0 rounded-xl bg-black px-7 text-base font-bold text-white shadow-sm transition hover:bg-gray-800 active:scale-[0.98] sm:h-[72px]"
                      >
                        Scan Barcode
                      </button>
                    )}
                </div>

                <p className="mt-2 text-xs text-gray-500">
                  The large field makes the scanned
                  number easier to see and verify.
                  Products without barcodes can still
                  be saved.
                </p>
              </div>

              {scannerOpen && (
                <div className="mt-5 overflow-hidden rounded-2xl border-2 border-gray-300 bg-black p-3">
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

              {isExistingProductMode &&
                existingProduct && (
                  <div className="mt-5 rounded-xl border border-green-300 bg-green-50 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white">
                        ✓
                      </div>

                      <div>
                        <p className="font-bold text-green-900">
                          Existing product recognized
                        </p>

                        <p className="mt-1 text-sm text-green-800">
                          The system already knows
                          this product. You only
                          need to enter the quantity
                          you are adding.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              {identifierConflict && (
                <div className="mt-5 rounded-xl border border-red-300 bg-red-50 p-4">
                  <p className="font-bold text-red-900">
                    Product identification conflict
                  </p>

                  <p className="mt-1 text-sm text-red-800">
                    The barcode belongs to{" "}
                    <strong>
                      {barcodeMatch?.name}
                    </strong>
                    , but the name belongs to{" "}
                    <strong>
                      {nameMatch?.name}
                    </strong>
                    .
                  </p>

                  <p className="mt-2 text-xs text-red-700">
                    Clear one field or enter the
                    correct matching information.
                  </p>
                </div>
              )}

              {duplicateName &&
                !barcodeMatch &&
                !isEditing && (
                  <div className="mt-5 rounded-xl border border-yellow-300 bg-yellow-50 p-4">
                    <p className="font-bold text-yellow-900">
                      Multiple products have this name
                    </p>

                    <p className="mt-1 text-sm text-yellow-800">
                      Please scan or enter the
                      barcode so the system can
                      identify the correct product.
                    </p>
                  </div>
                )}
            </div>

            {/* =================================================
               EXISTING PRODUCT SUMMARY
            ================================================= */}

            {isExistingProductMode &&
              existingProduct && (
                <>
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                    <h2 className="text-lg font-bold text-blue-950">
                      Product Information
                    </h2>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl bg-white/70 p-3">
                        <p className="text-xs font-medium text-blue-700">
                          Product
                        </p>

                        <p className="mt-1 font-bold text-blue-950">
                          {
                            existingProduct.name
                          }
                        </p>
                      </div>

                      <div className="rounded-xl bg-white/70 p-3">
                        <p className="text-xs font-medium text-blue-700">
                          Category
                        </p>

                        <p className="mt-1 font-bold text-blue-950">
                          {
                            existingProduct.category
                          }
                        </p>
                      </div>

                      <div className="rounded-xl bg-white/70 p-3">
                        <p className="text-xs font-medium text-blue-700">
                          Current Stock
                        </p>

                        <p className="mt-1 text-lg font-bold text-blue-950">
                          {formatProductStock(
                            existingProduct,
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white/70 p-3">
                        <p className="text-xs font-medium text-blue-700">
                          Base Unit
                        </p>

                        <p className="mt-1 font-bold text-blue-950">
                          {
                            existingProduct.unit
                          }
                        </p>
                      </div>

                      <div className="rounded-xl bg-white/70 p-3">
                        <p className="text-xs font-medium text-blue-700">
                          Purchase Unit
                        </p>

                        <p className="mt-1 font-bold text-blue-950">
                          {
                            getPackageUnit(
                              existingProduct,
                            )
                          }
                        </p>
                      </div>

                      <div className="rounded-xl bg-white/70 p-3">
                        <p className="text-xs font-medium text-blue-700">
                          Conversion
                        </p>

                        <p className="mt-1 font-bold text-blue-950">
                          1{" "}
                          {
                            getPackageUnit(
                              existingProduct,
                            )
                          }{" "}
                          ={" "}
                          {
                            getUnitsPerPackage(
                              existingProduct,
                            )
                          }{" "}
                          {
                            existingProduct.unit
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border-2 border-black bg-white p-5">
                    <label
                      className="block text-base font-bold text-gray-900"
                      htmlFor="quantity"
                    >
                      Quantity to Add
                    </label>

                    <p className="mt-1 text-sm text-gray-600">
                      Enter the number of{" "}
                      <strong>
                        {
                          getPackageUnit(
                            existingProduct,
                          )
                        }
                      </strong>{" "}
                      you received.
                    </p>

                    <div className="mt-4 flex items-center gap-3">
                      <input
                        className="h-16 w-full rounded-xl border-2 border-gray-300 px-5 text-3xl font-bold outline-none focus:border-black focus:ring-2 focus:ring-gray-200"
                        value={quantity}
                        onChange={(event) =>
                          setQuantity(
                            event.target.value,
                          )
                        }
                        id="quantity"
                        min="0"
                        placeholder="0"
                        step="any"
                        type="number"
                        inputMode="decimal"
                        required
                      />

                      <div className="shrink-0 rounded-xl bg-gray-100 px-5 py-4 text-center">
                        <p className="text-xs text-gray-500">
                          Unit
                        </p>

                        <p className="text-lg font-bold text-gray-900">
                          {
                            getPackageUnit(
                              existingProduct,
                            )
                          }
                        </p>
                      </div>
                    </div>

                    {quantity &&
                      Number(quantity) >
                        0 && (
                        <div className="mt-4 rounded-xl bg-blue-50 p-4">
                          <p className="text-sm text-blue-700">
                            Stock calculation
                          </p>

                          <p className="mt-1 text-xl font-bold text-blue-950">
                            {quantity}{" "}
                            {
                              getPackageUnit(
                                existingProduct,
                              )
                            }{" "}
                            ×{" "}
                            {
                              getUnitsPerPackage(
                                existingProduct,
                              )
                            }{" "}
                            {
                              existingProduct.unit
                            }{" "}
                            ={" "}
                            {Number(
                              quantity,
                            ) *
                              getUnitsPerPackage(
                                existingProduct,
                              )}{" "}
                            {
                              existingProduct.unit
                            }
                          </p>
                        </div>
                      )}
                  </div>
                </>
              )}

            {/* =================================================
               CATEGORY
            ================================================= */}

            {!isExistingProductMode && (
              <div>
                <label
                  className="block text-sm font-semibold text-gray-900"
                  htmlFor="category"
                >
                  Category
                </label>

                <input
                  className="mt-2 h-14 w-full rounded-xl border border-gray-300 px-4 text-lg outline-none focus:border-black focus:ring-2 focus:ring-gray-200"
                  value={category}
                  onChange={(event) =>
                    setCategory(
                      event.target.value,
                    )
                  }
                  id="category"
                  name="category"
                  placeholder="e.g. Drinks"
                  required
                  type="text"
                />
              </div>
            )}

            {/* =================================================
               NEW PRODUCT QUANTITY
            ================================================= */}

            {!isExistingProductMode && (
              <div className="rounded-2xl border border-gray-200 p-5">
                <label
                  className="block text-sm font-semibold text-gray-900"
                  htmlFor="quantity"
                >
                  {isEditing
                    ? "Current Stock"
                    : `Initial Quantity (${packageUnit})`}
                </label>

                {isEditing ? (
                  <div className="mt-3 rounded-xl bg-gray-100 p-4">
                    <p className="text-xs text-gray-500">
                      Existing stock
                    </p>

                    <p className="mt-1 text-2xl font-bold text-gray-900">
                      {currentEditStock}
                    </p>

                    <p className="mt-2 text-xs text-gray-500">
                      Stock is not changed when
                      editing product information.
                      Use Stock Management to receive
                      or adjust stock.
                    </p>
                  </div>
                ) : (
                  <>
                    <input
                      className="mt-2 h-16 w-full rounded-xl border-2 border-gray-300 px-5 text-2xl font-bold outline-none focus:border-black focus:ring-2 focus:ring-gray-200"
                      value={quantity}
                      onChange={(event) =>
                        setQuantity(
                          event.target.value,
                        )
                      }
                      id="quantity"
                      min="0"
                      placeholder="e.g. 2"
                      step="any"
                      type="number"
                      inputMode="decimal"
                      required
                    />

                    <p className="mt-2 text-xs text-gray-500">
                      This is the quantity you
                      receive from the supplier.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* =================================================
               UNIT SETTINGS
            ================================================= */}

            {!isExistingProductMode && (
              <>
                <div>
                  <label
                    className="block text-sm font-semibold text-gray-900"
                    htmlFor="unit"
                  >
                    Base Unit
                  </label>

                  <select
                    className="mt-2 h-14 w-full rounded-xl border border-gray-300 bg-white px-4 text-lg outline-none focus:border-black focus:ring-2 focus:ring-gray-200 disabled:bg-gray-100"
                    value={unit}
                    onChange={(event) =>
                      setUnit(
                        event.target
                          .value as ProductUnit,
                      )
                    }
                    id="unit"
                    disabled={isEditing}
                  >
                    {productUnits.map(
                      (productUnit) => (
                        <option
                          key={productUnit}
                          value={
                            productUnit
                          }
                        >
                          {
                            productUnit
                          }
                        </option>
                      ),
                    )}
                  </select>

                  <p className="mt-2 text-xs text-gray-500">
                    The smallest unit used for
                    inventory calculations.
                    {isEditing &&
                      " The base unit cannot be changed after stock has been created."}
                  </p>
                </div>

                <div>
                  <label
                    className="block text-sm font-semibold text-gray-900"
                    htmlFor="packageUnit"
                  >
                    Purchase / Package Unit
                  </label>

                  <select
                    className="mt-2 h-14 w-full rounded-xl border border-gray-300 bg-white px-4 text-lg outline-none focus:border-black focus:ring-2 focus:ring-gray-200"
                    value={packageUnit}
                    onChange={(event) =>
                      setPackageUnit(
                        event.target
                          .value as ProductUnit,
                      )
                    }
                    id="packageUnit"
                  >
                    {productUnits.map(
                      (productUnit) => (
                        <option
                          key={productUnit}
                          value={
                            productUnit
                          }
                        >
                          {
                            productUnit
                          }
                        </option>
                      ),
                    )}
                  </select>

                  <p className="mt-2 text-xs text-gray-500">
                    The unit you normally receive
                    from your supplier.
                  </p>
                </div>

                <div>
                  <label
                    className="block text-sm font-semibold text-gray-900"
                    htmlFor="unitsPerPackage"
                  >
                    How many {unit}s are in
                    one {packageUnit}?
                  </label>

                  <input
                    className="mt-2 h-14 w-full rounded-xl border border-gray-300 px-4 text-lg outline-none focus:border-black focus:ring-2 focus:ring-gray-200 disabled:bg-gray-100"
                    value={
                      packageUnit === unit
                        ? "1"
                        : unitsPerPackage
                    }
                    onChange={(event) =>
                      setUnitsPerPackage(
                        event.target.value,
                      )
                    }
                    id="unitsPerPackage"
                    min="0.000001"
                    step="any"
                    type="number"
                    disabled={
                      packageUnit === unit
                    }
                    required
                  />

                  {packageUnit !==
                    unit && (
                    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <p className="font-semibold text-blue-900">
                        Conversion
                      </p>

                      <p className="mt-1 text-lg font-bold text-blue-950">
                        1{" "}
                        {packageUnit}{" "}
                        ={" "}
                        {unitsPerPackage ||
                          "0"}{" "}
                        {unit}
                      </p>

                      {Number(
                        quantity,
                      ) > 0 &&
                        Number(
                          unitsPerPackage,
                        ) > 0 && (
                          <p className="mt-2 text-sm text-blue-800">
                            {quantity}{" "}
                            {
                              packageUnit
                            }{" "}
                            ={" "}
                            {Number(
                              quantity,
                            ) *
                              Number(
                                unitsPerPackage,
                              )}{" "}
                            {unit}
                          </p>
                        )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* =================================================
               EDIT WARNING
            ================================================= */}

            {isEditing && (
              <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                <p className="font-semibold text-yellow-900">
                  Editing existing product
                </p>

                <p className="mt-1 text-sm text-yellow-800">
                  Existing stock is protected. Changing
                  product details here will not change
                  the quantity already in inventory.
                </p>
              </div>
            )}

            {/* =================================================
               PRICES
            ================================================= */}

            {!isExistingProductMode && (
              <>
                <div>
                  <label
                    className="block text-sm font-semibold text-gray-900"
                    htmlFor="buyingPrice"
                  >
                    Buying Price (RWF)
                  </label>

                  <input
                    className="mt-2 h-14 w-full rounded-xl border border-gray-300 px-4 text-lg outline-none focus:border-black focus:ring-2 focus:ring-gray-200"
                    value={buyingPrice}
                    onChange={(event) =>
                      setBuyingPrice(
                        event.target.value,
                      )
                    }
                    id="buyingPrice"
                    min="0"
                    placeholder="0"
                    step="any"
                    type="number"
                    required
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-semibold text-gray-900"
                    htmlFor="sellingPrice"
                  >
                    Selling Price (RWF)
                  </label>

                  <input
                    className="mt-2 h-14 w-full rounded-xl border border-gray-300 px-4 text-lg outline-none focus:border-black focus:ring-2 focus:ring-gray-200"
                    value={sellingPrice}
                    onChange={(event) =>
                      setSellingPrice(
                        event.target.value,
                      )
                    }
                    id="sellingPrice"
                    min="0"
                    placeholder="0"
                    step="any"
                    type="number"
                    required
                  />
                </div>
              </>
            )}

            {/* =================================================
               EXISTING PRODUCT PRICES
            ================================================= */}

            {isExistingProductMode &&
              existingProduct && (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-medium text-gray-500">
                    Existing product prices
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">
                        Buying
                      </p>

                      <p className="text-lg font-bold text-gray-900">
                        {
                          existingProduct.buyingPrice
                        }{" "}
                        RWF
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">
                        Selling
                      </p>

                      <p className="text-lg font-bold text-gray-900">
                        {
                          existingProduct.sellingPrice
                        }{" "}
                        RWF
                      </p>
                    </div>
                  </div>
                </div>
              )}

            {/* =================================================
               SUCCESS
            ================================================= */}

            {success && (
              <div
                aria-live="polite"
                className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
              >
                <p className="font-semibold">
                  {success}
                </p>
              </div>
            )}

            {/* =================================================
               ERROR
            ================================================= */}

            {error && (
              <div
                aria-live="polite"
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
              >
                <p className="font-semibold">
                  {error}
                </p>
              </div>
            )}

            {/* =================================================
               BUTTONS
            ================================================= */}

            <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
              <Link
                className="w-full rounded-xl border border-gray-300 px-5 py-4 text-center font-semibold text-gray-700 hover:bg-gray-50"
                href="/products"
              >
                Cancel
              </Link>

              <button
                className="w-full rounded-xl bg-black px-5 py-4 text-base font-bold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-500"
                disabled={
                  isSaving ||
                  identifierConflict ||
                  (duplicateName &&
                    !barcodeMatch)
                }
                type="submit"
              >
                {isSaving
                  ? isEditing
                    ? "Updating..."
                    : isExistingProductMode
                      ? "Adding Stock..."
                      : "Saving..."
                  : isEditing
                    ? "Update Product"
                    : isExistingProductMode
                      ? "Add Stock"
                      : "Save Product"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}

function ProtectedProductForm() {
  return (
    <PermissionGuard permission="products.create">
      <Suspense
        fallback={
          <AddProductFallback />
        }
      >
        <ProductForm />
      </Suspense>
    </PermissionGuard>
  );
}

export default function AddProductPage() {
  return (
    <ProtectedProductForm />
  );
}