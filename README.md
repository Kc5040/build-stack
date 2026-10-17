# Buildbench: AI coding tools directory (v0.1)

**Buildbench** is a simple, fast directory of AI coding tools for vibe coders and builders: AI editors, coding agents, code assistants, app builders, backends, hosting and model APIs. Each tool gets a one-line description, a category, a pricing label and a link.

This is the **first version**: a static site with no build step, no backend and no external services connected. It's built to be agent-maintainable. All data lives in one JSON file, and a tiny script regenerates the chatbot-readable `llms.txt`.

## What's on the homepage

- **Hero**: headline, short pitch and buttons to the directory and the newsletter.
- **Featured (sponsorship)**: 3 placeholder "Your tool here" featured-listing spots (mailto link for now).
- **Directory**: a searchable grid with category filter chips and a pricing dropdown (free / freemium / paid). Loaded from `data/tools.json` with vanilla JS.
- **Newsletter signup**: frontend only. It validates the email, shows a success state and stores the email in `localStorage` only. Resend gets wired in later.
- **Submit / contact**: a no-backend form that opens the visitor's email app (`mailto:`).
- **Footer**: links to `llms.txt` and the sitemap.

SEO basics are in place: `<title>`, meta description, canonical, Open Graph/Twitter tags, semantic HTML (`header`/`nav`/`main`/`section`/`footer`), `robots.txt` and `sitemap.xml`. The site also supports light and dark mode (it follows the OS setting) and works on mobile.

## Project structure

```
.
├── index.html               # Homepage (all sections)
├── llms.txt                 # GENERATED chatbot-readable site summary and full tool list
├── robots.txt
├── sitemap.xml              # Placeholder domain: https://example.com
├── package.json             # Convenience scripts only (no dependencies)
├── data/
│   └── tools.json           # THE single source of truth for all tools
├── assets/
│   ├── app.js               # Search/filter grid and newsletter form logic
│   ├── styles.css           # Plain CSS, light/dark, responsive
│   ├── tools-fallback.js    # GENERATED inline copy of tools.json (for file:// previews)
│   ├── favicon.svg
│   └── og-image.svg         # Social share image (SVG; swap for a 1200x630 PNG later)
└── scripts/
    └── build-llms.js        # Validates tools.json and regenerates llms.txt + tools-fallback.js
```

## Preview locally

The page fetches `data/tools.json`, which browsers block over `file://`. If you just double-click `index.html`, it falls back to `assets/tools-fallback.js`, but serving over HTTP is the proper way to preview:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
# or
npx serve .
```

## How to add a tool

1. Open `data/tools.json` and add an object to the `tools` array:

   ```json
   {
     "name": "My Tool",
     "description": "One line on what it does for builders.",
     "category": "Coding Agent",
     "pricing": "freemium",
     "url": "https://mytool.com"
   }
   ```

   | Field         | Required | Rules |
   |---------------|----------|-------|
   | `name`        | yes      | Unique (case-insensitive). |
   | `description` | yes      | One line, about 140 characters max. |
   | `category`    | yes      | Must match an entry in the top-level `categories` array. To add a new category, add it there first. Categories show as filter chips in that order. |
   | `pricing`     | yes      | `free`, `freemium` or `paid`. |
   | `url`         | yes      | Official site, must start with `https://`. |
   | `tags`        | no       | Array of extra search keywords, e.g. `["cli", "open-source"]`. |

   Order doesn't matter, since the grid sorts alphabetically. You can also bump `updated`.

2. Regenerate the derived files (this also validates the JSON and fails loudly on bad entries):

   ```bash
   node scripts/build-llms.js
   # or: npm run build:llms
   # with the real domain later: SITE_URL=https://yourdomain.com node scripts/build-llms.js
   ```

3. Commit `data/tools.json`, `llms.txt` and `assets/tools-fallback.js` together.

## Deploy notes (not deployed yet)

- **Hostinger**: upload the repo contents (everything except `scripts/`, `package.json` and `README.md`, though leaving them in is harmless) to `public_html/` via File Manager, FTP or Hostinger's Git deployment. No build step is needed.
- **Vercel**: import the repo, choose framework preset "Other", leave the build command empty and set the output directory to `.`. That's it.
- **Before launch**: replace `https://example.com` in `index.html` (canonical and `og:*`), `robots.txt`, `sitemap.xml`, and run `SITE_URL=https://yourdomain.com node scripts/build-llms.js`. Also replace `hello@example.com` everywhere in `index.html`.

## Placeholders to replace

- Domain `https://example.com`: in `index.html`, `robots.txt`, `sitemap.xml` and `llms.txt` (via `SITE_URL`).
- Contact email `hello@example.com`: in the submit form, the sponsor "Claim this spot" links and the email link.
- Featured listings: 3 "Your tool here" cards in `index.html` (`#sponsor`).
- Newsletter: stores to `localStorage` only (see the `TODO` in `assets/app.js`).
- OG image is an SVG. Some social networks prefer PNG, so export a 1200x630 PNG later.
- **Pricing labels are best-effort as of Oct 2026 and should be verified.** AI tool plans change often.

## Roadmap

1. **Resend**: a serverless `/api/subscribe` endpoint that adds the contact to a Resend audience, then a weekly or daily newsletter with a sponsor slot.
2. **Stripe**: payment links for featured listings and newsletter sponsorships, wired into the sponsor cards.
3. **Domain**: buy and point a domain (Hostinger or Vercel), update the placeholders, submit the sitemap to Google Search Console.
4. Per-tool pages (`/tools/<slug>`) for SEO, plus JSON-LD structured data.
5. "New this week" section, upvotes and a real submission form backend.
6. An agent routine: add new tool releases, check links and make one SEO improvement per day.
