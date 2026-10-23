import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";

async function main() {
  const hash = await hashPassword("Test@1234567");
  const existing = await db.user.findUnique({ where: { email: "jwt-test@oau-maths.test" } });
  if (existing) {
    console.log("exists:", existing.id);
    await db.$disconnect();
    return;
  }
  const u = await db.user.create({
    data: {
      id: "jwt-test-user-id",
      email: "jwt-test@oau-maths.test",
      name: "JWT Test User",
      passwordHash: hash,
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });
  console.log("created:", u.id);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
