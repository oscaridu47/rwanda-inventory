import type {
  Product,
  ProductUnit,
} from "./products";

import {
  convertToBaseUnits,
  getPackageUnit,
} from "./products";

import {
  getCurrentBusinessId,
  getCurrentUser,
} from "./auth";

import { hasPermission } from "./permissions";

import { supabase } from "./supabase";

import {
  loadPackagingConfigFromSupabase,
  loadPackagingConfigsFromSupabase,
  toBaseQuantity,
  type PackagingConfig,
} from "./packaging";

export const STOCK_MOVEMENT_STORAGE_KEY =
  "rwanda-inventory-stock-movements";

export const STOCK_MOVEMENT_EVENT =
  "rwanda-inventory-stock-movements-changed";

export type StockMovementType =
  | "received"
  | "adjustment";

export type StockMovement = {
  id: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantityChange: number;
  reason: string;
  createdAt: string;
};

export type StockProduct = {
  id: string;
  businessId: string;
  name: string;
  barcode: string;
  category: string;
  quantity: number;
  unit: ProductUnit;

  /*
   * Legacy packaging fields.
   * These are kept because existing Stock components
   * still use them.
   */
  packageUnit: ProductUnit;
  unitsPerPackage: number;

  /*
   * New packaging configuration from Supabase.
   *
   * Example:
   * baseUnit = "Piece"
   * factors = {
   *   Piece: 1,
   *   Box: 24
   * }
   */
  packagingConfig?: PackagingConfig;

  createdAt: string;
};

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

type StockMovementRow = {
  id: string;
  business_id: string;
  product_id: string;
  user_id: string | null;
  movement_type: string;
  quantity: number | string;
  reason: string | null;
  created_at: string;
};

type RpcProduct = {
  id?: string;
  businessId?: string;
  business_id?: string;

  name?: string | null;
  barcode?: string | null;
  category?: string | null;

  quantity?: number | string | null;

  unit?: string | null;

  packageUnit?: string | null;
  package_unit?: string | null;

  unitsPerPackage?: number | string | null;
  units_per_package?: number | string | null;

  buyingPrice?: number | string | null;
  buying_price?: number | string | null;

  sellingPrice?: number | string | null;
  selling_price?: number | string | null;

  createdAt?: string | null;
  created_at?: string | null;
};

type RpcMovement = {
  id?: string;

  productId?: string;
  product_id?: string;

  type?: string;
  movement_type?: string;

  quantityChange?: number | string | null;
  quantity_change?: number | string | null;
  quantity?: number | string | null;

  reason?: string | null;

  createdAt?: string | null;
  created_at?: string | null;

  productName?: string | null;
  product_name?: string | null;
};

type RpcResult = {
  product?: RpcProduct | null;
  movement?: RpcMovement | null;
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
  const units: ProductUnit[] = [
    "Piece",
    "Box",
    "Pack",
    "Kg",
    "Litre",
  ];

  if (
    typeof value === "string" &&
    units.includes(value as ProductUnit)
  ) {
    return value as ProductUnit;
  }

  return fallback;
}

function requireBusinessId(): string {
  const businessId =
    getCurrentBusinessId();

  if (!businessId) {
    throw new Error(
      "No business is connected to this account. Please sign in again.",
    );
  }

  return businessId;
}

function requirePermission(
  permission:
    | "stock.view"
    | "stock.receive"
    | "stock.adjust"
    | "stock.history",
): void {
  const user =
    getCurrentUser();

  if (!user) {
    throw new Error(
      "Your session has expired. Please sign in again.",
    );
  }

  if (
    !hasPermission(
      user.role,
      permission,
      user.permissions,
    )
  ) {
    throw new Error(
      `You do not have permission to use ${permission}.`,
    );
  }
}

function mapProductRow(
  row: ProductRow,
): Product {
  const unit =
    toProductUnit(
      row.unit,
      "Piece",
    );

  const packageUnit =
    toProductUnit(
      row.package_unit,
      unit,
    );

  return {
    id: row.id,

    businessId:
      row.business_id,

    name:
      row.name ?? "",

    barcode:
      row.barcode ?? "",

    category:
      row.category ?? "",

    quantity:
      Math.max(
        0,
        toNumber(
          row.quantity,
        ),
      ),

    unit,

    packageUnit,

    unitsPerPackage:
      Math.max(
        0.000001,
        toNumber(
          row.units_per_package,
          1,
        ),
      ),

    buyingPrice:
      Math.max(
        0,
        toNumber(
          row.buying_price,
        ),
      ),

    sellingPrice:
      Math.max(
        0,
        toNumber(
          row.selling_price,
        ),
      ),

    createdAt:
      row.created_at ??
      new Date().toISOString(),
  };
}

