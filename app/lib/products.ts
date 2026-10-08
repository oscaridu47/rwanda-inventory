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

/**
 * Product stock is ALWAYS stored in the base unit.
 *
 * Example:
 *
 * Coca-Cola
 * baseUnit = "Piece"
 * packageUnit = "Box"
 * unitsPerPackage = 12
 * quantity = 24
 *
 * This means:
 * 24 Pieces = 2 Boxes
 */
export type Product = {
  id: string;
  businessId: string;
  name: string;
  barcode: string;
  category: string;

  /**
   * IMPORTANT:
   * quantity is the current stock expressed
   * in the base unit.
   */
  quantity: number;

  /**
   * Base unit used for internal stock calculations.
   *
   * Examples:
   * Piece
   * Kg
   * Litre
   */
  unit: ProductUnit;

  /**
   * Unit used when purchasing/receiving stock.
   *
   * Example:
   * unit = Piece
   * packageUnit = Box
   * unitsPerPackage = 12
   */
  packageUnit?: ProductUnit;

  /**
   * How many base units are inside one package.
   *
   * Example:
   * 1 Box = 12 Pieces
   *
   * unitsPerPackage = 12
   */
  unitsPerPackage?: number;

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

/**
 * Checks whether a value is a valid product unit.
 */
export function isProductUnit(
  value: unknown,
): value is ProductUnit {
  return (
    typeof value === "string" &&
    productUnits.includes(
      value as ProductUnit,
    )
  );
}

/**
 * Returns a safe base unit.
 *
 * Old products do not have the new conversion
 * fields, so their existing unit becomes the
 * base unit.
 */
export function getBaseUnit(
  product: Product,
): ProductUnit {
  return product.unit;
}

/**
 * Returns the package/purchase unit.
 *
 * For old products without packageUnit,
 * the base unit is used.
 */
export function getPackageUnit(
  product: Product,
): ProductUnit {
  if (
    product.packageUnit &&
    isProductUnit(product.packageUnit)
  ) {
    return product.packageUnit;
  }

  return product.unit;
}

/**
 * Returns how many base units are inside one
 * package.
 *
 * Old products default to 1.
 */
export function getUnitsPerPackage(
  product: Product,
): number {
  const value =
    product.unitsPerPackage;

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return 1;
  }

  return value;
}

/**
 * Converts a quantity entered in a package unit
 * into the product's base unit.
 *
 * Example:
 *
 * 2 Boxes
 * 1 Box = 12 Pieces
 *
 * result = 24 Pieces
 */
export function convertToBaseUnits(
  product: Product,
  quantity: number,
  inputUnit?: ProductUnit,
): number {
  if (
    !Number.isFinite(quantity) ||
    quantity < 0
  ) {
    throw new Error(
      "Quantity must be a valid non-negative number.",
    );
  }

  const baseUnit =
    getBaseUnit(product);

  const packageUnit =
    getPackageUnit(product);

  const selectedUnit =
    inputUnit ?? packageUnit;

  /**
   * Already expressed in the base unit.
   */
  if (selectedUnit === baseUnit) {
    return quantity;
  }

  /**
   * Expressed in the package unit.
   */
  if (
    selectedUnit === packageUnit
  ) {
    return (
      quantity *
      getUnitsPerPackage(product)
    );
  }

  throw new Error(
    `Cannot convert ${selectedUnit} to ${baseUnit} for ${product.name}.`,
  );
}

/**
 * Converts base-unit stock into package units.
 *
 * Example:
 *
 * 24 Pieces
 * 1 Box = 12 Pieces
 *
 * result = 2 Boxes
 */
export function convertFromBaseUnits(
  product: Product,
  baseQuantity: number,
  outputUnit?: ProductUnit,
): number {
  if (
    !Number.isFinite(baseQuantity) ||
    baseQuantity < 0
  ) {
    throw new Error(
      "Stock quantity must be a valid non-negative number.",
    );
  }

  const baseUnit =
    getBaseUnit(product);

  const packageUnit =
    getPackageUnit(product);

  const selectedUnit =
    outputUnit ?? packageUnit;

  if (selectedUnit === baseUnit) {
    return baseQuantity;
  }

  if (
    selectedUnit === packageUnit
  ) {
    return (
      baseQuantity /
      getUnitsPerPackage(product)
    );
  }

  throw new Error(
    `Cannot convert ${baseUnit} to ${selectedUnit} for ${product.name}.`,
  );
}

