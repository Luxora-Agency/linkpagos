import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { hash } from "bcryptjs";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create superadmin user
  const hashedPassword = await hash("Admin123!", 12);

  const superadmin = await prisma.user.upsert({
    where: { email: "admin@linkpagos.com" },
    update: {},
    create: {
      email: "admin@linkpagos.com",
      password: hashedPassword,
      name: "Super Admin",
      role: "SUPERADMIN",
      isActive: true,
    },
  });

  console.log("Created superadmin user:", superadmin.email);
  console.log("\nDefault credentials:");
  console.log("Email: admin@linkpagos.com");
  console.log("Password: Admin123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
