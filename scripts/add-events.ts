/**
 * Adds the two 2026 talks announced on the department's flyers, with their
 * flyer images, to a database:
 *
 *   npm run events:add
 *
 * Safe to run again: an event whose address already exists is left alone
 * (it only gets its flyer if it has none). Flyers are uploaded to Cloudinary
 * from scripts/event-flyers/ when the Cloudinary settings are present;
 * without them the events are still added and a flyer can be attached in
 * /admin/events. Times are Africa/Lagos (UTC+1), stored as UTC.
 */
import "dotenv/config";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const PHONE = "+2348068310034";

const EVENTS = [
  {
    slug: "optimization-methods-in-machine-learning",
    title: "Optimization Methods in Machine Learning",
    type: "SPECIAL_LECTURE" as const,
    startsAt: new Date("2026-06-24T09:00:00Z"), // 10:00 WAT
    endsAt: new Date("2026-06-24T11:30:00Z"), // 12:30 WAT
    venue: "Departmental seminar room",
    speakerName: "Adebanji Adelowo",
    speakerAffiliation: "Alumnus of the Department",
    registrationUrl: "https://meet.google.com/eew-trjj-ifv",
    description:
      "A special undergraduate lecture: Optimization Methods in Machine Learning (ML): Mathematical Foundation, " +
      "Theory and Practical Python Implementation.\n\n" +
      "Topics: ML as optimization, gradient descent, loss functions, regularization, Adam and adaptive optimizers, Python.\n\n" +
      `Join online at https://meet.google.com/eew-trjj-ifv or call ${PHONE}.`,
    flyerFile: "ml-optimization-lecture.jpg",
    flyerAlt:
      "Flyer for a special undergraduate lecture on optimization methods in machine learning by Adebanji Adelowo, " +
      "24 June 2026, 10:00 AM to 12:30 PM, Departmental seminar room.",
  },
  {
    slug: "emerging-economy-relevance-of-a-mathematician",
    title: "Emerging Economy: What is the relevance of a Mathematician?",
    type: "SEMINAR" as const,
    startsAt: new Date("2026-07-08T10:00:00Z"), // 11:00 WAT
    endsAt: null,
    venue: "Departmental seminar room",
    speakerName: "Banji Osatunberu",
    speakerAffiliation: "MD/CEO, Market Scan International Nigeria",
    registrationUrl: "https://meet.google.com/wwy-ybvh-zsw",
    description:
      "A talk on the emerging economy and what a mathematician has to offer it. Starts at 11:00 am prompt.\n\n" +
      `Join online at https://meet.google.com/wwy-ybvh-zsw or call ${PHONE}.`,
    flyerFile: "emerging-economy.jpg",
    flyerAlt:
      "Flyer for a talk, Emerging Economy: What is the relevance of a Mathematician?, by Banji Osatunberu of " +
      "Market Scan International Nigeria, 8 July 2026, 11:00 am, Departmental seminar room.",
  },
];

async function main() {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const canUpload = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET,
  );
  if (canUpload) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  } else {
    console.log("Cloudinary is not configured here: events are added without flyers.");
  }

  for (const e of EVENTS) {
    const { flyerFile, flyerAlt, ...data } = e;
    let event = await db.event.findUnique({ where: { slug: e.slug } });
    if (event) {
      console.log(`"${e.title}" already exists; left alone.`);
    } else {
      event = await db.event.create({ data: { ...data, status: "PUBLISHED" } });
      console.log(`Added "${e.title}".`);
    }
    if (!event.flyerId && canUpload) {
      const uploaded = await cloudinary.uploader.upload(path.join(process.cwd(), "scripts", "event-flyers", flyerFile), {
        folder: "oau-maths/events",
        resource_type: "image",
      });
      const asset = await db.mediaAsset.create({
        data: {
          provider: "cloudinary",
          publicId: uploaded.public_id,
          url: uploaded.secure_url,
          width: uploaded.width,
          height: uploaded.height,
          bytes: uploaded.bytes,
          format: uploaded.format,
          alt: flyerAlt,
        },
      });
      await db.event.update({ where: { id: event.id }, data: { flyerId: asset.id } });
      console.log(`  Attached the flyer.`);
    }
  }
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
