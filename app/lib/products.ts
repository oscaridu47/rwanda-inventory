import { getCurrentBusinessId } from "@/app/lib/auth";

export const PRODUCT_STORAGE_KEY =
  "rwanda-inventory-products";

export const PRODUCT_STORAGE_EVENT =
  "rwanda-inventory-products-changed";

export const productUnits = [
  "Piece",
  "Box",
  "Pack",
  "Kg",
  "Litre",
] as const;

export type ProductUnit =
  (typeof productUnits)[number];

export type Product = {
  id: string;
  businessId: string;
  name: string;
  barcode: string;
  category: string;
  quantity: number;
  unit: ProductUnit;
  buyingPrice: number;
  sellingPrice: number;
  createdAt: string;
};

export type NewProduct = Omit<
  Product,
  "id" | "businessId" | "createdAt"
>;

const emptyProducts: Product[] = [];

let cachedSerializedProducts:
  | string
  | null
  | undefined;

let cachedProducts: Product[] =
  emptyProducts;

function isStoredProduct(
  value: unknown,
): value is Product {
  if (!value || typeof value !== "object") {
    return false;
  }

  const product =
    value as Record<string, unknown>;

  return (
    typeof product.id === "string" &&
    typeof product.businessId === "string" &&
    typeof product.name === "string" &&
    typeof product.barcode === "string" &&
    typeof product.category === "string" &&
    typeof product.quantity === "number" &&
    typeof product.unit === "string" &&
    productUnits.includes(
      product.unit as ProductUnit,
    ) &&
    typeof product.buyingPrice === "number" &&
    typeof product.sellingPrice === "number" &&
    typeof product.createdAt === "string"
  );
}

/**
 * Converts old products that were created before
 * businessId was added.
 *
 * This is safe for the current prototype when
 * there is only one registered business.
 */
function migrateLegacyProducts(
  products: unknown[],
): Product[] {
  const businessId =
    getCurrentBusinessId();

  const businessesWithNoId =
    products.filter((value) => {
      if (!value || typeof value !== "object") {
        return false;
      }

      const product =
        value as Record<string, unknown>;

      return typeof product.businessId !== "string";
    });

  let changed = false;

  const migratedProducts: Product[] = [];

  for (const value of products) {
    if (!value || typeof value !== "object") {
      continue;
    }

    const product =
      value as Record<string, unknown>;

    /**
     * Already belongs to a business.
     */
    if (
      typeof product.businessId === "string"
    ) {
      if (isStoredProduct(product)) {
        migratedProducts.push(product);
      }

      continue;
    }

    /**
     * Legacy product without businessId.
     *
     * Only migrate it when we know the current
     * business. This prevents accidentally assigning
     * old data to the wrong business.
     */
    if (
      businessId &&
      businessesWithNoId.length > 0 &&
      typeof product.id === "string" &&
      typeof product.name === "string" &&
      typeof product.barcode === "string" &&
      typeof product.category === "string" &&
      typeof product.quantity === "number" &&
      typeof product.unit === "string" &&
      productUnits.includes(
        product.unit as ProductUnit,
      ) &&
      typeof product.buyingPrice === "number" &&
      typeof product.sellingPrice === "number" &&
      typeof product.createdAt === "string"
    ) {
      migratedProducts.push({
        id: product.id,
        businessId,
        name: product.name,
        barcode: product.barcode,
        category: product.category,
        quantity: product.quantity,
        unit: product.unit as ProductUnit,
        buyingPrice: product.buyingPrice,
        sellingPrice: product.sellingPrice,
        createdAt: product.createdAt,
      });

      changed = true;
    }
  }

  if (
    changed &&
    typeof window !== "undefined"
  ) {
    const serialized =
      JSON.stringify(migratedProducts);

    window.localStorage.setItem(
      PRODUCT_STORAGE_KEY,
      serialized,
    );

    cachedSerializedProducts =
      serialized;

    cachedProducts =
      migratedProducts;
  }

  return migratedProducts;
}

function readAllProducts(): Product[] {
  if (typeof window === "undefined") {
    return emptyProducts;
  }

  try {
    const storedProducts =
      window.localStorage.getItem(
        PRODUCT_STORAGE_KEY,
      );

    if (
      storedProducts ===
      cachedSerializedProducts
    ) {
      return cachedProducts;
    }

    cachedSerializedProducts =
      storedProducts;

    if (!storedProducts) {
      cachedProducts = emptyProducts;
      return cachedProducts;
    }

    const parsedProducts: unknown =
      JSON.parse(storedProducts);

    if (!Array.isArray(parsedProducts)) {
      cachedProducts = emptyProducts;
      return cachedProducts;
    }

    cachedProducts =
      migrateLegacyProducts(
        parsedProducts,
      );

    return cachedProducts;
  } catch {
    return emptyProducts;
  }
}

/**
 * Returns products belonging to the currently
 * logged-in user's business.
 */
