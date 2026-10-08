import type { Product, ProductUnit } from "./products";
import { supabase } from "./supabase";

export const PACKAGING_STORAGE_KEY = "rwanda-inventory-packaging";

export const PACKAGING_STORAGE_EVENT =
  "rwanda-inventory-packaging-changed";

export type PackagingFactors = Partial<Record<ProductUnit, number>>;

export type PackagingConfig = {
  productId: string;
  baseUnit: ProductUnit;
  factors: PackagingFactors;
  updatedAt: string;
};

const VALID_UNITS: ProductUnit[] = [
  "Piece",
  "Box",
  "Pack",
  "Kg",
  "Litre",
];

/* -------------------------------------------------------------------------- */
/* Local cache                                                                */
/* -------------------------------------------------------------------------- */

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readLocalConfigs(): PackagingConfig[] {
  if (!isBrowser()) {
    return [];
  }

  try {
    const raw = localStorage.getItem(PACKAGING_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isValidPackagingConfig);
  } catch {
    return [];
  }
}

function writeLocalConfigs(configs: PackagingConfig[]): void {
  if (!isBrowser()) {
    return;
  }

  try {
    localStorage.setItem(
      PACKAGING_STORAGE_KEY,
      JSON.stringify(configs),
    );

    window.dispatchEvent(
      new CustomEvent(PACKAGING_STORAGE_EVENT),
    );
  } catch {
    // Keep the application working even if localStorage is unavailable.
  }
}

function isValidPackagingConfig(
  value: unknown,
): value is PackagingConfig {
  if (!value || typeof value !== "object") {
    return false;
  }

  const config = value as Partial<PackagingConfig>;

  if (
    typeof config.productId !== "string" ||
    typeof config.baseUnit !== "string" ||
    !config.factors ||
    typeof config.factors !== "object"
  ) {
    return false;
  }

  if (!VALID_UNITS.includes(config.baseUnit as ProductUnit)) {
    return false;
  }

  return true;
}

/* -------------------------------------------------------------------------- */
/* Local synchronous API                                                       */
/*                                                                            */
/* These functions intentionally remain synchronous.                         */
/* Stock/Sales conversion code can continue using them without becoming      */
/* async.                                                                     */
/* -------------------------------------------------------------------------- */

export function getPackagingConfigs(): PackagingConfig[] {
  return readLocalConfigs();
}

export function getPackagingConfig(
  productId: string,
): PackagingConfig | undefined {
  return readLocalConfigs().find(
    (config) => config.productId === productId,
  );
}

export function savePackagingConfig(
  config: PackagingConfig,
): void {
  const configs = readLocalConfigs();

  const normalized: PackagingConfig = {
    ...config,
    productId: config.productId.trim(),
    updatedAt:
      config.updatedAt || new Date().toISOString(),
    factors: normalizeFactors(config.factors),
  };

  const existingIndex = configs.findIndex(
    (item) => item.productId === normalized.productId,
  );

  if (existingIndex >= 0) {
    configs[existingIndex] = normalized;
  } else {
    configs.push(normalized);
  }

  writeLocalConfigs(configs);
}

export function deletePackagingConfig(
  productId: string,
): void {
  const configs = readLocalConfigs().filter(
    (config) => config.productId !== productId,
  );

  writeLocalConfigs(configs);
}

export function subscribeToPackagingConfigs(
  callback: () => void,
): () => void {
  if (!isBrowser()) {
    return () => {};
  }

  const handler = () => callback();

  window.addEventListener(
    PACKAGING_STORAGE_EVENT,
    handler,
  );

  window.addEventListener(
    "storage",
    handler,
  );

  return () => {
    window.removeEventListener(
      PACKAGING_STORAGE_EVENT,
      handler,
    );

    window.removeEventListener(
      "storage",
      handler,
    );
  };
}

/* -------------------------------------------------------------------------- */
/* Supabase                                                                    */
/* -------------------------------------------------------------------------- */

type PackagingDbRow = {
  id: string;
  business_id: string;
  product_id: string;
  base_unit: string;
  factors: Record<string, unknown> | null;
  updated_at: string;
  created_at: string;
};

function mapDbPackagingConfig(
  row: PackagingDbRow,
): PackagingConfig {
  return {
    productId: row.product_id,
    baseUnit: normalizeUnit(row.base_unit),
    factors: normalizeFactors(
      row.factors as PackagingFactors | null,
    ),
    updatedAt:
      row.updated_at || row.created_at || new Date().toISOString(),
  };
}

function normalizeUnit(value: string): ProductUnit {
  if (VALID_UNITS.includes(value as ProductUnit)) {
    return value as ProductUnit;
  }

  return "Piece";
}

