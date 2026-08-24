import { PrismaClient } from "@prisma/client";

declare var console: any;
const prisma = new PrismaClient();

async function main() {
  console.log("Testing database connection...");
  const users = await prisma.user.findMany({ take: 5 });
  console.log("Connected successfully! Found users:", users.length);
  for (const user of users) {
    console.log(`- ${user.email} (${user.role})`);
  }
}

main()
  .catch((err) => {
    console.error("Database connection failed:", err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
