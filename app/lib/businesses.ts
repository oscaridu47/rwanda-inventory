export type BusinessStatus =
  | "pending"
  | "active"
  | "rejected"
  | "suspended";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "overdue";

export type Business = {
  id: string;
  businessName: string;
  ownerUserId: string;
  status: BusinessStatus;
  paymentStatus: PaymentStatus;
  plan: string;
  subscriptionStartDate: string | null;
  subscriptionEndDate: string | null;
  createdAt: string;
};

const BUSINESSES_STORAGE_KEY =
  "rwanda-inventory-businesses";

const BUSINESS_CHANGED_EVENT =
  "rwanda-inventory-businesses-changed";

function createBusinessId(): string {
  return `business-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

export function getBusinesses(): Business[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedBusinesses = localStorage.getItem(
      BUSINESSES_STORAGE_KEY,
    );

    if (!storedBusinesses) {
      return [];
    }

    const businesses = JSON.parse(storedBusinesses);

    if (!Array.isArray(businesses)) {
      return [];
    }

    return businesses;
  } catch {
    return [];
  }
}

function saveBusinesses(
  businesses: Business[],
): void {
  localStorage.setItem(
    BUSINESSES_STORAGE_KEY,
    JSON.stringify(businesses),
  );

  window.dispatchEvent(
    new Event(BUSINESS_CHANGED_EVENT),
  );
}

export function createBusiness({
  businessName,
  ownerUserId,
  plan = "Basic",
}: {
  businessName: string;
  ownerUserId: string;
  plan?: string;
}): Business | null {
  if (typeof window === "undefined") {
    return null;
  }

  const cleanBusinessName = businessName.trim();

  if (!cleanBusinessName || !ownerUserId) {
    return null;
  }

  const businesses = getBusinesses();

  const business: Business = {
    id: createBusinessId(),
    businessName: cleanBusinessName,
    ownerUserId,
    status: "pending",
    paymentStatus: "pending",
    plan,
    subscriptionStartDate: null,
    subscriptionEndDate: null,
    createdAt: new Date().toISOString(),
  };

  saveBusinesses([
    ...businesses,
    business,
  ]);

  return business;
}

export function getBusinessById(
  businessId: string,
): Business | null {
  const businesses = getBusinesses();

  return (
    businesses.find(
      (business) => business.id === businessId,
    ) ?? null
  );
}

export function getBusinessByOwnerUserId(
  ownerUserId: string,
): Business | null {
  const businesses = getBusinesses();

  return (
    businesses.find(
      (business) =>
        business.ownerUserId === ownerUserId,
    ) ?? null
  );
}

export function updateBusiness(
  businessId: string,
  updates: Partial<
    Pick<
      Business,
      | "businessName"
      | "status"
      | "paymentStatus"
      | "plan"
      | "subscriptionStartDate"
      | "subscriptionEndDate"
    >
  >,
): Business | null {
  if (typeof window === "undefined") {
    return null;
  }

  const businesses = getBusinesses();

  const index = businesses.findIndex(
    (business) => business.id === businessId,
  );

  if (index === -1) {
    return null;
  }

  const updatedBusiness: Business = {
    ...businesses[index],
    ...updates,
  };

  const updatedBusinesses = [...businesses];

  updatedBusinesses[index] = updatedBusiness;

  saveBusinesses(updatedBusinesses);

  return updatedBusiness;
}

export function approveBusiness(
  businessId: string,
  subscriptionDays = 30,
): Business | null {
  const now = new Date();

  const endDate = new Date(now);

  endDate.setDate(
    endDate.getDate() + subscriptionDays,
  );

  return updateBusiness(businessId, {
    status: "active",
    paymentStatus: "paid",
    subscriptionStartDate:
      now.toISOString(),
    subscriptionEndDate:
      endDate.toISOString(),
  });
}

export function rejectBusiness(
  businessId: string,
): Business | null {
  return updateBusiness(businessId, {
    status: "rejected",
  });
}

export function suspendBusiness(
  businessId: string,
): Business | null {
  return updateBusiness(businessId, {
    status: "suspended",
  });
}

export function subscribeToBusinesses(
  callback: () => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(
    BUSINESS_CHANGED_EVENT,
    callback,
  );

  return () => {
    window.removeEventListener(
      BUSINESS_CHANGED_EVENT,
      callback,
    );
  };
}