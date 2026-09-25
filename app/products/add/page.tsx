"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  Suspense,
  useEffect,
  useState,
} from "react";

import BarcodeScanner from "@/app/components/BarcodeScanner";
import PermissionGuard from "@/app/components/PermissionGuard";

import {
  getProducts,
  productUnits,
  Product,
  ProductUnit,
  saveProduct,
  updateProduct,
} from "@/app/lib/products";

function AddProductFallback() {
  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-2xl">
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

  const isEditing =
    Boolean(productId);

  useEffect(() => {
    setProducts(getProducts());
    setProductsLoaded(true);
  }, []);

  const productToEdit = productId
    ? products.find(
        (product) =>
          product.id === productId,
      )
    : undefined;

  /**
   * Put the existing product barcode
   * into our controlled barcode field
   * when editing a product.
   */
  useEffect(() => {
    if (productToEdit) {
      setBarcode(
        String(
          productToEdit.barcode ?? "",
        ),
      );
    } else if (!productId) {
      setBarcode("");
    }
  }, [productToEdit, productId]);

  /**
   * Receive barcode from BarcodeScanner.
   *
   * The scanner calls this function after
   * successfully detecting a barcode.
   */
  function handleBarcodeScan(
    scannedBarcode: string,
  ) {
    const cleanBarcode =
      String(
        scannedBarcode ?? "",
      ).trim();

    if (!cleanBarcode) {
      setError(
        "The scanner did not return a valid barcode.",
      );

      setSuccess("");
      setScannerOpen(false);

      return;
    }

    setBarcode(cleanBarcode);

    setError("");

    setSuccess(
      `Barcode ${cleanBarcode} scanned successfully and added to the barcode field.`,
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

    const formData =
      new FormData(
        event.currentTarget,
      );

    const name = String(
      formData.get("name") ?? "",
    ).trim();

    const cleanBarcode =
      barcode.trim();

    const category = String(
      formData.get("category") ?? "",
    ).trim();

    const quantity = Number(
      formData.get("quantity"),
    );

    const unit = String(
      formData.get("unit") ?? "",
    );

    const buyingPrice = Number(
      formData.get("buyingPrice"),
    );

    const sellingPrice = Number(
      formData.get("sellingPrice"),
    );

    if (
      !name ||
      !cleanBarcode ||
      !category ||
      !productUnits.includes(
        unit as ProductUnit,
      ) ||
      !Number.isFinite(quantity) ||
      !Number.isFinite(buyingPrice) ||
      !Number.isFinite(sellingPrice) ||
      quantity < 0 ||
      buyingPrice < 0 ||
      sellingPrice < 0
    ) {
      setError(
        "Please complete every field with valid, non-negative values.",
      );

      return;
    }

    setIsSaving(true);

    try {
      const productDetails = {
        name,
        barcode: cleanBarcode,
        category,
        quantity,
        unit: unit as ProductUnit,
        buyingPrice,
        sellingPrice,
      };

      const savedProduct =
        productId
          ? updateProduct(
              productId,
              productDetails,
            )
          : saveProduct(
              productDetails,
            );

      if (!savedProduct) {
        setError(
          "This product no longer exists. Return to Products and try again.",
        );

        setIsSaving(false);

        return;
      }

      router.push("/products");
    } catch {
      setError(
        `The product could not be ${
          isEditing
            ? "updated"
            : "saved"
        }. Please try again.`,
      );

      setIsSaving(false);
    }
  }

  if (!productsLoaded) {
    return (
      <AddProductFallback />
    );
  }

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
            This product may have
            already been deleted.
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

  return (
    <main className="min-h-screen bg-gray-100 p-6">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {isEditing
                ? "Edit Product"
                : "Add Product"}
            </h1>

            <p className="mt-2 text-gray-600">
              {isEditing
                ? "Update the product information below."
                : "Register a new product in your business."}
            </p>
          </div>

          <Link
            href="/"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Dashboard
          </Link>
        </div>

        <form
          className="mt-8 rounded-xl bg-white p-6 shadow"
          key={
            productToEdit?.id ??
            "new-product"
          }
          onSubmit={handleSubmit}
        >
          <div className="space-y-5">
            {/* PRODUCT NAME */}
            <div>
              <label
                className="block font-medium text-gray-900"
                htmlFor="name"
              >
                Product Name
              </label>

              <input
                className="mt-2 w-full rounded-lg border border-gray-300 p-3"
                defaultValue={
                  productToEdit?.name ??
                  ""
                }
                id="name"
                name="name"
                placeholder="e.g. Coca-Cola 500ml"
                required
                type="text"
              />
            </div>

            {/* BARCODE */}
            <div>
              <label
                className="block font-medium text-gray-900"
                htmlFor="barcode"
              >
                Barcode
              </label>

              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <input
                  className="w-full rounded-lg border border-gray-300 p-3"
                  value={barcode}
                  onChange={(event) =>
                    setBarcode(
                      event.target.value,
                    )
                  }
                  id="barcode"
                  name="barcode"
                  placeholder="Enter barcode or scan it"
                  required
                  type="text"
                />

                <button
                  type="button"
                  onClick={
                    openBarcodeScanner
                  }
                  className="rounded-lg bg-black px-5 py-3 font-medium text-white hover:bg-gray-800 sm:whitespace-nowrap"
                >
                  Scan Barcode
                </button>
              </div>

              <p className="mt-2 text-xs text-gray-500">
                You can enter the barcode manually or scan it using your camera.
              </p>
            </div>

            {/* BARCODE SCANNER */}
            {scannerOpen && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
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

            {/* CATEGORY */}
            <div>
              <label
                className="block font-medium text-gray-900"
                htmlFor="category"
              >
                Category
              </label>

              <input
                className="mt-2 w-full rounded-lg border border-gray-300 p-3"
                defaultValue={
                  productToEdit?.category ??
                  ""
                }
                id="category"
                name="category"
                placeholder="e.g. Drinks"
                required
                type="text"
              />
            </div>

            {/* QUANTITY */}
            <div>
              <label
                className="block font-medium text-gray-900"
                htmlFor="quantity"
              >
                Quantity
              </label>

              <input
                className="mt-2 w-full rounded-lg border border-gray-300 p-3"
                defaultValue={
                  productToEdit?.quantity
                }
                id="quantity"
                min="0"
                name="quantity"
                placeholder="0"
                required
                step="any"
                type="number"
              />
            </div>

            {/* UNIT */}
            <div>
              <label
                className="block font-medium text-gray-900"
                htmlFor="unit"
              >
                Unit
              </label>

              <select
                className="mt-2 w-full rounded-lg border border-gray-300 p-3"
                defaultValue={
                  productToEdit?.unit ??
                  "Piece"
                }
                id="unit"
                name="unit"
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

            {/* BUYING PRICE */}
            <div>
              <label
                className="block font-medium text-gray-900"
                htmlFor="buyingPrice"
              >
                Buying Price (RWF)
              </label>

              <input
                className="mt-2 w-full rounded-lg border border-gray-300 p-3"
                defaultValue={
                  productToEdit?.buyingPrice
                }
                id="buyingPrice"
                min="0"
                name="buyingPrice"
                placeholder="0"
                required
                step="any"
                type="number"
              />
            </div>

            {/* SELLING PRICE */}
            <div>
              <label
                className="block font-medium text-gray-900"
                htmlFor="sellingPrice"
              >
                Selling Price (RWF)
              </label>

              <input
                className="mt-2 w-full rounded-lg border border-gray-300 p-3"
                defaultValue={
                  productToEdit?.sellingPrice
                }
                id="sellingPrice"
                min="0"
                name="sellingPrice"
                placeholder="0"
                required
                step="any"
                type="number"
              />
            </div>

            {/* SUCCESS */}
            {success && (
              <p
                aria-live="polite"
                className="rounded-lg bg-green-50 p-3 text-sm text-green-700"
              >
                {success}
              </p>
            )}

            {/* ERROR */}
            {error && (
              <p
                aria-live="polite"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-600"
              >
                {error}
              </p>
            )}

            {/* BUTTONS */}
            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Link
                className="w-full rounded-lg border border-gray-300 px-5 py-3 text-center font-medium text-gray-700 hover:bg-gray-50"
                href="/products"
              >
                Cancel
              </Link>

              <button
                className="w-full rounded-lg bg-black px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-500"
                disabled={isSaving}
                type="submit"
              >
                {isSaving
                  ? isEditing
                    ? "Updating..."
                    : "Saving..."
                  : isEditing
                    ? "Update Product"
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