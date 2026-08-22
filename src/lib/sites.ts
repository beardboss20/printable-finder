import type { SiteId, SiteSearchLink } from "./types";

export const SITE_LABEL: Record<SiteId, string> = {
  printables: "Printables",
  thingiverse: "Thingiverse",
  thangs: "Thangs",
  makerworld: "MakerWorld",
};

export function siteSearchLinks(query: string): SiteSearchLink[] {
  const q = query.trim() || "3d printable";
  const enc = encodeURIComponent(q);
  return [
    {
      site: "printables",
      label: "Printables",
      url: `https://www.printables.com/search/models?q=${enc}`,
    },
    {
      site: "thingiverse",
      label: "Thingiverse",
      url: `https://www.thingiverse.com/search?q=${enc}&type=things&sort=relevant`,
    },
    {
      site: "thangs",
      label: "Thangs",
      url: `https://thangs.com/search/${enc}?scope=all`,
    },
    {
      site: "makerworld",
      label: "MakerWorld",
      url: `https://makerworld.com/en/search/models?keyword=${enc}`,
    },
  ];
}
