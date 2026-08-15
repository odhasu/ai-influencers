import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/dashboard/", "/api/"]
    },
    sitemap: "https://authenticresell.com/sitemap.xml",
    host: "https://authenticresell.com"
  };
}