function mapStockProduct(
  row: ProductRow,
): StockProduct {
  const product =
    mapProductRow(row);

  return {
    id:
      product.id,

    businessId:
      product.businessId,

    name:
      product.name,

    barcode:
      product.barcode,

    category:
      product.category,

    quantity:
      product.quantity,

    unit:
      product.unit,

    packageUnit:
      product.packageUnit ??
      product.unit,

    unitsPerPackage:
      product.unitsPerPackage ??
      1,

    createdAt:
      product.createdAt,
  };
}

function mapRpcProduct(
  value: RpcProduct,
): Product {
  const unit =
    toProductUnit(
      value.unit,
      "Piece",
    );

  const packageUnit =
    toProductUnit(
      value.packageUnit ??
        value.package_unit,
      unit,
    );

  return {
    id:
      value.id ?? "",

    businessId:
      value.businessId ??
      value.business_id ??
      "",

    name:
      value.name ?? "",

    barcode:
      value.barcode ?? "",

    category:
      value.category ?? "",

    quantity:
      Math.max(
        0,
        toNumber(
          value.quantity,
        ),
      ),

    unit,

    packageUnit,

    unitsPerPackage:
      Math.max(
        0.000001,
        toNumber(
          value.unitsPerPackage ??
            value.units_per_package,
          1,
        ),
      ),

    buyingPrice:
      Math.max(
        0,
        toNumber(
          value.buyingPrice ??
            value.buying_price,
        ),
      ),

    sellingPrice:
      Math.max(
        0,
        toNumber(
          value.sellingPrice ??
            value.selling_price,
        ),
      ),

    createdAt:
      value.createdAt ??
      value.created_at ??
      new Date().toISOString(),
  };
}

function mapRpcMovement(
  value: RpcMovement,
  productName = "",
): StockMovement {
  const rawType =
    value.type ??
    value.movement_type;

  return {
    id:
      value.id ?? "",

    productId:
      value.productId ??
      value.product_id ??
      "",

    productName:
      value.productName ??
      value.product_name ??
      productName,

    type:
      rawType === "adjustment"
        ? "adjustment"
        : "received",

    quantityChange:
      toNumber(
        value.quantityChange ??
          value.quantity_change ??
          value.quantity,
      ),

    reason:
      value.reason ?? "",

    createdAt:
      value.createdAt ??
      value.created_at ??
      new Date().toISOString(),
  };
}

function mapMovementRow(
  row: StockMovementRow,
  productName: string,
): StockMovement {
  return {
    id:
      row.id,

    productId:
      row.product_id,

    productName,

    type:
      row.movement_type ===
      "adjustment"
        ? "adjustment"
        : "received",

    quantityChange:
      toNumber(
        row.quantity,
      ),

    reason:
      row.reason ?? "",

    createdAt:
      row.created_at,
  };
}

/**
 * Load current stock from Supabase.
 *
 * The stock quantity continues to come from the
 * secure get_business_stock RPC.
 *
 * Packaging configuration is loaded separately
 * from packaging_configs and attached to each
 * StockProduct.
 */
export async function getStockProducts(): Promise<
  StockProduct[]
> {
  const businessId =
    requireBusinessId();

  requirePermission(
    "stock.view",
  );

  const {
    data,
    error,
  } =
    await supabase.rpc(
      "get_business_stock",
      {
        p_business_id:
          businessId,
      },
    );

  if (error) {
    throw new Error(
      error.message ||
        "Unable to load stock.",
    );
  }

  const stockProducts =
    (
      (data ?? []) as ProductRow[]
    ).map(
      mapStockProduct,
    );

  /*
   * Load the new packaging configuration.
   *
   * This function also updates the local packaging
   * cache, which will help us later with offline
   * synchronization.
   */
  const packagingConfigs =
    await loadPackagingConfigsFromSupabase(
      businessId,
    );

  const packagingMap =
    new Map<
      string,
      PackagingConfig
    >();

  for (
    const config of
      packagingConfigs
  ) {
    packagingMap.set(
      config.productId,
      config,
    );
  }

  return stockProducts.map(
    (product) => {
      const packagingConfig =
        packagingMap.get(
          product.id,
        );

      if (!packagingConfig) {
        /*
         * No new configuration exists.
         * Keep the old behavior exactly as before.
         */
        return product;
      }

      /*
       * Keep legacy packageUnit / unitsPerPackage
       * populated so existing Stock UI continues
       * working while we migrate it to support all
       * configured units.
       */
      const configuredUnits =
        [
          "Piece",
          "Box",
          "Pack",
          "Kg",
          "Litre",
        ] as ProductUnit[];

      const alternativeUnit =
        configuredUnits.find(
          (unit) =>
            unit !==
              packagingConfig.baseUnit &&
            Number(
              packagingConfig.factors[
                unit
              ],
            ) > 0,
        );

      const primaryPackageUnit =
        alternativeUnit ??
        packagingConfig.baseUnit;

      const primaryFactor =
        Number(
          packagingConfig.factors[
            primaryPackageUnit
          ],
        ) || 1;

      return {
        ...product,

        packagingConfig,

        packageUnit:
          primaryPackageUnit,

        unitsPerPackage:
          primaryFactor,
      };
    },
  );
}

