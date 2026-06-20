# Legit solutions deployment

Recommended zero-cost path: Cloudflare Pages.

## Settings

- Project name: `legit-solutions`
- Build command: `npm run build`
- Output directory: `dist`
- Node version: current LTS or newer

## Direct upload

1. Run `npm run build`.
2. Open Cloudflare Dashboard.
3. Go to Workers & Pages.
4. Create a Pages project.
5. Choose Direct Upload.
6. Upload the `dist` folder.

Cloudflare gives a free `*.pages.dev` URL, so no domain is required.

## CLI deploy

Run:

```sh
npm run deploy:cloudflare
```

The first run may ask you to log in to Cloudflare in the browser.
