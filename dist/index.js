// src/index.ts
var SEARCH_URL = "https://archive.org/advancedsearch.php";
var META_URL = "https://archive.org/metadata";
var DOWNLOAD_URL = "https://archive.org/download";
var COVER_URL = "https://archive.org/services/img";
function s(v) {
  if (!v) return "";
  return Array.isArray(v) ? v.join(", ") : v;
}
function parseRuntime(runtime) {
  if (!runtime) return 0;
  const parts = runtime.split(":").map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}
function docToTrack(doc) {
  return {
    id: `ia:${doc.identifier}`,
    title: s(doc.title) || doc.identifier,
    artist: s(doc.creator) || "Internet Archive",
    album: doc.date?.slice(0, 4),
    coverUrl: `${COVER_URL}/${encodeURIComponent(doc.identifier)}`,
    durationSec: parseRuntime(doc.runtime),
    price: 0,
    currency: "USD",
    version: "1.0.0",
    createdAt: doc.date || "",
    updatedAt: ""
  };
}
function pickPlayableFile(files) {
  return files.find((f) => /\.mp3$/i.test(f.name) && f.source === "derivative") || files.find((f) => /\.mp3$/i.test(f.name)) || files.find((f) => /\.ogg$/i.test(f.name)) || files.find((f) => /\.(wav|flac|m4a)$/i.test(f.name)) || null;
}
var ArchiveConnector = class {
  constructor() {
    this.meta = {
      id: "internet-archive",
      name: "Internet Archive",
      description: "Public-domain & open audio from archive.org",
      version: "0.2.0",
      capabilities: ["search", "stream", "playlist"]
    };
  }
  async init() {
  }
  async search(query) {
    const keyword = (query.keyword || "").trim();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 30;
    if (!keyword) {
      return { tracks: [], total: 0, page, pageSize };
    }
    const q = `mediatype:(audio) AND format:"VBR MP3" AND (${keyword})`;
    const flList = ["identifier", "title", "creator", "date", "runtime"].map((f) => `fl[]=${encodeURIComponent(f)}`).join("&");
    const url = `${SEARCH_URL}?q=${encodeURIComponent(q)}&${flList}&output=json&rows=${pageSize}&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Archive search failed: ${res.status}`);
    const data = await res.json();
    return {
      tracks: (data.response?.docs ?? []).map(docToTrack),
      total: data.response?.numFound ?? 0,
      page,
      pageSize
    };
  }
  async getTrack(trackId) {
    const id = this.parseId(trackId);
    if (!id) return null;
    const meta = await this.fetchMetadata(id);
    if (!meta?.metadata) return null;
    return {
      id: `ia:${id}`,
      title: meta.metadata.title || id,
      artist: meta.metadata.creator || "Internet Archive",
      album: meta.metadata.date?.slice(0, 4),
      coverUrl: `${COVER_URL}/${encodeURIComponent(id)}`,
      durationSec: 0,
      price: 0,
      currency: "USD",
      version: "1.0.0",
      createdAt: meta.metadata.date || "",
      updatedAt: ""
    };
  }
  async getStreamUrl(trackId) {
    const id = this.parseId(trackId);
    if (!id) return null;
    const meta = await this.fetchMetadata(id);
    const file = meta?.files ? pickPlayableFile(meta.files) : null;
    if (!file) return null;
    return {
      url: `${DOWNLOAD_URL}/${encodeURIComponent(id)}/${encodeURIComponent(file.name)}`,
      format: file.name.split(".").pop() || "mp3"
    };
  }
  parseId(trackId) {
    if (trackId.startsWith("ia:")) return trackId.slice(3);
    if (!trackId.includes(":")) return trackId;
    return null;
  }
  async fetchMetadata(identifier) {
    const res = await fetch(`${META_URL}/${encodeURIComponent(identifier)}`);
    if (!res.ok) return null;
    return await res.json();
  }
  // ----- Playlists -----
  //
  // Archive doesn't have "playlists"; it has *collections* (curated buckets
  // of items). We surface those as virtual playlists. `category` is a
  // keyword to filter collections by (default returns popular audio
  // collections like "etree" / "audio_bookspoetry" / "jamendo").
  //
  // Playlist id format: `ia-collection:<collection-identifier>`
  async listPlaylists(query = {}) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 30;
    const filter = query.category ? ` AND (${query.category})` : "";
    const q = `mediatype:collection AND format:Collection${filter}`;
    const flList = ["identifier", "title", "description", "creator"].map((f) => `fl[]=${encodeURIComponent(f)}`).join("&");
    const url = `${SEARCH_URL}?q=${encodeURIComponent(q)}&${flList}&output=json&rows=${pageSize}&page=${page}&sort[]=downloads+desc`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Archive collections fetch failed: ${res.status}`);
    const data = await res.json();
    const docs = data.response?.docs ?? [];
    return {
      playlists: docs.map((d) => ({
        id: `ia-collection:${d.identifier}`,
        name: s(d.title) || d.identifier,
        description: typeof d.description === "string" ? d.description.slice(0, 200) : Array.isArray(d.description) ? d.description[0]?.slice(0, 200) : void 0,
        coverUrl: `${COVER_URL}/${encodeURIComponent(d.identifier)}`,
        curator: s(d.creator) || void 0,
        externalUrl: `https://archive.org/details/${d.identifier}`
      })),
      total: data.response?.numFound ?? docs.length,
      page,
      pageSize
    };
  }
  async getPlaylistTracks(playlistId, opts = {}) {
    const page = opts.page ?? 1;
    const pageSize = opts.pageSize ?? 30;
    const raw = playlistId.startsWith("ia-collection:") ? playlistId.slice("ia-collection:".length) : playlistId;
    const q = `mediatype:audio AND format:"VBR MP3" AND collection:(${raw})`;
    const flList = ["identifier", "title", "creator", "date", "runtime"].map((f) => `fl[]=${encodeURIComponent(f)}`).join("&");
    const url = `${SEARCH_URL}?q=${encodeURIComponent(q)}&${flList}&output=json&rows=${pageSize}&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) return { tracks: [], total: 0, page, pageSize };
    const data = await res.json();
    return {
      tracks: (data.response?.docs ?? []).map(docToTrack),
      total: data.response?.numFound ?? 0,
      page,
      pageSize
    };
  }
};
var index_default = ArchiveConnector;
export {
  ArchiveConnector,
  index_default as default
};
