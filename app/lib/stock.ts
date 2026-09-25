import type { Product } from "./products";

export const STOCK_MOVEMENT_STORAGE_KEY =
  "rwanda-inventory-stock-movements";

export const STOCK_MOVEMENT_EVENT =
  "rwanda-inventory-stock-movements-changed";

export type StockMovementType = "received" | "adjustment";

export type StockMovement = {
  id: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantityChange: number;
  reason: string;
  createdAt: string;
};

function createMovementId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isStockMovement(
  value: unknown,
): value is StockMovement {
  if (!value || typeof value !== "object") {
    return false;
  }

  const movement = value as Record<string, unknown>;

  return (
    typeof movement.id === "string" &&
    typeof movement.productId === "string" &&
    typeof movement.productName === "string" &&
    (movement.type === "received" ||
      movement.type === "adjustment") &&
    typeof movement.quantityChange === "number" &&
    typeof movement.reason === "string" &&
    typeof movement.createdAt === "string"
  );
}

export function getStockMovements(): StockMovement[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(
      STOCK_MOVEMENT_STORAGE_KEY,
    );

    if (!stored) {
      return [];
    }

    const parsed: unknown = JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isStockMovement);
  } catch {
    return [];
  }
}

export function addStockMovement(
  product: Product,
  quantityChange: number,
  reason: string,
  type: StockMovementType = "received",
): StockMovement {
  if (typeof window === "undefined") {
    throw new Error("Stock can only be changed in the browser.");
  }

  if (!Number.isFinite(quantityChange) || quantityChange === 0) {
    throw new Error("Quantity change must be a valid non-zero number.");
  }

  const movement: StockMovement = {
    id: createMovementId(),
    productId: product.id,
    productName: product.name,
    type,
    quantityChange,
    reason: reason.trim(),
    createdAt: new Date().toISOString(),
  };

  const movements = getStockMovements();

  window.localStorage.setItem(
    STOCK_MOVEMENT_STORAGE_KEY,
    JSON.stringify([movement, ...movements]),
  );

  window.dispatchEvent(
    new Event(STOCK_MOVEMENT_EVENT),
  );

  return movement;
}

export function subscribeToStockMovements(
  onStoreChange: () => void,
) {
  function handleStorageChange(event: StorageEvent) {
    if (
      event.key === STOCK_MOVEMENT_STORAGE_KEY
    ) {
      onStoreChange();
    }
  }

  window.addEventListener(
    "storage",
    handleStorageChange,
  );

  window.addEventListener(
    STOCK_MOVEMENT_EVENT,
    onStoreChange,
  );

  return () => {
    window.removeEventListener(
      "storage",
      handleStorageChange,
    );

    window.removeEventListener(
      STOCK_MOVEMENT_EVENT,
      onStoreChange,
    );
  };
}