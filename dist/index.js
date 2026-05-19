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
  const byExt = (ext) => files.find((f) => ext.test(f.name) && f.source !== "original" || ext.test(f.name));
  return files.find((f) => /\.mp3$/i.test(f.name) && f.source === "derivative") || files.find((f) => /\.mp3$/i.test(f.name)) || files.find((f) => /\.ogg$/i.test(f.name)) || files.find((f) => /\.(wav|flac|m4a)$/i.test(f.name)) || byExt(/\.mp3$/i) || null;
}
var ArchiveConnector = class {
  constructor() {
    this.meta = {
      id: "internet-archive",
      name: "Internet Archive",
      description: "Public-domain & open audio from archive.org",
      version: "0.1.0",
      capabilities: ["search", "stream"]
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
    const q = `mediatype:(audio) AND (${keyword})`;
    const params = new URLSearchParams({
      q,
      "fl[]": "identifier",
      output: "json",
      rows: String(pageSize),
      page: String(page)
    });
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
};
var index_default = ArchiveConnector;
export {
  ArchiveConnector,
  index_default as default
};