function normalizeFactors(
  factors: PackagingFactors | null | undefined,
): PackagingFactors {
  const result: PackagingFactors = {};

  if (!factors) {
    return result;
  }

  for (const unit of VALID_UNITS) {
    const value = factors[unit];

    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value > 0
    ) {
      result[unit] = value;
    }
  }

  return result;
}

/**
 * Load packaging configurations from Supabase and refresh
 * the local cache.
 *
 * This is intentionally async because Supabase is remote.
 */
export async function loadPackagingConfigsFromSupabase(
  businessId: string,
): Promise<PackagingConfig[]> {
  if (!businessId) {
    return [];
  }

  const { data, error } = await supabase
    .from("packaging_configs")
    .select(
      "id,business_id,product_id,base_unit,factors,updated_at,created_at",
    )
    .eq("business_id", businessId)
    .order("updated_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      "Failed to load packaging configurations:",
      error,
    );

    // Offline fallback.
    return readLocalConfigs();
  }

  const configs = (data ?? []).map(
    (row) =>
      mapDbPackagingConfig(
        row as PackagingDbRow,
      ),
  );

  writeLocalConfigs(configs);

  return configs;
}

/**
 * Load one product's packaging configuration from Supabase.
 *
 * The local cache is used as fallback when offline.
 */
export async function loadPackagingConfigFromSupabase(
  businessId: string,
  productId: string,
): Promise<PackagingConfig | undefined> {
  if (!businessId || !productId) {
    return getPackagingConfig(productId);
  }

  const { data, error } = await supabase
    .from("packaging_configs")
    .select(
      "id,business_id,product_id,base_unit,factors,updated_at,created_at",
    )
    .eq("business_id", businessId)
    .eq("product_id", productId)
    .maybeSingle();

  if (error) {
    console.error(
      "Failed to load packaging configuration:",
      error,
    );

    return getPackagingConfig(productId);
  }

  if (!data) {
    return undefined;
  }

  const config = mapDbPackagingConfig(
    data as PackagingDbRow,
  );

  savePackagingConfig(config);

  return config;
}

/**
 * Save packaging configuration to Supabase.
 *
 * We use upsert because there is a unique constraint on:
 * business_id + product_id
 */
export async function savePackagingConfigToSupabase(
  businessId: string,
  config: PackagingConfig,
): Promise<PackagingConfig> {
  if (!businessId) {
    throw new Error(
      "A business ID is required to save packaging configuration.",
    );
  }

  const normalized: PackagingConfig = {
    ...config,
    productId: config.productId.trim(),
    updatedAt: new Date().toISOString(),
    factors: normalizeFactors(config.factors),
  };

  const { data, error } = await supabase
    .from("packaging_configs")
    .upsert(
      {
        business_id: businessId,
        product_id: normalized.productId,
        base_unit: normalized.baseUnit,
        factors: normalized.factors,
        updated_at: normalized.updatedAt,
      },
      {
        onConflict: "business_id,product_id",
      },
    )
    .select(
      "id,business_id,product_id,base_unit,factors,updated_at,created_at",
    )
    .single();

  if (error) {
    throw new Error(
      error.message ||
        "Failed to save packaging configuration.",
    );
  }

  const saved = mapDbPackagingConfig(
    data as PackagingDbRow,
  );

  // Keep the local cache updated for offline use.
  savePackagingConfig(saved);

  return saved;
}

/**
 * Delete packaging configuration from Supabase.
 */
export async function deletePackagingConfigFromSupabase(
  businessId: string,
  productId: string,
): Promise<void> {
  if (!businessId) {
    throw new Error(
      "A business ID is required.",
    );
  }

  const { error } = await supabase
    .from("packaging_configs")
    .delete()
    .eq("business_id", businessId)
    .eq("product_id", productId);

  if (error) {
    throw new Error(
      error.message ||
        "Failed to delete packaging configuration.",
    );
  }

  deletePackagingConfig(productId);
}

/* -------------------------------------------------------------------------- */
/* Defaults                                                                    */
/* -------------------------------------------------------------------------- */

export function createDefaultPackagingConfig(
  product: Product,
): PackagingConfig {
  const baseUnit = product.unit;

  const factors: PackagingFactors = {
    [baseUnit]: 1,
  };

  if (
    product.packageUnit &&
    typeof product.unitsPerPackage === "number" &&
    product.unitsPerPackage > 0
  ) {
    factors[product.packageUnit] =
      product.unitsPerPackage;
  }

  return {
    productId: product.id,
    baseUnit,
    factors,
    updatedAt: new Date().toISOString(),
  };
}

