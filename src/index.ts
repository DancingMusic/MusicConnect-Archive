/**
 * Internet Archive music connector for DancingMusic.
 *
 * Implements MusicConnector against the public archive.org catalog
 * (mediatype=audio). 100% open-source / public-domain content, no API key
 * required, CORS-friendly.
 *
 * Track ID format: `ia:<archive-identifier>`
 */
import type {
  MusicConnector,
  MusicConnectorMeta,
  MusicListQuery,
  MusicSearchResult,
  MusicStreamInfo,
  MusicTrack,
} from "@dancingmusic/music-store";

interface ArchiveDoc {
  identifier: string;
  title?: string | string[];
  creator?: string | string[];
  date?: string;
  runtime?: string;        // e.g. "3:45"
}

interface ArchiveSearchResponse {
  response: {
    docs: ArchiveDoc[];
    numFound: number;
  };
}

interface ArchiveFile {
  name: string;
  format?: string;
  length?: string;         // seconds or "M:SS"
  size?: string;
  source?: string;
}

interface ArchiveMetadataResponse {
  files?: ArchiveFile[];
  metadata?: { title?: string; creator?: string; date?: string };
}

const SEARCH_URL = "https://archive.org/advancedsearch.php";
const META_URL = "https://archive.org/metadata";
const DOWNLOAD_URL = "https://archive.org/download";
const COVER_URL = "https://archive.org/services/img";

function s(v: string | string[] | undefined): string {
  if (!v) return "";
  return Array.isArray(v) ? v.join(", ") : v;
}

function parseRuntime(runtime: string | undefined): number {
  if (!runtime) return 0;
  // "M:SS" or "H:MM:SS"
  const parts = runtime.split(":").map(p => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function docToTrack(doc: ArchiveDoc): MusicTrack {
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
    updatedAt: "",
  };
}

function pickPlayableFile(files: ArchiveFile[]): ArchiveFile | null {
  // Prefer derivative MP3 (smaller, web-optimized) over original; fall back to
  // any MP3, then OGG / WAV / FLAC / M4A.
  return (
    files.find(f => /\.mp3$/i.test(f.name) && f.source === "derivative") ||
    files.find(f => /\.mp3$/i.test(f.name)) ||
    files.find(f => /\.ogg$/i.test(f.name)) ||
    files.find(f => /\.(wav|flac|m4a)$/i.test(f.name)) ||
    null
  );
}

export class ArchiveConnector implements MusicConnector {
  readonly meta: MusicConnectorMeta = {
    id: "internet-archive",
    name: "Internet Archive",
    description: "Public-domain & open audio from archive.org",
    version: "0.1.0",
    capabilities: ["search", "stream"],
  };

  async init(): Promise<void> {
    /* no-op */
  }

  async search(query: MusicListQuery): Promise<MusicSearchResult> {
    const keyword = (query.keyword || "").trim();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 30;

    if (!keyword) {
      return { tracks: [], total: 0, page, pageSize };
    }

    // Build a query that returns audio items WITH playable mp3 files
    // (without the format filter, IA returns many podcast/talk items that have
    // no streamable mp3 in their file list)
    const q = `mediatype:(audio) AND format:"VBR MP3" AND (${keyword})`;
    // URLSearchParams collapses repeated keys; build manually for the fl[] list
    const flList = ["identifier", "title", "creator", "date", "runtime"]
      .map(f => `fl[]=${encodeURIComponent(f)}`)
      .join("&");
    const url = `${SEARCH_URL}?q=${encodeURIComponent(q)}&${flList}&output=json&rows=${pageSize}&page=${page}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Archive search failed: ${res.status}`);
    const data = (await res.json()) as ArchiveSearchResponse;

    return {
      tracks: (data.response?.docs ?? []).map(docToTrack),
      total: data.response?.numFound ?? 0,
      page,
      pageSize,
    };
  }

  async getTrack(trackId: string): Promise<MusicTrack | null> {
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
      updatedAt: "",
    };
  }

  async getStreamUrl(trackId: string): Promise<MusicStreamInfo | null> {
    const id = this.parseId(trackId);
    if (!id) return null;
    const meta = await this.fetchMetadata(id);
    const file = meta?.files ? pickPlayableFile(meta.files) : null;
    if (!file) return null;
    return {
      url: `${DOWNLOAD_URL}/${encodeURIComponent(id)}/${encodeURIComponent(file.name)}`,
      format: file.name.split(".").pop() || "mp3",
    };
  }

  private parseId(trackId: string): string | null {
    if (trackId.startsWith("ia:")) return trackId.slice(3);
    if (!trackId.includes(":")) return trackId;
    return null;
  }

  private async fetchMetadata(identifier: string): Promise<ArchiveMetadataResponse | null> {
    const res = await fetch(`${META_URL}/${encodeURIComponent(identifier)}`);
    if (!res.ok) return null;
    return (await res.json()) as ArchiveMetadataResponse;
  }
}

// Default export so the dynamic loader can `new mod.default()`.
export default ArchiveConnector;
