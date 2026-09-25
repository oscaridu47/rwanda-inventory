import { getCurrentBusinessId } from "@/app/lib/auth";

export type SaleItem = {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;

  unitPrice: number;

  buyingPrice?: number;

  sellingPrice?: number;

  total: number;

  profit?: number;
};

export type Sale = {
  id: string;
  businessId: string;
  items: SaleItem[];
  subtotal: number;
  total: number;

  profit?: number;

  createdAt: string;
};

const SALES_STORAGE_KEY =
  "rwanda-inventory-sales";

const SALES_CHANGED_EVENT =
  "rwanda-inventory-sales-changed";

function createSaleId(): string {
  return `sale-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

/**
 * Returns every sale stored on this browser.
 *
 * This function is mainly used internally.
 * Business-specific pages should use getSales()
 * or getSalesByBusinessId().
 */
export function getAllSales(): Sale[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedSales =
      localStorage.getItem(
        SALES_STORAGE_KEY,
      );

    if (!storedSales) {
      return [];
    }

    const sales: unknown =
      JSON.parse(storedSales);

    if (!Array.isArray(sales)) {
      return [];
    }

    return sales.filter(
      (sale): sale is Sale =>
        !!sale &&
        typeof sale === "object" &&
        typeof (sale as Sale).id === "string" &&
        typeof (sale as Sale).businessId ===
          "string" &&
        Array.isArray(
          (sale as Sale).items,
        ),
    );
  } catch {
    return [];
  }
}

/**
 * Returns sales belonging ONLY to the currently
 * logged-in user's business.
 *
 * This is the important function for:
 * - Owner
 * - Manager
 * - Staff
 * - Worker
 */
export function getSales(): Sale[] {
  const businessId =
    getCurrentBusinessId();

  if (!businessId) {
    return [];
  }

  return getAllSales().filter(
    (sale) =>
      sale.businessId === businessId,
  );
}

function saveSales(
  sales: Sale[],
): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(
    SALES_STORAGE_KEY,
    JSON.stringify(sales),
  );

  window.dispatchEvent(
    new Event(SALES_CHANGED_EVENT),
  );
}

export function createSale({
  businessId,
  items,
}: {
  businessId: string;
  items: SaleItem[];
}): Sale | null {
  if (
    typeof window === "undefined" ||
    !businessId ||
    items.length === 0
  ) {
    return null;
  }

  const currentBusinessId =
    getCurrentBusinessId();

  /**
   * Prevent an employee or another account from
   * creating a sale for a different business.
   */
  if (
    !currentBusinessId ||
    businessId !== currentBusinessId
  ) {
    return null;
  }

  const cleanItems = items.filter(
    (item) =>
      item.productId &&
      item.productName &&
      item.quantity > 0 &&
      item.unitPrice >= 0 &&
      item.total >= 0,
  );

  if (cleanItems.length === 0) {
    return null;
  }

  const subtotal = cleanItems.reduce(
    (sum, item) =>
      sum + item.total,
    0,
  );

  const profit = cleanItems.reduce(
    (sum, item) =>
      sum + (item.profit ?? 0),
    0,
  );

  const sale: Sale = {
    id: createSaleId(),
    businessId:
      currentBusinessId,
    items: cleanItems,
    subtotal,
    total: subtotal,
    profit,
    createdAt:
      new Date().toISOString(),
  };

  saveSales([
    ...getAllSales(),
    sale,
  ]);

  return sale;
}

export function getSaleById(
  saleId: string,
): Sale | null {
  const businessId =
    getCurrentBusinessId();

  if (!businessId) {
    return null;
  }

  return (
    getAllSales().find(
      (sale) =>
        sale.id === saleId &&
        sale.businessId ===
          businessId,
    ) ?? null
  );
}

export function getSalesByBusinessId(
  businessId: string,
): Sale[] {
  if (
    typeof window === "undefined" ||
    !businessId
  ) {
    return [];
  }

  return getAllSales().filter(
    (sale) =>
      sale.businessId === businessId,
  );
}

export function subscribeToSales(
  callback: () => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  function handleStorageChange(
    event: StorageEvent,
  ) {
    if (
      event.key ===
      SALES_STORAGE_KEY
    ) {
      callback();
    }
  }

  window.addEventListener(
    SALES_CHANGED_EVENT,
    callback,
  );

  window.addEventListener(
    "storage",
    handleStorageChange,
  );

  return () => {
    window.removeEventListener(
      SALES_CHANGED_EVENT,
      callback,
    );

    window.removeEventListener(
      "storage",
      handleStorageChange,
    );
  };
}