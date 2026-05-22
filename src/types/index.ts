import { ReservationStatus } from "@prisma/client";

export type { ReservationStatus };

export interface ProductWithInventory {
  id: string;
  name: string;
  description: string | null;
  sku: string;
  price: string;
  imageUrl: string | null;
  inventory: InventoryItem[];
}

export interface InventoryItem {
  id: string;
  warehouseId: string;
  warehouse: {
    id: string;
    name: string;
    location: string;
  };
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
}

export interface WarehouseWithStock {
  id: string;
  name: string;
  location: string;
}

export interface ReservationDetail {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
    price: string;
    imageUrl: string | null;
  };
  warehouse: {
    id: string;
    name: string;
    location: string;
  };
}

export interface ApiError {
  error: string;
  code?: string;
}
