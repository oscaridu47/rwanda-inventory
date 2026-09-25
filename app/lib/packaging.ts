import {
  Product,
  ProductUnit,
  productUnits,
} from "./products";

export const PACKAGING_STORAGE_KEY =
  "rwanda-inventory-packaging";

export const PACKAGING_STORAGE_EVENT =
  "rwanda-inventory-packaging-changed";

export type PackagingFactors = Partial<
  Record<ProductUnit, number>
>;

export type PackagingConfig = {
  productId: string;
  baseUnit: ProductUnit;
  factors: PackagingFactors;
  updatedAt: string;
};

function createPackagingId() {
  return `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function isValidProductUnit(
  value: unknown,
): value is ProductUnit {
  return (
    typeof value === "string" &&
    productUnits.includes(value as ProductUnit)
  );
}

function isValidPackagingFactors(
  value: unknown,
): value is PackagingFactors {
  if (!value || typeof value !== "object") {
    return false;
  }

  const factors = value as Record<string, unknown>;

  for (const [unit, factor] of Object.entries(factors)) {
    if (!isValidProductUnit(unit)) {
      return false;
    }

    if (
      typeof factor !== "number" ||
      !Number.isFinite(factor) ||
      factor <= 0
    ) {
      return false;
    }
  }

  return true;
}

function isPackagingConfig(
  value: unknown,
): value is PackagingConfig {
  if (!value || typeof value !== "object") {
    return false;
  }

  const config = value as Record<string, unknown>;

  return (
    typeof config.productId === "string" &&
    isValidProductUnit(config.baseUnit) &&
    isValidPackagingFactors(config.factors) &&
    typeof config.updatedAt === "string"
  );
}

export function getPackagingConfigs(): PackagingConfig[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(
      PACKAGING_STORAGE_KEY,
    );

    if (!stored) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isPackagingConfig);
  } catch {
    return [];
  }
}

export function getPackagingConfig(
  productId: string,
): PackagingConfig | null {
  const configs = getPackagingConfigs();

  return (
    configs.find(
      (config) => config.productId === productId,
    ) ?? null
  );
}

function persistPackagingConfigs(
  configs: PackagingConfig[],
) {
  if (typeof window === "undefined") {
    throw new Error(
      "Packaging settings can only be changed in the browser.",
    );
  }

  window.localStorage.setItem(
    PACKAGING_STORAGE_KEY,
    JSON.stringify(configs),
  );

  window.dispatchEvent(
    new Event(PACKAGING_STORAGE_EVENT),
  );
}

export function createDefaultPackagingConfig(
  product: Product,
): PackagingConfig {
  return {
    productId: product.id,
    baseUnit: product.unit,
    factors: {
      [product.unit]: 1,
    },
    updatedAt: new Date().toISOString(),
  };
}

export function savePackagingConfig(
  config: PackagingConfig,
): PackagingConfig {
  if (typeof window === "undefined") {
    throw new Error(
      "Packaging settings can only be changed in the browser.",
    );
  }

  if (!isValidProductUnit(config.baseUnit)) {
    throw new Error("Invalid base unit.");
  }

  if (!isValidPackagingFactors(config.factors)) {
    throw new Error(
      "Packaging factors must contain valid positive numbers.",
    );
  }

  const baseUnitFactor =
    config.factors[config.baseUnit];

  if (
    typeof baseUnitFactor !== "number" ||
    baseUnitFactor !== 1
  ) {
    throw new Error(
      "The base unit must always have a conversion factor of 1.",
    );
  }

  const updatedConfig: PackagingConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
  };

  const existingConfigs = getPackagingConfigs();

  const existingIndex = existingConfigs.findIndex(
    (item) => item.productId === config.productId,
  );

  if (existingIndex === -1) {
    persistPackagingConfigs([
      ...existingConfigs,
      updatedConfig,
    ]);
  } else {
    const updatedConfigs = [...existingConfigs];

    updatedConfigs[existingIndex] = updatedConfig;

    persistPackagingConfigs(updatedConfigs);
  }

  return updatedConfig;
}

export function deletePackagingConfig(
  productId: string,
): boolean {
  if (typeof window === "undefined") {
    throw new Error(
      "Packaging settings can only be changed in the browser.",
    );
  }

  const existingConfigs = getPackagingConfigs();

  const remainingConfigs = existingConfigs.filter(
    (config) => config.productId !== productId,
  );

  if (
    remainingConfigs.length === existingConfigs.length
  ) {
    return false;
  }

  persistPackagingConfigs(remainingConfigs);

  return true;
}

export function subscribeToPackagingConfigs(
  onStoreChange: () => void,
) {
  function handleStorageChange(
    event: StorageEvent,
  ) {
    if (
      event.key === PACKAGING_STORAGE_KEY
    ) {
      onStoreChange();
    }
  }

  window.addEventListener(
    "storage",
    handleStorageChange,
  );

  window.addEventListener(
    PACKAGING_STORAGE_EVENT,
    onStoreChange,
  );

  return () => {
    window.removeEventListener(
      "storage",
      handleStorageChange,
    );

    window.removeEventListener(
      PACKAGING_STORAGE_EVENT,
      onStoreChange,
    );
  };
}

export function getUnitFactor(
  config: PackagingConfig,
  unit: ProductUnit,
): number | null {
  const factor = config.factors[unit];

  if (
    typeof factor !== "number" ||
    !Number.isFinite(factor) ||
    factor <= 0
  ) {
    return null;
  }

  return factor;
}

export function isUnitConfigured(
  config: PackagingConfig,
  unit: ProductUnit,
): boolean {
  return getUnitFactor(config, unit) !== null;
}

export function toBaseQuantity(
  quantity: number,
  unit: ProductUnit,
  config: PackagingConfig,
): number {
  if (
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    throw new Error(
      "Quantity must be greater than zero.",
    );
  }

  const factor = getUnitFactor(config, unit);

  if (factor === null) {
    throw new Error(
      `${unit} is not configured for this product.`,
    );
  }

  return quantity * factor;
}

export function fromBaseQuantity(
  baseQuantity: number,
  unit: ProductUnit,
  config: PackagingConfig,
): number {
  if (
    !Number.isFinite(baseQuantity) ||
    baseQuantity < 0
  ) {
    throw new Error(
      "Base quantity must be zero or greater.",
    );
  }

  const factor = getUnitFactor(config, unit);

  if (factor === null) {
    throw new Error(
      `${unit} is not configured for this product.`,
    );
  }

  return baseQuantity / factor;
}

export function convertQuantity(
  quantity: number,
  fromUnit: ProductUnit,
  toUnit: ProductUnit,
  config: PackagingConfig,
): number {
  const baseQuantity = toBaseQuantity(
    quantity,
    fromUnit,
    config,
  );

  return fromBaseQuantity(
    baseQuantity,
    toUnit,
    config,
  );
}

export function canConvertQuantity(
  fromUnit: ProductUnit,
  toUnit: ProductUnit,
  config: PackagingConfig,
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
): string | null {
  if (!Number.isFinite(quantity)) {
    return "Quantity must be a valid number.";
  }

  if (quantity <= 0) {
    return "Quantity must be greater than zero.";
  }

  if (
    !unitAllowsFraction(unit) &&
    !Number.isInteger(quantity)
  ) {
    return `${unit} quantity must be a whole number.`;
  }

  return null;
}

export function getDefaultPackagingConfig(
  product: Product,
): PackagingConfig {
  const existingConfig =
    getPackagingConfig(product.id);

  if (existingConfig) {
    return existingConfig;
  }

  return createDefaultPackagingConfig(product);
}

export function calculateAvailableBaseStock(
  product: Product,
  config: PackagingConfig,
): number {
  return toBaseQuantity(
    product.quantity,
    product.unit,
    config,
  );
}

export function calculateQuantityInUnit(
  product: Product,
  targetUnit: ProductUnit,
  config?: PackagingConfig | null,
): number {
  const activeConfig =
    config ?? getPackagingConfig(product.id);

  if (!activeConfig) {
    if (product.unit === targetUnit) {
      return product.quantity;
    }

    throw new Error(
      "Packaging configuration is required for this conversion.",
    );
  }

  return convertQuantity(
    product.quantity,
    product.unit,
    targetUnit,
    activeConfig,
  );
}

export function clonePackagingConfig(
  config: PackagingConfig,
): PackagingConfig {
  return {
    productId: config.productId,
    baseUnit: config.baseUnit,
    factors: {
      ...config.factors,
    },
    updatedAt: config.updatedAt,
  };
}

export function removePackagingForMissingProducts(
  products: Product[],
): number {
  if (typeof window === "undefined") {
    return 0;
  }

  const validProductIds = new Set(
    products.map((product) => product.id),
  );

  const configs = getPackagingConfigs();

  const filteredConfigs = configs.filter(
    (config) =>
      validProductIds.has(config.productId),
  );

  if (
    filteredConfigs.length === configs.length
  ) {
    return 0;
  }

  persistPackagingConfigs(filteredConfigs);

  return configs.length - filteredConfigs.length;
}

export function generatePackagingConfigId() {
  return createPackagingId();
}