/**
 * Load stock movement history from Supabase.
 */
export async function getStockMovements(): Promise<
  StockMovement[]
> {
  const businessId =
    requireBusinessId();

  requirePermission(
    "stock.history",
  );

  const {
    data,
    error,
  } =
    await supabase
      .from("stock_movements")
      .select(
        `
          id,
          business_id,
          product_id,
          user_id,
          movement_type,
          quantity,
          reason,
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

  if (error) {
    throw new Error(
      error.message ||
        "Unable to load stock history.",
    );
  }

  const rows =
    (data ?? []) as StockMovementRow[];

  if (rows.length === 0) {
    return [];
  }

  const productIds =
    Array.from(
      new Set(
        rows.map(
          (
            row: StockMovementRow,
          ) =>
            row.product_id,
        ),
      ),
    );

  const {
    data: products,
    error: productError,
  } =
    await supabase
      .from("products")
      .select(
        "id, name",
      )
      .eq(
        "business_id",
        businessId,
      )
      .in(
        "id",
        productIds,
      );

  if (productError) {
    throw new Error(
      productError.message ||
        "Unable to load product names.",
    );
  }

  const productNames =
    new Map<
      string,
      string
    >();

  for (
    const product of
      (products ?? []) as Array<{
        id: string;
        name: string | null;
      }>
  ) {
    productNames.set(
      product.id,
      product.name ?? "",
    );
  }

  return rows.map(
    (
      row: StockMovementRow,
    ) =>
      mapMovementRow(
        row,
        productNames.get(
          row.product_id,
        ) ?? "Product",
      ),
  );
}

/**
 * Secure stock update.
 *
 * IMPORTANT:
 * We continue using the existing
 * record_stock_movement RPC.
 *
 * We are NOT changing the database stock
 * security or RPC here.
 */
export async function recordStockMovement(
  productId: string,
  quantityChange: number,
  reason: string,
  type: StockMovementType,
): Promise<{
  product: Product;
  movement: StockMovement;
}> {
  const businessId =
    requireBusinessId();

  if (
    !Number.isFinite(
      quantityChange,
    ) ||
    quantityChange === 0
  ) {
    throw new Error(
      "Quantity change must be a valid non-zero number.",
    );
  }

  if (
    type === "received"
  ) {
    requirePermission(
      "stock.receive",
    );

    if (
      quantityChange <= 0
    ) {
      throw new Error(
        "Received stock must be positive.",
      );
    }
  } else {
    requirePermission(
      "stock.adjust",
    );
  }

  /*
   * Application uses "received".
   * Database RPC uses "receive".
   */
  const databaseMovementType =
    type === "received"
      ? "receive"
      : "adjustment";

  const {
    data,
    error,
  } =
    await supabase.rpc(
      "record_stock_movement",
      {
        p_business_id:
          businessId,

        p_product_id:
          productId,

        p_quantity_change:
          quantityChange,

        p_reason:
          reason.trim(),

        p_movement_type:
          databaseMovementType,
      },
    );

  if (error) {
    throw new Error(
      error.message ||
        "Unable to update stock.",
    );
  }

  const result =
    (data ?? {}) as RpcResult;

  if (
    !result.product ||
    !result.movement
  ) {
    throw new Error(
      "The stock operation returned an incomplete result.",
    );
  }

  const product =
    mapRpcProduct(
      result.product,
    );

  const movement =
    mapRpcMovement(
      result.movement,
      product.name,
    );

  if (
    typeof window !==
    "undefined"
  ) {
    window.dispatchEvent(
      new Event(
        STOCK_MOVEMENT_EVENT,
      ),
    );
  }

  return {
    product,
    movement,
  };
}

/**
 * Compatibility wrapper for existing code.
 */
export async function addStockMovement(
  product: Product,
  quantityChange: number,
  reason: string,
  type: StockMovementType = "received",
): Promise<StockMovement> {
  const result =
    await recordStockMovement(
      product.id,
      quantityChange,
      reason,
      type,
    );

  return result.movement;
}

/**
 * Add stock using the old product packaging
 * fields OR the new packaging_configs table.
 *
 * New packaging configuration takes priority.
 */
export async function addProductStock(
  productId: string,
  quantity: number,
  inputUnit?: ProductUnit,
): Promise<Product | null> {
  if (
    !Number.isFinite(
      quantity,
    ) ||
    quantity <= 0
  ) {
    throw new Error(
      "Stock quantity must be greater than zero.",
    );
  }

  const businessId =
    requireBusinessId();

  const {
    data,
    error,
  } =
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
          package_unit,
          units_per_package,
          buying_price,
          selling_price,
          created_at
        `,
      )
      .eq(
        "id",
        productId,
      )
      .eq(
        "business_id",
        businessId,
      )
      .single();

  if (error) {
    throw new Error(
      error.message ||
        "Unable to find the product.",
    );
  }

  const product =
    mapProductRow(
      data as ProductRow,
    );

  /*
   * First try the new packaging configuration.
   */
  const packagingConfig =
    await loadPackagingConfigFromSupabase(
      businessId,
      productId,
    );

  let baseQuantity: number;

  if (packagingConfig) {
    const selectedUnit =
      inputUnit ??
      packagingConfig.baseUnit;

    baseQuantity =
      toBaseQuantity(
        packagingConfig,
        quantity,
        selectedUnit,
      );
  } else {
    /*
     * Fallback to the old product-level
     * package configuration.
     */
    const selectedUnit =
      inputUnit ??
      getPackageUnit(
        product,
      );

    baseQuantity =
      convertToBaseUnits(
        product,
        quantity,
        selectedUnit,
      );
  }

  const result =
    await recordStockMovement(
      productId,
      baseQuantity,
      "Stock received",
      "received",
    );

  return result.product;
}

