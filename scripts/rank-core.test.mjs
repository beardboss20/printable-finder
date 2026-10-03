import assert from "node:assert/strict";
import test from "node:test";
import {
  analysisFromText,
  computeVerdict,
  dedupeModels,
  isUsableThumbnailUrl,
  lexicalScore,
  lexicalToTen,
  mapMakerWorldPayload,
  mapPrintablesPayload,
  mapThangsPayload,
  mapThingiversePayload,
  mergeModels,
  normalizeAnalysis,
  parseAnalysis,
  prefilterCandidates,
} from "../src/lib/rank-core.js";

const cable = {
  category: "cable management",
  specificName: "cable clip",
  genericName: "cable clip",
  distinguishingFeatures: ["small hinged jaw"],
  shape: "clip",
  materialGuess: "plastic",
  kind: "functional_part",
  isLikelyPrintable: true,
  confidence: "high",
  searchQueries: ["cable clip", "cord organizer", "desk cable holder", "cable management clip"],
  synonyms: ["cord organizer"],
  excludePhrases: [],
  identificationNote: "",
  starterIdeas: ["Box it.", "Hollow it."],
};

function model(partial) {
  return {
    id: partial.id || partial.title,
    title: partial.title,
    url: partial.url,
    imageUrl: partial.imageUrl ?? null,
    site: partial.site || "printables",
    likes: partial.likes ?? 0,
    downloads: partial.downloads ?? 0,
    author: partial.author ?? null,
  };
}

test("lexical score prefers the named object and rejects excluded phrases", () => {
  const clip = lexicalScore(
    model({ title: "Desk cable clip", url: "https://example.com/a" }),
    cable,
  );
  const synonym = lexicalScore(
    model({ title: "Under-desk cord organizer", url: "https://example.com/b" }),
    cable,
  );
  const cat = lexicalScore(model({ title: "Cat sculpture", url: "https://example.com/c" }), cable);
  assert.ok(clip > synonym);
  assert.ok(synonym > cat);
  assert.equal(cat, 0);

  const banned = lexicalScore(model({ title: "iPhone 15 case", url: "https://example.com/d" }), {
    ...cable,
    specificName: "phone stand",
    excludePhrases: ["case", "cover"],
  });
  assert.equal(banned, -1);
});

test("lexical scores stay below an exact visual match", () => {
  const strong = lexicalScore(
    model({ title: "Cable clip", url: "https://example.com/a", likes: 20000, downloads: 90000 }),
    cable,
  );
  assert.ok(lexicalToTen(strong) <= 7);
  assert.ok(lexicalToTen(strong) >= 5);
  assert.equal(lexicalToTen(-1), 0);
});

test("prefilter keeps thumbnail candidates and drops excluded titles", () => {
  const models = [
    model({
      title: "Phone case",
      url: "https://example.com/case",
      imageUrl: "https://cdn.example/case.jpg",
    }),
    model({
      title: "Plain phone stand",
      url: "https://example.com/stand-photo",
      imageUrl: "https://cdn.example/stand.jpg",
    }),
    model({ title: "Hidden phone stand", url: "https://example.com/stand-text" }),
    model({
      title: "Cat sculpture",
      url: "https://example.com/cat",
      imageUrl: "https://cdn.example/cat.jpg",
    }),
  ];
  const analysis = normalizeAnalysis(
    {
      ...cable,
      specificName: "phone",
      genericName: "phone",
      kind: "electronic_device",
      searchQueries: ["phone", "iphone", "smartphone", "mobile phone"],
      synonyms: [],
      excludePhrases: [],
    },
    "",
  );
  const picked = prefilterCandidates(models, analysis, 2);
  assert.equal(picked.length, 2);
  assert.equal(picked[0].title, "Plain phone stand");
  assert.equal(picked[1].title, "Hidden phone stand");
  assert.ok(picked.every((entry) => !/case/i.test(entry.title)));
});

test("dedupe and merge collapse urls and normalized titles", () => {
  const first = model({
    title: "Cable Clip!",
    url: "https://www.printables.com/model/1",
  });
  const sameUrl = model({
    title: "Different name",
    url: "https://www.printables.com/model/1/",
  });
  const sameTitle = model({
    title: "cable clip",
    url: "https://thangs.com/m/9?ref=search",
  });
  const other = model({
    title: "Headphone hook",
    url: "https://makerworld.com/en/models/3",
  });
  const merged = mergeModels(
    [
      [first, sameUrl],
      [sameTitle, other],
    ],
    10,
  );
  assert.deepEqual(
    merged.map((entry) => entry.url),
    [first.url, other.url],
  );
  assert.equal(dedupeModels([other, first, sameTitle], 1)[0].title, "Headphone hook");
});

