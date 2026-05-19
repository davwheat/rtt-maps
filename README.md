# RTT Maps

A browser extension that augments [Realtime Trains](https://www.realtimetrains.co.uk) service pages with a simple map showing the train's route.

Built with [MapLibre GL](https://maplibre.org/) and packaged as a Manifest V3 WebExtension targeting Firefox 128+, and modern Chrome versions.

## Building locally

Requires [pnpm](https://pnpm.io/).

```sh
pnpm install
pnpm dev        # build to dist/ and watch
pnpm build      # one-shot production build
pnpm type-check # tsc --noEmit
```

Load the unpacked extension from `dist/` in your browser's extension developer tools.

## License

[GPL-3.0](LICENSE)
