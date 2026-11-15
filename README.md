# Xingtai Li

Personal homepage at **https://listar60.github.io/**.

Static HTML, CSS, and JavaScript, with no runtime dependencies, analytics, or
third-party font requests. The design adapts Taste Skill's cool-grey-cobalt
palette and Reddit Sans / JetBrains Mono pairing to a personal portfolio.

## Editing

Update `index.html` for the homepage. It offers no resume download, and no
standalone resume files are deployed. The original resume, home address, and
phone number are deliberately not published.

```sh
npm ci
npm start
```

Open http://127.0.0.1:4173. Development checks require Node 22+ and Google Chrome.

```sh
npm run format
npm test
npm run build
```

`build` regenerates the social preview. To replace the avatar, run
`npm run build -- /path/to/portrait.png`; it creates responsive WebP images
without copying source metadata. Font licenses are in `assets/fonts/`.

GitHub Pages serves the committed files from the root of `main`; no server,
API keys, or build service is needed.