test("verdict requires vision for an exact match", () => {
  assert.equal(computeVerdict({ topScore10: 8, usedVision: true }).verdict, "exact");
  assert.equal(
    computeVerdict({ topScore10: 8, usedVision: true }).verdictTitle,
    "Yes — a printable match exists",
  );
  assert.equal(computeVerdict({ topScore10: 9.5, usedVision: false }).verdict, "similar");
  assert.equal(
    computeVerdict({ topScore10: 5, usedVision: false }).verdictTitle,
    "Similar designs exist",
  );
  assert.equal(computeVerdict({ topScore10: 4.9, usedVision: true }).verdict, "none");
  assert.equal(computeVerdict({ topScore10: 0, usedVision: false }).verdictTitle, "Nothing close");
});

test("analysis parsing keeps structure and falls back without inventing a generic object", () => {
  const raw = `note {"category":"tool","specificName":"KLAMMA cable clip","genericName":"cable clip","distinguishingFeatures":["locking jaw","desk mount"],"shape":"small clip","materialGuess":"PLA","kind":"functional_part","isLikelyPrintable":true,"confidence":"high","searchQueries":["klamma","cable clip","cord organizer","desk cable holder","extra one","sixth","seventh"],"synonyms":["cord clip"],"excludePhrases":["gripper"],"identificationNote":"","starterIdeas":["Start with a box.","Add a cylinder."]} trailing`;
  const parsed = parseAnalysis(raw, "");
  assert.equal(parsed.specificName, "KLAMMA cable clip");
  assert.equal(parsed.kind, "functional_part");
  assert.equal(parsed.searchQueries.length, 6);
  assert.deepEqual(parsed.distinguishingFeatures, ["locking jaw", "desk mount"]);
  assert.equal(parseAnalysis("not json", "").specificName, "");
  assert.equal(parseAnalysis("not json", "").searchQueries.length, 0);
  assert.equal(parseAnalysis("{", "baseball").specificName, "baseball");
  const junk = normalizeAnalysis(analysisFromText(""), "");
  assert.equal(junk.searchQueries.length, 0);
  assert.equal(junk.specificName, "");
  assert.doesNotMatch(JSON.stringify(junk), /3D printable object/i);
});

test("finished devices become accessory searches unless the user named the part", () => {
  const phone = normalizeAnalysis(
    {
      ...cable,
      category: "electronics",
      specificName: "iPhone 15",
      genericName: "phone",
      kind: "electronic_device",
      searchQueries: ["iphone", "phone", "smartphone", "mobile phone"],
      synonyms: ["mobile"],
      excludePhrases: [],
      isLikelyPrintable: false,
    },
    "",
  );
  assert.equal(phone.specificName, "iphone stand");
  assert.ok(phone.searchQueries.includes("phone stand"));
  assert.ok(phone.excludePhrases.includes("case"));
  assert.match(phone.identificationNote, /iPhone/);
  assert.equal(phone.kind, "functional_part");
  assert.equal(phone.searchQueries.includes("iphone"), false);

  const cased = normalizeAnalysis(
    {
      ...cable,
      specificName: "iPhone",
      genericName: "phone",
      kind: "electronic_device",
      searchQueries: ["phone stand", "phone dock", "phone holder", "phone case"],
      excludePhrases: ["case", "cover"],
    },
    "phone case",
  );
  assert.equal(cased.specificName, "phone case");
  assert.equal(cased.searchQueries[0], "phone case");
  assert.equal(
    cased.searchQueries.some((query) => /\bstand\b/i.test(query)),
    false,
  );
  assert.equal(cased.excludePhrases.includes("case"), false);

  const baseball = normalizeAnalysis(analysisFromText("baseball"), "baseball");
  assert.deepEqual(baseball.searchQueries, ["baseball"]);

  const figurine = normalizeAnalysis(
    {
      ...cable,
      specificName: "phone",
      genericName: "phone",
      kind: "toy_figure",
      searchQueries: ["phone figurine", "cute phone", "phone toy", "kawaii phone"],
    },
    "",
  );
  assert.equal(figurine.specificName, "phone");
  assert.ok(figurine.searchQueries.includes("phone figurine"));

  const webcam = normalizeAnalysis(
    {
      ...cable,
      specificName: "webcam",
      genericName: "webcam",
      kind: "electronic_device",
      searchQueries: ["webcam", "web camera", "usb camera", "logitech webcam"],
      synonyms: [],
    },
    "webcam",
  );
  assert.equal(webcam.specificName, "webcam stand");
  assert.equal(webcam.searchQueries[0], "webcam stand");
  assert.equal(webcam.searchQueries.includes("webcam"), false);
});

