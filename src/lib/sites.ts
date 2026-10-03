import type { LinkSiteId, SiteId, SiteSearchLink } from "./types";

export const SITE_LABEL: Record<SiteId, string> = {
  printables: "Printables",
  thingiverse: "Thingiverse",
  thangs: "Thangs",
  makerworld: "MakerWorld",
};

const LINK_LABEL: Record<LinkSiteId, string> = {
  ...SITE_LABEL,
  cults3d: "Cults3D",
  myminifactory: "MyMiniFactory",
};

export function siteSearchLinks(query: string): SiteSearchLink[] {
  const q = query.trim() || "3d printable";
  const enc = encodeURIComponent(q);
  const links: { site: LinkSiteId; url: string }[] = [
    { site: "printables", url: `https://www.printables.com/search/models?q=${enc}` },
    {
      site: "thingiverse",
      url: `https://www.thingiverse.com/search?q=${enc}&type=things&sort=relevant`,
    },
    { site: "thangs", url: `https://thangs.com/search/${enc}?scope=all` },
    { site: "makerworld", url: `https://makerworld.com/en/search/models?keyword=${enc}` },
    { site: "cults3d", url: `https://cults3d.com/en/search?q=${enc}` },
    { site: "myminifactory", url: `https://www.myminifactory.com/search/?query=${enc}` },
  ];
  return links.map((link) => ({
    site: link.site,
    label: LINK_LABEL[link.site],
    url: link.url,
  }));
}
