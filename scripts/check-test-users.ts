import { db } from "@/lib/db";
async function main() {
  const users = await db.user.findMany({
    where: { isActive: true, passwordHash: { not: null } },
    select: { id: true, email: true, name: true },
    take: 5,
  });
  console.log(JSON.stringify(users));
  await db.$disconnect();
}
main().catch(console.error);
