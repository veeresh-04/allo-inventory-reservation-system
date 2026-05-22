import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  await prisma.reservation.deleteMany();
  await prisma.idempotencyRecord.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  const warehouses = await Promise.all([
    prisma.warehouse.create({
      data: {
        id: "wh_mumbai",
        name: "Mumbai Central",
        location: "Mumbai, Maharashtra",
      },
    }),
    prisma.warehouse.create({
      data: {
        id: "wh_delhi",
        name: "Delhi NCR Hub",
        location: "Gurugram, Haryana",
      },
    }),
    prisma.warehouse.create({
      data: {
        id: "wh_bangalore",
        name: "Bangalore Tech Park",
        location: "Bengaluru, Karnataka",
      },
    }),
  ]);

  console.log(`Created ${warehouses.length} warehouses`);

  const products = await Promise.all([
    prisma.product.create({
      data: {
        id: "prod_001",
        name: "Premium Wireless Headphones",
        description:
          "Over-ear noise-cancelling headphones with 40hr battery life and Hi-Res Audio support.",
        sku: "WH-PRO-001",
        price: new Decimal("12999.00"),
        imageUrl:
          "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&q=80",
      },
    }),
    prisma.product.create({
      data: {
        id: "prod_002",
        name: "Mechanical Keyboard TKL",
        description:
          "Tenkeyless mechanical keyboard with Cherry MX switches and RGB backlighting.",
        sku: "KB-MEC-002",
        price: new Decimal("8499.00"),
        imageUrl:
          "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=400&q=80",
      },
    }),
    prisma.product.create({
      data: {
        id: "prod_003",
        name: "4K Webcam Pro",
        description:
          "4K UHD webcam with auto-focus, built-in ring light, and noise-cancelling mic.",
        sku: "CAM-4K-003",
        price: new Decimal("6799.00"),
        imageUrl:
          "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=400&q=80",
      },
    }),
    prisma.product.create({
      data: {
        id: "prod_004",
        name: "Ergonomic Office Chair",
        description:
          "Lumbar support mesh chair with adjustable armrests and 5-year warranty.",
        sku: "CH-ERG-004",
        price: new Decimal("24999.00"),
        imageUrl:
          "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?w=400&q=80",
      },
    }),
    prisma.product.create({
      data: {
        id: "prod_005",
        name: "USB-C Hub 12-in-1",
        description:
          "12-port USB-C hub with 100W PD, 4K HDMI, SD card reader, and Gigabit Ethernet.",
        sku: "HUB-USB-005",
        price: new Decimal("3999.00"),
        imageUrl:
          "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=400&q=80",
      },
    }),
    prisma.product.create({
      data: {
        id: "prod_006",
        name: "Standing Desk Converter",
        description:
          "Height-adjustable desk converter with dual monitor support and cable management.",
        sku: "DESK-STD-006",
        price: new Decimal("15499.00"),
        imageUrl:
          "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=400&q=80",
      },
    }),
  ]);

  console.log(`Created ${products.length} products`);

  const inventoryData = [
    { productId: "prod_001", warehouseId: "wh_mumbai", totalUnits: 15, reservedUnits: 0 },
    { productId: "prod_001", warehouseId: "wh_delhi", totalUnits: 8, reservedUnits: 0 },
    { productId: "prod_001", warehouseId: "wh_bangalore", totalUnits: 3, reservedUnits: 0 },
    { productId: "prod_002", warehouseId: "wh_mumbai", totalUnits: 20, reservedUnits: 0 },
    { productId: "prod_002", warehouseId: "wh_delhi", totalUnits: 1, reservedUnits: 0 },
    { productId: "prod_002", warehouseId: "wh_bangalore", totalUnits: 12, reservedUnits: 0 },
    { productId: "prod_003", warehouseId: "wh_mumbai", totalUnits: 0, reservedUnits: 0 },
    { productId: "prod_003", warehouseId: "wh_delhi", totalUnits: 5, reservedUnits: 0 },
    { productId: "prod_003", warehouseId: "wh_bangalore", totalUnits: 7, reservedUnits: 0 },
    { productId: "prod_004", warehouseId: "wh_mumbai", totalUnits: 4, reservedUnits: 0 },
    { productId: "prod_004", warehouseId: "wh_delhi", totalUnits: 2, reservedUnits: 0 },
    { productId: "prod_004", warehouseId: "wh_bangalore", totalUnits: 6, reservedUnits: 0 },
    { productId: "prod_005", warehouseId: "wh_mumbai", totalUnits: 50, reservedUnits: 0 },
    { productId: "prod_005", warehouseId: "wh_delhi", totalUnits: 30, reservedUnits: 0 },
    { productId: "prod_005", warehouseId: "wh_bangalore", totalUnits: 25, reservedUnits: 0 },
    { productId: "prod_006", warehouseId: "wh_mumbai", totalUnits: 3, reservedUnits: 0 },
    { productId: "prod_006", warehouseId: "wh_delhi", totalUnits: 0, reservedUnits: 0 },
    { productId: "prod_006", warehouseId: "wh_bangalore", totalUnits: 5, reservedUnits: 0 },
  ];

  for (const inventory of inventoryData) {
    await prisma.inventory.create({ data: inventory });
  }

  console.log(`Created ${inventoryData.length} inventory records`);
  console.log("Seeding complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