/**
 * Remove stock using the old product packaging
 * fields OR the new packaging_configs table.
 */
export async function removeProductStock(
  productId: string,
  quantity: number,
  inputUnit?: ProductUnit,
): Promise<Product | null> {
  if (
    !Number.isFinite(
      quantity,
    ) ||
    quantity <= 0
  ) {
    throw new Error(
      "Stock quantity must be greater than zero.",
    );
  }

  const businessId =
    requireBusinessId();

  const {
    data,
    error,
  } =
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
          package_unit,
          units_per_package,
          buying_price,
          selling_price,
          created_at
        `,
      )
      .eq(
        "id",
        productId,
      )
      .eq(
        "business_id",
        businessId,
      )
      .single();

  if (error) {
    throw new Error(
      error.message ||
        "Unable to find the product.",
    );
  }

  const product =
    mapProductRow(
      data as ProductRow,
    );

  /*
   * First try the new packaging configuration.
   */
  const packagingConfig =
    await loadPackagingConfigFromSupabase(
      businessId,
      productId,
    );

  let baseQuantity: number;

  if (packagingConfig) {
    const selectedUnit =
      inputUnit ??
      packagingConfig.baseUnit;

    baseQuantity =
      toBaseQuantity(
        packagingConfig,
        quantity,
        selectedUnit,
      );
  } else {
    /*
     * Fallback to the old product-level
     * package configuration.
     */
    const selectedUnit =
      inputUnit ??
      getPackageUnit(
        product,
      );

    baseQuantity =
      convertToBaseUnits(
        product,
        quantity,
        selectedUnit,
      );
  }

  const result =
    await recordStockMovement(
      productId,
      -Math.abs(
        baseQuantity,
      ),
      "Stock adjustment",
      "adjustment",
    );

  return result.product;
}

/**
 * Direct adjustment in base units.
 */
export async function adjustProductQuantity(
  productId: string,
  quantityChange: number,
): Promise<Product | null> {
  if (
    !Number.isFinite(
      quantityChange,
    ) ||
    quantityChange === 0
  ) {
    throw new Error(
      "Quantity change must be a valid non-zero number.",
    );
  }

  const result =
    await recordStockMovement(
      productId,
      quantityChange,
      "Stock adjustment",
      "adjustment",
    );

  return result.product;
}

/**
 * Kept for compatibility with existing
 * components.
 *
 * Supabase remains the source of truth.
 */
export function subscribeToStockMovements(
  onStoreChange: () => void,
): () => void {
  if (
    typeof window ===
    "undefined"
  ) {
    return () => {};
  }

  window.addEventListener(
    STOCK_MOVEMENT_EVENT,
    onStoreChange,
  );

  return () => {
    window.removeEventListener(
      STOCK_MOVEMENT_EVENT,
      onStoreChange,
    );
  };
}