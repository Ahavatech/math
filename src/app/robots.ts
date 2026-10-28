import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api/",
          "/journal/dashboard",
          "/journal/reviewer",
          "/journal/submit",
          "/journal/verify",
          "/journal/register",
          "/alumni/submit",
          "/alumni/confirm",
          "/search",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