export function getProducts(): Product[] {
  const businessId =
    getCurrentBusinessId();

  if (!businessId) {
    return emptyProducts;
  }

  return readAllProducts().filter(
    (product) =>
      product.businessId === businessId,
  );
}

/**
 * Returns products for a specific business.
 *
 * This is useful for admin/business-level views.
 */
export function getProductsByBusinessId(
  businessId: string,
): Product[] {
  if (
    typeof window === "undefined" ||
    !businessId
  ) {
    return emptyProducts;
  }

  return readAllProducts().filter(
    (product) =>
      product.businessId === businessId,
  );
}

export function subscribeToProducts(
  onStoreChange: () => void,
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  function handleStorageChange(
    event: StorageEvent,
  ) {
    if (
      event.key === PRODUCT_STORAGE_KEY
    ) {
      cachedSerializedProducts =
        undefined;

      onStoreChange();
    }
  }

  window.addEventListener(
    "storage",
    handleStorageChange,
  );

  window.addEventListener(
    PRODUCT_STORAGE_EVENT,
    onStoreChange,
  );

  return () => {
    window.removeEventListener(
      "storage",
      handleStorageChange,
    );

    window.removeEventListener(
      PRODUCT_STORAGE_EVENT,
      onStoreChange,
    );
  };
}

function createProductId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID ===
      "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function persistProducts(
  products: Product[],
): void {
  if (typeof window === "undefined") {
    return;
  }

  cachedProducts = products;

  cachedSerializedProducts =
    JSON.stringify(products);

  window.localStorage.setItem(
    PRODUCT_STORAGE_KEY,
    cachedSerializedProducts,
  );

  window.dispatchEvent(
    new Event(PRODUCT_STORAGE_EVENT),
  );
}

export function saveProduct(
  newProduct: NewProduct,
): Product {
  if (typeof window === "undefined") {
    throw new Error(
      "Products can only be saved in the browser.",
    );
  }

  const businessId =
    getCurrentBusinessId();

  if (!businessId) {
    throw new Error(
      "No business is connected to this account. Please register a business before creating products.",
    );
  }

  const product: Product = {
    ...newProduct,
    id: createProductId(),
    businessId,
    createdAt:
      new Date().toISOString(),
  };

  const allProducts =
    readAllProducts();

  persistProducts([
    ...allProducts,
    product,
  ]);

  return product;
}

export function updateProduct(
  productId: string,
  updatedDetails: NewProduct,
): Product | null {
  if (typeof window === "undefined") {
    throw new Error(
      "Products can only be updated in the browser.",
    );
  }

  const businessId =
    getCurrentBusinessId();

  if (!businessId) {
    throw new Error(
      "No business is connected to this account.",
    );
  }

  const allProducts =
    readAllProducts();

  const existingProduct =
    allProducts.find(
      (product) =>
        product.id === productId &&
        product.businessId === businessId,
    );

  if (!existingProduct) {
    return null;
  }

  const updatedProduct: Product = {
    ...existingProduct,
    ...updatedDetails,
  };

  persistProducts(
    allProducts.map((product) =>
      product.id === productId &&
      product.businessId === businessId
        ? updatedProduct
        : product,
    ),
  );

  return updatedProduct;
}

export function deleteProduct(
  productId: string,
): boolean {
  if (typeof window === "undefined") {
    throw new Error(
      "Products can only be deleted in the browser.",
    );
  }

  const businessId =
    getCurrentBusinessId();

  if (!businessId) {
    throw new Error(
      "No business is connected to this account.",
    );
  }

  const allProducts =
    readAllProducts();

  const remainingProducts =
    allProducts.filter(
      (product) =>
        !(
          product.id === productId &&
          product.businessId === businessId
        ),
    );

  if (
    remainingProducts.length ===
    allProducts.length
  ) {
    return false;
  }

  persistProducts(
    remainingProducts,
  );

  return true;
}

export function adjustProductQuantity(
  productId: string,
  quantityChange: number,
): Product | null {
  if (typeof window === "undefined") {
    throw new Error(
      "Products can only be changed in the browser.",
    );
  }

  if (!Number.isFinite(quantityChange)) {
    throw new Error(
      "Quantity change must be a valid number.",
    );
  }

  const businessId =
    getCurrentBusinessId();

  if (!businessId) {
    throw new Error(
      "No business is connected to this account.",
    );
  }

  const allProducts =
    readAllProducts();

  const existingProduct =
    allProducts.find(
      (product) =>
        product.id === productId &&
        product.businessId === businessId,
    );

  if (!existingProduct) {
    return null;
  }

  const newQuantity =
    existingProduct.quantity +
    quantityChange;

  if (newQuantity < 0) {
    throw new Error(
      "Stock quantity cannot be negative.",
    );
  }

  const updatedProduct: Product = {
    ...existingProduct,
    quantity: newQuantity,
  };

  persistProducts(
    allProducts.map((product) =>
      product.id === productId &&
      product.businessId === businessId
        ? updatedProduct
        : product,
    ),
  );

  return updatedProduct;
}