export function getDefaultPackagingConfig(
  product: Product,
): PackagingConfig {
  const existing = getPackagingConfig(product.id);

  if (existing) {
    return existing;
  }

  return createDefaultPackagingConfig(product);
}

/* -------------------------------------------------------------------------- */
/* Conversion helpers                                                          */
/* -------------------------------------------------------------------------- */

export function getUnitFactor(
  config: PackagingConfig,
  unit: ProductUnit,
): number | undefined {
  if (unit === config.baseUnit) {
    return 1;
  }

  const value = config.factors?.[unit];

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return undefined;
  }

  return value;
}

export function isUnitConfigured(
  config: PackagingConfig,
  unit: ProductUnit,
): boolean {
  return getUnitFactor(config, unit) !== undefined;
}

export function toBaseQuantity(
  config: PackagingConfig,
  quantity: number,
  unit: ProductUnit,
): number {
  if (!Number.isFinite(quantity)) {
    return 0;
  }

  const factor = getUnitFactor(config, unit);

  if (!factor) {
    return 0;
  }

  return quantity * factor;
}

export function fromBaseQuantity(
  config: PackagingConfig,
  baseQuantity: number,
  unit: ProductUnit,
): number {
  if (!Number.isFinite(baseQuantity)) {
    return 0;
  }

  const factor = getUnitFactor(config, unit);

  if (!factor) {
    return 0;
  }

  return baseQuantity / factor;
}

export function convertQuantity(
  config: PackagingConfig,
  quantity: number,
  fromUnit: ProductUnit,
  toUnit: ProductUnit,
): number {
  if (!Number.isFinite(quantity)) {
    return 0;
  }

  if (fromUnit === toUnit) {
    return quantity;
  }

  const baseQuantity = toBaseQuantity(
    config,
    quantity,
    fromUnit,
  );

  return fromBaseQuantity(
    config,
    baseQuantity,
    toUnit,
  );
}

export function canConvertQuantity(
  config: PackagingConfig,
  fromUnit: ProductUnit,
  toUnit: ProductUnit,
): boolean {
  return (
    isUnitConfigured(config, fromUnit) &&
    isUnitConfigured(config, toUnit)
  );
}

export function unitAllowsFraction(
  unit: ProductUnit,
): boolean {
  return unit === "Kg" || unit === "Litre";
}

export function validateQuantityForUnit(
  quantity: number,
  unit: ProductUnit,
): boolean {
  if (!Number.isFinite(quantity)) {
    return false;
  }

  if (quantity <= 0) {
    return false;
  }

  if (unitAllowsFraction(unit)) {
    return true;
  }

  return Number.isInteger(quantity);
}

/* -------------------------------------------------------------------------- */
/* Stock calculations                                                          */
/* -------------------------------------------------------------------------- */

export function calculateAvailableBaseStock(
  product: Product,
): number {
  const config = getPackagingConfig(product.id);

  if (!config) {
    return product.quantity;
  }

  return toBaseQuantity(
    config,
    product.quantity,
    product.unit,
  );
}

export function calculateQuantityInUnit(
  product: Product,
  unit: ProductUnit,
): number {
  const config = getPackagingConfig(product.id);

  if (!config) {
    if (unit === product.unit) {
      return product.quantity;
    }

    return 0;
  }

  const baseQuantity =
    calculateAvailableBaseStock(product);

  return fromBaseQuantity(
    config,
    baseQuantity,
    unit,
  );
}

/* -------------------------------------------------------------------------- */
/* Utility helpers                                                             */
/* -------------------------------------------------------------------------- */

export function clonePackagingConfig(
  config: PackagingConfig,
): PackagingConfig {
  return {
    ...config,
    factors: {
      ...config.factors,
    },
  };
}

export function removePackagingForMissingProducts(
  products: Product[],
): void {
  const productIds = new Set(
    products.map((product) => product.id),
  );

  const configs = readLocalConfigs();

  const filtered = configs.filter((config) =>
    productIds.has(config.productId),
  );

  if (filtered.length !== configs.length) {
    writeLocalConfigs(filtered);
  }
}

export function generatePackagingConfigId(
  productId: string,
): string {
  return `packaging-${productId}`;
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

export function isValidPackagingFactor(
  value: unknown,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  );
}

export function validatePackagingFactors(
  factors: PackagingFactors,
): string[] {
  const errors: string[] = [];

  for (const unit of VALID_UNITS) {
    const value = factors[unit];

    if (value === undefined) {
      continue;
    }

    if (!isValidPackagingFactor(value)) {
      errors.push(
        `${unit} conversion factor must be greater than 0.`,
      );
    }
  }

  return errors;
}