/**
 * Returns the number of complete packages
 * contained in current stock.
 *
 * Example:
 *
 * 36 Pieces
 * 1 Box = 12 Pieces
 *
 * returns 3.
 */
export function getPackageQuantity(
  product: Product,
): number {
  return convertFromBaseUnits(
    product,
    product.quantity,
    getPackageUnit(product),
  );
}

/**
 * Returns a human-readable stock description.
 *
 * Examples:
 *
 * "24 Pieces (2 Boxes)"
 * "30 Pieces (2 Boxes + 6 Pieces)"
 * "5 Kg"
 */
export function formatProductStock(
  product: Product,
): string {
  const quantity =
    product.quantity;

  const baseUnit =
    getBaseUnit(product);

  const packageUnit =
    getPackageUnit(product);

  const unitsPerPackage =
    getUnitsPerPackage(product);

  /**
   * No meaningful package conversion.
   */
  if (
    packageUnit === baseUnit ||
    unitsPerPackage === 1
  ) {
    return `${quantity} ${baseUnit}`;
  }

  const completePackages =
    Math.floor(
      quantity / unitsPerPackage,
    );

  const remainingBaseUnits =
    quantity % unitsPerPackage;

  if (completePackages === 0) {
    return `${quantity} ${baseUnit}`;
  }

  if (remainingBaseUnits === 0) {
    return `${quantity} ${baseUnit} (${completePackages} ${packageUnit}${completePackages === 1 ? "" : "s"})`;
  }

  return `${quantity} ${baseUnit} (${completePackages} ${packageUnit}${completePackages === 1 ? "" : "s"} + ${remainingBaseUnits} ${baseUnit}${remainingBaseUnits === 1 ? "" : "s"})`;
}

/**
 * Normalizes products loaded from localStorage.
 *
 * This is extremely important because products
 * created by older versions of RwandaInventory
 * do not have packageUnit or unitsPerPackage.
 *
 * Old example:
 *
 * {
 *   quantity: 10,
 *   unit: "Piece"
 * }
 *
 * becomes:
 *
 * {
 *   quantity: 10,
 *   unit: "Piece",
 *   packageUnit: "Piece",
 *   unitsPerPackage: 1
 * }
 */
function normalizeStoredProduct(
  value: unknown,
): Product | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const product =
    value as Record<string, unknown>;

  if (
    typeof product.id !== "string" ||
    typeof product.businessId !== "string" ||
    typeof product.name !== "string" ||
    typeof product.barcode !== "string" ||
    typeof product.category !== "string" ||
    typeof product.quantity !== "number" ||
    !Number.isFinite(
      product.quantity,
    ) ||
    typeof product.unit !== "string" ||
    !isProductUnit(product.unit) ||
    typeof product.buyingPrice !== "number" ||
    !Number.isFinite(
      product.buyingPrice,
    ) ||
    typeof product.sellingPrice !== "number" ||
    !Number.isFinite(
      product.sellingPrice,
    ) ||
    typeof product.createdAt !== "string"
  ) {
    return null;
  }

  let packageUnit: ProductUnit =
    product.unit;

  if (
    typeof product.packageUnit ===
      "string" &&
    isProductUnit(
      product.packageUnit,
    )
  ) {
    packageUnit =
      product.packageUnit;
  }

  let unitsPerPackage = 1;

  if (
    typeof product.unitsPerPackage ===
      "number" &&
    Number.isFinite(
      product.unitsPerPackage,
    ) &&
    product.unitsPerPackage > 0
  ) {
    unitsPerPackage =
      product.unitsPerPackage;
  }

  return {
    id: product.id,
    businessId: product.businessId,
    name: product.name,
    barcode: product.barcode,
    category: product.category,
    quantity: product.quantity,
    unit: product.unit,
    packageUnit,
    unitsPerPackage,
    buyingPrice:
      product.buyingPrice,
    sellingPrice:
      product.sellingPrice,
    createdAt:
      product.createdAt,
  };
}

function isStoredProduct(
  value: unknown,
): value is Product {
  return (
    normalizeStoredProduct(value) !==
    null
  );
}

