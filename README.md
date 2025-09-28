# VIC — Vidya Innovation Centre

Modern, responsive landing site built with Next.js + Tailwind.

## Features
- Dark, bold design with Hero, Feature split, Card grid
- Dynamic pages for Events and Startups
- Accessible components and keyboard-friendly nav
- Image optimization and responsive layout

## Getting started

Requirements: Node.js 18+

Install dependencies and run the dev server:

```pwsh
npm install
npm run dev
```

Then open http://localhost:3000

## Build

```pwsh
npm run build
npm start
```

## Customize content
- Edit data in `src/data/events.json` and `src/data/startups.json`.
- Replace images in `public/images/...` with your assets (keep file names or update JSON).

## Deploy
Deploy on Vercel, Netlify, or GitHub Pages (static export).

1. Push to GitHub
2. For GitHub Pages:
	- In GitHub repo settings: Enable Pages with Source: GitHub Actions
	- Ensure default branch is `main`
	- A workflow `.github/workflows/deploy.yml` is included; it builds with `next export` and deploys the `out` folder
	- After the action runs, your site will be live at `https://<user>.github.io/<repo>/`

For Vercel:
1. Import repository in Vercel
2. Deploy with defaults
