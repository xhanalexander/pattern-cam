# pattern-cam

Mobile-first Next.js app for live kaleidoscope pattern capture — camera or upload, triangle sample, edit, and PNG export. Inspired by Adobe Capture–style pattern workflows and Catalina Estrada’s print aesthetic.

**Live:** [https://xhanalexander.github.io/pattern-cam/](https://xhanalexander.github.io/pattern-cam/)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For phone camera access over the LAN, run with HTTPS (self-signed certs in `certificates/` are gitignored):

```bash
npm run dev -- --hostname 0.0.0.0 --port 3000 --experimental-https --experimental-https-key ./certificates/localhost-key.pem --experimental-https-cert ./certificates/localhost.pem
```

## Video references

- `catalinaestrada.mp4` — demo of live pattern capture → edit → tiled result (Catalina Estrada jaguar/floral print)

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (`out/` static export) |
| `npm start` | Start production server |
| `npm run lint` | ESLint |

GitHub Pages deploys from `master` via `.github/workflows/pages.yml`.
