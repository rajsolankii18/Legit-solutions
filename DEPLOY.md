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

## Telegram delivery setup

The D1 binding is configured in `wrangler.toml` as `TELEGRAM_DB`.

Add the private secrets with Wrangler:

```sh
npx wrangler pages secret put TELEGRAM_BOT_TOKEN --project-name legit-solutions
npx wrangler pages secret put TELEGRAM_WEBHOOK_SECRET --project-name legit-solutions
npx wrangler pages secret put TELEGRAM_ADMIN_PIN --project-name legit-solutions
```

After deployment, set the Telegram webhook:

```sh
npx wrangler pages deployment list --project-name legit-solutions
```

Use the production `*.pages.dev` URL with Telegram:

```txt
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<YOUR_SITE>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

Clients only need to press Start on the bot once. The app will show them in Telegram Delivery after Refresh clients.
