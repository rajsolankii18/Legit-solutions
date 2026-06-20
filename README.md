# Legit solutions

Private, mobile-first TXT/VCF/Excel conversion workstation built for high-volume contact processing. The app ports a desktop CMD workflow into a browser-based tool that works on laptops and iPhones without sending uploaded files to a backend.

## Highlights

- TXT to VCF generation with RAJ-style linked file/contact naming
- Manual, sequential, alphabetic, and per-file naming workflows
- Smart phone-number cleanup, duplicate handling, invalid-row reports, and summary reports
- ROUGH pipeline: TXT to VCF, VCF splitting, contact renaming, and optional source prepend
- ADMIN/NAVY contact composition and starting-contact renaming
- VCF to TXT extraction
- TXT splitting, merging, cleaning, dedupe, plus-prefix tools, and a dedicated TXT editor
- Excel data extraction to CSV, TSV, per-column TXT, and phone-column TXT
- ZIP export for large batch output
- PWA-ready mobile interface with iPhone home-screen support

## Privacy Model

Uploaded TXT, VCF, and Excel files are processed in the browser. The app does not require a backend for conversions, and original uploaded files are never overwritten.

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- JSZip
- read-excel-file
- Vitest
- Cloudflare Pages

## Local Development

```bash
npm install
npm run dev
```

Open:

```txt
http://127.0.0.1:5173/
```

## Quality Checks

```bash
npm run lint
npm test -- --run
npm run build
```

## Deployment

Cloudflare Pages settings:

- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`

The app can also be deployed with direct upload by building locally and uploading the `dist` folder.
