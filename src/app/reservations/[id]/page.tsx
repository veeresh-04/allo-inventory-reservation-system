import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ReservationClient } from "@/components/ReservationClient";

export const dynamic = "force-dynamic";

interface Props {
  params: { id: string };
}

export default async function ReservationPage({ params }: Props) {
  const reservation = await prisma.reservation.findUnique({
    where: { id: params.id },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          imageUrl: true,
          description: true,
        },
      },
      warehouse: {
        select: { id: true, name: true, location: true },
      },
    },
  });

  if (!reservation) notFound();

  return (
    <ReservationClient
      reservation={{
        ...reservation,
        expiresAt: reservation.expiresAt.toISOString(),
        createdAt: reservation.createdAt.toISOString(),
        updatedAt: reservation.updatedAt.toISOString(),
        product: {
          ...reservation.product,
          price: reservation.product.price.toString(),
        },
      }}
    />
  );
}
