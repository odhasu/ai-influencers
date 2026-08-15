import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://authenticresell.com",
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: "https://authenticresell.com/privacy",
      changeFrequency: "yearly",
      priority: 0.3
    },
    {
      url: "https://authenticresell.com/terms",
      changeFrequency: "yearly",
      priority: 0.3
    }
  ];
}
