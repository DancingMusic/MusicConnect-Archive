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
