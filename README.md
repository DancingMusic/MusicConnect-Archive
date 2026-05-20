# @dancingmusic/music-connect-archive

[Internet Archive](https://archive.org) music connector for [DancingMusic](https://github.com/DancingMusic/DancingMusic).

🔗 **Live demo:** [https://dancingmusic.github.io/MusicConnect-Archive/](https://dancingmusic.github.io/MusicConnect-Archive/) — search + play table built from this connector's own `dist/index.js`.

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

## Versioned releases

This repo uses an auto-release workflow ([`.github/workflows/release.yml`](.github/workflows/release.yml)) that creates a `v<package.json version>` tag + GitHub Release on every push to `main` whose version field has changed. Each release attaches the freshly-built `dist/index.js`.

**Pin to a specific version** (recommended for production):
```
https://cdn.jsdelivr.net/gh/DancingMusic/MusicConnect-Archive@v0.1.1/dist/index.js
```

**Always-latest** (handy for dev, but jsdelivr caches `@main` for up to a week):
```
https://cdn.jsdelivr.net/gh/DancingMusic/MusicConnect-Archive@main/dist/index.js
```

### Releasing a new version

1. Edit code under `src/`
2. `npm version patch` (or `minor` / `major`) — bumps `package.json`
3. `npm run build` — refreshes `dist/index.js`
4. Commit (including `dist/`) + push to `main`
5. The workflow detects the new version, creates the tag, and publishes the GitHub Release automatically
