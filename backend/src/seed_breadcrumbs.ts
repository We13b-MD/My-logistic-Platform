import { prisma } from "./config/prisma";

async function simulateDriverBreadcrumbs() {
  console.log("🚚 Simulating driver GPS breadcrumb trail...");

  // 1. Find the assigned delivery (Surulere to Yaba)
  const delivery = await prisma.delivery.findFirst({
    where: { deliveryOtp: "542381" },
    include: { driver: true },
  });

  if (!delivery || !delivery.driverId) {
    console.error("❌ Delivery 542381 not found or has no assigned driver.");
    return;
  }

  // Clear any existing breadcrumbs for this test delivery
  await prisma.locationBreadcrumb.deleteMany({
    where: { deliveryId: delivery.id },
  });

  // Simulated GPS route: Starts at Surulere, makes a suspicious diversion towards Iponri, then heads back to Yaba
  const simulatedGpsPoints = [
    { lat: 6.5020, lng: 3.3580, timeOffsetSec: 0  }, // Pickup Point: Surulere Mall
    { lat: 6.4950, lng: 3.3610, timeOffsetSec: 120 }, // Moving south-east
    { lat: 6.4890, lng: 3.3650, timeOffsetSec: 300 }, // ⚠️ SUSPICIOUS DIVERSION OFF-ROUTE towards Iponri
    { lat: 6.4885, lng: 3.3655, timeOffsetSec: 900 }, // ⚠️ Stationed at unauthorized transload spot (10 mins)
    { lat: 6.5050, lng: 3.3700, timeOffsetSec: 1200 }, // Returning back towards route
    { lat: 6.5182, lng: 3.3769, timeOffsetSec: 1500 }, // Destination: Herbert Macaulay Way, Yaba
  ];

  const now = new Date();

  for (let i = 0; i < simulatedGpsPoints.length; i++) {
    const point = simulatedGpsPoints[i];
    const recordedAt = new Date(now.getTime() - (1500 - point.timeOffsetSec) * 1000);

    await prisma.locationBreadcrumb.create({
      data: {
        driverId: delivery.driverId,
        deliveryId: delivery.id,
        latitude: point.lat,
        longitude: point.lng,
        recordedAt: recordedAt,
      },
    });
  }

  console.log(`✅ Successfully inserted ${simulatedGpsPoints.length} GPS breadcrumbs for Delivery ${delivery.id}!`);
}

simulateDriverBreadcrumbs()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
