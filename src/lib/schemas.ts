import { z } from "zod";

export const CreateReservationSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  warehouseId: z.string().min(1, "Warehouse ID is required"),
  quantity: z.number().int().positive("Quantity must be a positive integer"),
});

export const ReservationParamsSchema = z.object({
  id: z.string().min(1, "Reservation ID is required"),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;
