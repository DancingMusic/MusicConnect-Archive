import { afterEach, describe, expect, it, vi } from "vitest";
import { ArchiveConnector } from "../index";

function mockFetch(map: Record<string, unknown>) {
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [pattern, body] of Object.entries(map)) {
      if (url.includes(pattern)) {
        return Promise.resolve(new Response(JSON.stringify(body), {
          status: 200, headers: { "content-type": "application/json" },
        }));
      }
    }
    return Promise.resolve(new Response("", { status: 404 }));
  });
}

describe("ArchiveConnector (contract)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("declares meta", () => {
    const c = new ArchiveConnector();
    expect(c.meta.id).toBe("internet-archive");
    expect(c.meta.capabilities).toEqual(expect.arrayContaining(["search", "stream"]));
  });

  it("search returns track-shaped results", async () => {
    mockFetch({
      "/advancedsearch.php": {
        response: {
          numFound: 1,
          docs: [{
            identifier: "jamendo-058176",
            title: "Mozart Sonata",
            creator: "Demo Artist",
            date: "2011-12-20",
            runtime: "3:45",
          }],
        },
      },
    });
    const c = new ArchiveConnector();
    await c.init();
    const r = await c.search({ keyword: "mozart", pageSize: 10 });
    expect(r.tracks).toHaveLength(1);
    const t = r.tracks[0];
    expect(t.id).toBe("ia:jamendo-058176");
    expect(t.title).toBe("Mozart Sonata");
    expect(t.artist).toBe("Demo Artist");
    expect(t.coverUrl).toContain("archive.org/services/img");
    expect(t.durationSec).toBe(225); // 3:45
  });

  it("listPlaylists returns collection-shaped results", async () => {
    mockFetch({
      "/advancedsearch.php": {
        response: {
          numFound: 1,
          docs: [{
            identifier: "etree",
            title: "Live Music Archive",
            description: "Concerts and live recordings.",
            creator: "various",
          }],
        },
      },
    });
    const c = new ArchiveConnector();
    await c.init();
    const r = await c.listPlaylists!();
    expect(r.playlists).toHaveLength(1);
    const p = r.playlists[0];
    expect(p.id).toBe("ia-collection:etree");
    expect(p.name).toBe("Live Music Archive");
    expect(p.externalUrl).toContain("archive.org/details/etree");
  });

  it("getPlaylistTracks resolves tracks of a collection", async () => {
    mockFetch({
      "/advancedsearch.php": {
        response: {
          numFound: 1,
          docs: [{
            identifier: "etree-show-1",
            title: "Live Show",
            creator: "Demo Band",
            date: "2010-01-01",
            runtime: "5:00",
          }],
        },
      },
    });
    const c = new ArchiveConnector();
    await c.init();
    const r = await c.getPlaylistTracks!("ia-collection:etree");
    expect(r.tracks).toHaveLength(1);
    expect(r.tracks[0].id).toBe("ia:etree-show-1");
  });

  it("getStreamUrl picks an mp3 from metadata", async () => {
    mockFetch({
      "/metadata/jamendo-058176": {
        metadata: { title: "Mozart Sonata" },
        files: [
          { name: "cover.jpg" },
          { name: "01.mp3", format: "VBR MP3", source: "original" },
          { name: "01_64kb.mp3", format: "MP3", source: "derivative" },
        ],
      },
    });
    const c = new ArchiveConnector();
    await c.init();
    const info = await c.getStreamUrl("ia:jamendo-058176");
    expect(info).not.toBeNull();
    expect(info!.url).toContain("archive.org/download/jamendo-058176/");
    expect(info!.url).toMatch(/\.mp3$/);
  });
});
