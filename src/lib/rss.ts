/**
 * In-house RSS 2.0 generator for /news/rss.xml. Every text value goes
 * through escapeXml before being placed into the document, so no field
 * (title, description, link) can break out of its element or inject a
 * new one.
 */

export type RssItem = {
  title: string;
  link: string;
  description: string;
  publishedAt: Date;
  guid: string;
};

export type RssFeedInput = {
  siteUrl: string;
  title: string;
  description: string;
  items: RssItem[];
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildItem(item: RssItem): string {
  return [
    "<item>",
    `<title>${escapeXml(item.title)}</title>`,
    `<link>${escapeXml(item.link)}</link>`,
    `<description>${escapeXml(item.description)}</description>`,
    `<pubDate>${item.publishedAt.toUTCString()}</pubDate>`,
    `<guid isPermaLink="false">${escapeXml(item.guid)}</guid>`,
    "</item>",
  ].join("");
}

export function generateNewsRss(feed: RssFeedInput): string {
  const items = feed.items.map(buildItem).join("");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<rss version="2.0"><channel>` +
    `<title>${escapeXml(feed.title)}</title>` +
    `<link>${escapeXml(feed.siteUrl)}</link>` +
    `<description>${escapeXml(feed.description)}</description>` +
    items +
    `</channel></rss>`
  );
}
