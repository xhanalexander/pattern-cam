# Pattern Camera

Mobile-first Next.js app for live kaleidoscope pattern capture — camera or upload, triangle sample, edit, and PNG export. Inspired by Adobe Capture–style pattern workflows and Catalina Estrada’s print aesthetic.

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

Design and interaction reference used for this project:

| File | Notes |
| --- | --- |
| [`docs/references/catalinaestrada.mp4`](./docs/references/catalinaestrada.mp4) | Demo of live pattern capture → edit → tiled result (Catalina Estrada jaguar/floral print) |

<video src="./docs/references/catalinaestrada.mp4" controls width="360"></video>

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | ESLint |
