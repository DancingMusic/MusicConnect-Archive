# @dancingmusic/music-connect-archive

[Internet Archive](https://archive.org) music connector for [DancingMusic](https://github.com/DancingMusic/DancingMusic).

Implements the `MusicConnector` interface from `@dancingmusic/music-store` against the public archive.org audio catalog. 100% open-source / public-domain content — no API key, no auth, CORS-friendly.

## Use in DancingMusic

Open the music store → top-right connector switcher → **添加连接器** → **GitHub** tab → paste:

```
https://github.com/DancingMusic/MusicConnect-Archive
```

The app loads `dist/index.js` from jsdelivr at runtime.

## Programmatic use

```ts
import { ArchiveConnector } from "@dancingmusic/music-connect-archive";
import { MusicConnectorRegistry } from "@dancingmusic/music-store";

const registry = new MusicConnectorRegistry();
await registry.register(new ArchiveConnector());
registry.activate("internet-archive");
```

## Track ID format

`ia:<archive-identifier>` — e.g. `ia:gd1977-05-08.shnf`

## API endpoints used

- `GET /advancedsearch.php` — search
- `GET /metadata/{id}` — metadata + file list
- `GET /download/{id}/{file}` — direct stream

## License

MIT
