# Stack

diglist is intentionally simple — no framework, no build step, no dependencies to install.

## Frontend

**Plain HTML/CSS/JS** — a single `index.html` file. No React, no Vue, no bundler. Opens directly in a browser.

- [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) + [Playfair Display](https://fonts.google.com/specimen/Playfair+Display) via Google Fonts
- CSS custom properties for theming
- Vanilla JS with async/await for API calls

## Backend

**[Netlify Functions](https://docs.netlify.com/functions/overview/)** — two serverless functions that act as a proxy between the browser and Supabase. They keep the Supabase credentials out of the client-side code.

| Function | Role |
|----------|------|
| `netlify/functions/items.js` | CRUD for list items (GET, POST, DELETE) |
| `netlify/functions/embed.js` | Fetches Bandcamp page server-side to extract embed URL and album artwork |

## Database

**[Supabase](https://supabase.com)** (open source, Apache 2.0) — a hosted Postgres database with a REST API. Each item is stored as a single JSONB blob, making the schema flexible without migrations.

```
items
  id          text        primary key
  data        jsonb       all item fields (url, title, artist, tags, note, status, artworkUrl, addedAt)
  updated_at  timestamptz auto-set on insert
```

Row Level Security (RLS) is enabled with a permissive policy — access is controlled at the Netlify Function layer, not at the database layer.

## Hosting

**[Netlify](https://netlify.com)** — serves the static HTML and runs the serverless functions. Deploys automatically from GitHub on every push to `main`.

Environment variables (`SUPABASE_URL`, `SUPABASE_KEY`) are set in the Netlify dashboard and injected into the functions at runtime — they never touch the codebase.

## External APIs

- **Bandcamp** — no official API. The `embed.js` function fetches the HTML of Bandcamp pages server-side and extracts the album/track ID from embedded JSON (`data-tralbum`). Artwork is derived from the Bandcamp CDN using the album ID pattern (`f4.bcbits.com/img/a{ID}_16.jpg`).

## Cost

Everything runs on free tiers:

| Service | Free tier limits |
|---------|-----------------|
| Netlify | 125k function invocations/month, 100GB bandwidth |
| Supabase | 500MB database, 2GB bandwidth |