test("thumbnail filter accepts jpg and png only", () => {
  assert.equal(isUsableThumbnailUrl("https://cdn.example.com/a.jpg"), true);
  assert.equal(isUsableThumbnailUrl("https://cdn.example.com/a.JPEG"), true);
  assert.equal(isUsableThumbnailUrl("https://cdn.example.com/hero.png?size=large"), true);
  assert.equal(isUsableThumbnailUrl("http://cdn.example.com/a.PNG"), true);
  assert.equal(isUsableThumbnailUrl("https://cdn.example.com/render?format=jpg"), true);
  assert.equal(isUsableThumbnailUrl("https://cdn.example.com/a.webp"), false);
  assert.equal(isUsableThumbnailUrl("https://cdn.example.com/a.gif"), false);
  assert.equal(isUsableThumbnailUrl("data:image/jpeg;base64,abc"), true);
  assert.equal(isUsableThumbnailUrl("data:image/png;base64,abc"), true);
  assert.equal(isUsableThumbnailUrl("data:image/webp;base64,abc"), false);
  assert.equal(isUsableThumbnailUrl(""), false);
  assert.equal(isUsableThumbnailUrl(null), false);
  assert.equal(isUsableThumbnailUrl("javascript:alert(1)"), false);
});

test("catalog mappers keep free models and build direct urls", () => {
  const printables = mapPrintablesPayload({
    data: {
      result: {
        items: [
          {
            id: "359285",
            name: "KLAMMA - Locking Cable Clip",
            slug: "klamma-locking-cable-clip",
            likesCount: 10,
            downloadCount: 20,
            image: { filePath: "media/prints/hero.png" },
            user: { publicUsername: "FH" },
          },
          { id: "", name: "skip me" },
        ],
      },
    },
  });
  assert.equal(printables.length, 1);
  assert.equal(
    printables[0].url,
    "https://www.printables.com/model/359285-klamma-locking-cable-clip",
  );
  assert.equal(printables[0].imageUrl, "https://media.printables.com/media/prints/hero.png");
  assert.equal(printables[0].author, "FH");

  const thangs = mapThangsPayload(
    {
      results: [
        {
          modelId: "1",
          name: "Free clip",
          thumbnailUrl: "https://cdn.example/clip.png",
          marketplaceInfo: null,
          ownerUsername: "Ada",
          likesCount: 3,
        },
        {
          modelId: "2",
          name: "Paid clip",
          thumbnailUrl: "https://cdn.example/paid.jpg",
          marketplaceInfo: { price: 5 },
        },
      ],
    },
    8,
  );
  assert.deepEqual(
    thangs.map((entry) => entry.title),
    ["Free clip"],
  );
  assert.equal(thangs[0].url, "https://thangs.com/m/1");

  const makerworld = mapMakerWorldPayload({
    hits: [
      {
        id: 42,
        title: "Cable Clip",
        slug: "cable-clip",
        cover: "https://cdn.example/cover.jpg",
        likeCount: 8,
        downloadCount: 9,
        designCreator: { name: "Matthew Ghost", handle: "MatthewGhost" },
      },
      { id: 7, title: "Skip", nsfw: true, cover: "https://cdn.example/no.jpg" },
    ],
  });
  assert.equal(makerworld.length, 1);
  assert.equal(makerworld[0].url, "https://makerworld.com/en/models/42-cable-clip");
  assert.equal(makerworld[0].author, "Matthew Ghost");

  const things = mapThingiversePayload({
    hits: [
      {
        id: 99,
        name: "Clip",
        public_url: "https://www.thingiverse.com/thing:99",
        thumbnail: "https://cdn.example/t.jpg",
        creator: { name: "maker" },
        like_count: 4,
      },
    ],
  });
  assert.equal(things[0].site, "thingiverse");
  assert.equal(things[0].url, "https://www.thingiverse.com/thing:99");
  assert.equal(things[0].author, "maker");
});