/**
 * Converts old products that were created before
 * businessId was added and also normalizes old
 * products that were created before the unit
 * conversion system existed.
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
      if (
        !value ||
        typeof value !== "object"
      ) {
        return false;
      }

      const product =
        value as Record<
          string,
          unknown
        >;

      return (
        typeof product.businessId !==
        "string"
      );
    });

  let changed = false;

  const migratedProducts: Product[] =
    [];

  for (const value of products) {
    if (
      !value ||
      typeof value !== "object"
    ) {
      continue;
    }

    const product =
      value as Record<
        string,
        unknown
      >;

    /**
     * Product already belongs to a business.
     */
    if (
      typeof product.businessId ===
      "string"
    ) {
      const normalized =
        normalizeStoredProduct(
          product,
        );

      if (normalized) {
        /**
         * If the stored product did not
         * have the new fields, normalization
         * adds them.
         */
        if (
          product.packageUnit !==
            normalized.packageUnit ||
          product.unitsPerPackage !==
            normalized.unitsPerPackage
        ) {
          changed = true;
        }

        migratedProducts.push(
          normalized,
        );
      }

      continue;
    }

    /**
     * Legacy product without businessId.
     *
     * Only migrate it when we know the
     * current business.
     */
    if (
      businessId &&
      businessesWithNoId.length > 0
    ) {
      const normalized =
        normalizeStoredProduct({
          ...product,
          businessId,
        });

      if (normalized) {
        migratedProducts.push(
          normalized,
        );

        changed = true;
      }
    }
  }

  if (
    changed &&
    typeof window !== "undefined"
  ) {
    const serialized =
      JSON.stringify(
        migratedProducts,
      );

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
  if (
    typeof window === "undefined"
  ) {
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
      cachedProducts =
        emptyProducts;

      return cachedProducts;
    }

    const parsedProducts: unknown =
      JSON.parse(
        storedProducts,
      );

    if (
      !Array.isArray(
        parsedProducts,
      )
    ) {
      cachedProducts =
        emptyProducts;

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
 * Returns products belonging to the
 * currently logged-in user's business.
 */
export function getProducts(): Product[] {
  const businessId =
    getCurrentBusinessId();

  if (!businessId) {
    return emptyProducts;
  }

  return readAllProducts().filter(
    (product) =>
      product.businessId ===
      businessId,
  );
}

/**
 * Returns products for a specific business.
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
      product.businessId ===
      businessId,
  );
}

export function subscribeToProducts(
  onStoreChange: () => void,
) {
  if (
    typeof window === "undefined"
  ) {
    return () => {};
  }

  function handleStorageChange(
    event: StorageEvent,
  ) {
    if (
      event.key ===
      PRODUCT_STORAGE_KEY
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
  if (
    typeof window === "undefined"
  ) {
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
    new Event(
      PRODUCT_STORAGE_EVENT,
    ),
  );
}

/**
 * Saves a new product.
 *
 * quantity MUST already be expressed in
 * the product's base unit.
 *
 * The Add Product page will be responsible
 * for converting "2 Boxes" into "24 Pieces"
 * before calling this function.
 */
export function saveProduct(
  newProduct: NewProduct,
): Product {
  if (
    typeof window === "undefined"
  ) {
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

  const packageUnit =
    newProduct.packageUnit ??
    newProduct.unit;

  const unitsPerPackage =
    newProduct.unitsPerPackage ??
    1;

  if (
    !isProductUnit(
      packageUnit,
    )
  ) {
    throw new Error(
      "Invalid package unit.",
    );
  }

  if (
    !Number.isFinite(
      unitsPerPackage,
    ) ||
    unitsPerPackage <= 0
  ) {
    throw new Error(
      "Units per package must be greater than zero.",
    );
  }

  if (
    !Number.isFinite(
      newProduct.quantity,
    ) ||
    newProduct.quantity < 0
  ) {
    throw new Error(
      "Product quantity must be a valid non-negative number.",
    );
  }

  const product: Product = {
    ...newProduct,

    packageUnit,

    unitsPerPackage,

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
  if (
    typeof window === "undefined"
  ) {
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
        product.businessId ===
          businessId,
    );

  if (!existingProduct) {
    return null;
  }

  const packageUnit =
    updatedDetails.packageUnit ??
    updatedDetails.unit;

  const unitsPerPackage =
    updatedDetails.unitsPerPackage ??
    1;

  if (
    !isProductUnit(
      packageUnit,
    )
  ) {
    throw new Error(
      "Invalid package unit.",
    );
  }

  if (
    !Number.isFinite(
      unitsPerPackage,
    ) ||
    unitsPerPackage <= 0
  ) {
    throw new Error(
      "Units per package must be greater than zero.",
    );
  }

  if (
    !Number.isFinite(
      updatedDetails.quantity,
    ) ||
    updatedDetails.quantity < 0
  ) {
    throw new Error(
      "Product quantity must be a valid non-negative number.",
    );
  }

  const updatedProduct: Product = {
    ...existingProduct,

    ...updatedDetails,

    packageUnit,

    unitsPerPackage,
  };

  persistProducts(
    allProducts.map(
      (product) =>
        product.id === productId &&
        product.businessId ===
          businessId
          ? updatedProduct
          : product,
    ),
  );

  return updatedProduct;
}

export function deleteProduct(
  productId: string,
): boolean {
  if (
    typeof window === "undefined"
  ) {
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
          product.businessId ===
            businessId
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

/**
 * Adjusts stock in BASE UNITS.
 *
 * Example:
 *
 * Coca-Cola:
 * base unit = Piece
 *
 * adjustProductQuantity(id, 24)
 * means add 24 Pieces.
 *
 * The Stock page will convert:
 *
 * 2 Boxes × 12 = 24 Pieces
 *
 * before calling this function.
 */
export function adjustProductQuantity(
  productId: string,
  quantityChange: number,
): Product | null {
  if (
    typeof window === "undefined"
  ) {
    throw new Error(
      "Products can only be changed in the browser.",
    );
  }

  if (
    !Number.isFinite(
      quantityChange,
    )
  ) {
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
        product.businessId ===
          businessId,
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
    allProducts.map(
      (product) =>
        product.id === productId &&
        product.businessId ===
          businessId
          ? updatedProduct
          : product,
    ),
  );

  return updatedProduct;
}

/**
 * Adds stock using a specific input unit.
 *
 * Example:
 *
 * Coca-Cola:
 * 1 Box = 12 Pieces
 *
 * addProductStock(
 *   cocaColaId,
 *   2,
 *   "Box"
 * )
 *
 * adds 24 Pieces.
 */
export function addProductStock(
  productId: string,
  quantity: number,
  inputUnit?: ProductUnit,
): Product | null {
  if (
    typeof window === "undefined"
  ) {
    throw new Error(
      "Products can only be changed in the browser.",
    );
  }

  if (
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    throw new Error(
      "Stock quantity must be greater than zero.",
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
        product.businessId ===
          businessId,
    );

  if (!existingProduct) {
    return null;
  }

  const baseQuantity =
    convertToBaseUnits(
      existingProduct,
      quantity,
      inputUnit,
    );

  return adjustProductQuantity(
    productId,
    baseQuantity,
  );
}

/**
 * Removes/sells stock using a specific
 * input unit.
 *
 * Example:
 *
 * Coca-Cola:
 * 1 Box = 12 Pieces
 *
 * removeProductStock(
 *   cocaColaId,
 *   1,
 *   "Box"
 * )
 *
 * removes 12 Pieces.
 */
export function removeProductStock(
  productId: string,
  quantity: number,
  inputUnit?: ProductUnit,
): Product | null {
  if (
    typeof window === "undefined"
  ) {
    throw new Error(
      "Products can only be changed in the browser.",
    );
  }

  if (
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    throw new Error(
      "Stock quantity must be greater than zero.",
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
        product.businessId ===
          businessId,
    );

  if (!existingProduct) {
    return null;
  }

  const baseQuantity =
    convertToBaseUnits(
      existingProduct,
      quantity,
      inputUnit,
    );

  if (
    existingProduct.quantity <
    baseQuantity
  ) {
    throw new Error(
      `Not enough stock. Available stock is ${formatProductStock(existingProduct)}.`,
    );
  }

  return adjustProductQuantity(
    productId,
    -baseQuantity,
  );
}