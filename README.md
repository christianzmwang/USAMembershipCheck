# Bay Area Fencing Club - USA Fencing Membership Dashboard

An internal dashboard for Bay Area Fencing Club to view USA Fencing membership IDs stored in Pike13 person profiles.

## Features

### � Membership Listing
- Lists Pike13 people with their USA Fencing Member ID custom field
- Server-rendered table with pagination via API
- Responsive design

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **UI Components**: Radix UI + Tailwind CSS
- **API Integration**: Pike13 API
- **TypeScript**: Full type safety
- **Date Handling**: date-fns for date manipulation

## Getting Started

### Prerequisites
- Node.js 18+ 
- Pike13 API key with access to People endpoints

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd bafc-appointment
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Add your Pike13 API key:
```env
PIKE13_API_KEY=your_pike13_api_key_here
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Endpoints

### USA Members (paged)
- Endpoint: `/api/pike13/people/usa-members/page`
- Method: GET
- Query: `page`, `perPage`
- Purpose: Fetch people with the USA Member ID field in pages

### USA Members (all)
- Endpoint: `/api/pike13/people/usa-members`
- Method: GET
- Purpose: Fetch all people with the USA Member ID field (server-side aggregation)

## Pike13 Integration

This dashboard integrates with Pike13's API to fetch Pike13 people and their custom field values.

### API Requirements
- Pike13 business account
- API key with people/read permissions
- Properly configured business data in Pike13

## Development Features

### Mock Data Support
If Pike13 API is not accessible, the dashboard automatically falls back to realistic mock data for development and testing.

### Error Handling
- Graceful API error handling
- User-friendly error messages
- Automatic fallback to mock data

### Performance
- Client-side caching of API responses
- Optimized chart rendering
- Responsive loading states

## Project Structure

```
src/
├── app/
│   ├── api/pike13/financial/     # Financial API endpoints
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main dashboard page
├── components/
│   ├── dashboard/                # Dashboard-specific components
│   │   ├── revenue-chart.tsx     # Revenue trend chart
│   │   ├── revenue-metrics.tsx   # Financial metrics cards
│   │   └── date-range-selector.tsx # Date filtering
│   └── ui/                       # Reusable UI components
└── lib/
    └── pike13.ts                 # Pike13 helpers
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues or questions:
- Create an issue in the repository
- Contact the development team
- Check Pike13 API documentation for integration issues

## USA Members Listing

This app includes a server-rendered page to list all Pike13 people and their USA Fencing membership number if stored as a Person custom field.

- Route: `/usa-members`
- Server-only: uses the admin API key on the server (not exposed to the client).

Environment variables in `.env.local`:

```
PIKE13_API_KEY=your_admin_api_key
```

Notes:
- Ensure your Pike13 account has a Person custom field named "USA Fencing Membership number" (hardcoded default used across the app and scripts).
- If the field is missing for a person, the table shows “—”.

## Verify USA Membership IDs (automation)

A helper script logs into the USA Fencing member portal and checks your Pike13 members' USA Member IDs.

Setup:

1. Copy `.env.local.example` to `.env.local` and fill in:
  - `USA_FENCING_EMAIL`
  - `USA_FENCING_PASSWORD`
  - `PIKE13_API_KEY`
2. Install browser deps:
   - `pnpm install`
   - `pnpm playwright:install`

Run:

- `pnpm verify:usa` to check all found IDs and write `out/usa-status.json` and `out/usa-status.csv`.
- Options:
  - `--limit 50` to only check the first 50 IDs
  - `--out out/custom.json` to select output path
  - `--concurrency 4` to use multiple browser tabs in parallel (default: 1)
  - `--retry 2` to retry ID searches per person (default: 2)
  - `--in out/usa-members.json` to use a previously fetched cache file (faster startup)
  - `--from-api` to fetch fresh Pike13 data instead of reading from `--in`
  - `--headful` to open a visible browser window for debugging
  - `--verbose` or `--log-level debug` for more logs

Environment variables (optional):

```
# Default parallelism if --concurrency isn’t provided
USA_VERIFIER_CONCURRENCY=2
# Default retry count if --retry isn’t provided
USA_VERIFIER_RETRY=2
# Optional: narrow club matching when falling back to name search (comma or pipe separated)
USA_EXPECTED_CLUBS is no longer required; script defaults to ["Bay Area Fencing Club"].
```

Notes:
- Headless Playwright is used; selectors are best-effort and may need tweaks if the site changes.
- The script reads IDs from Pike13 via their Desk API.
- For faster runs: use `pnpm fetch:usa` first to create `out/usa-members.json`, then run `pnpm verify:usa --in out/usa-members.json --concurrency 2-4`. Start low and increase concurrency cautiously to avoid website rate limits.

## Workflow: fetch then verify

To avoid hitting the API every time, first fetch member data and cache it to a file, then run verification against that file.

1) Fetch Pike13 USA members to JSON:

- `pnpm fetch:usa` (writes `out/usa-members.json`)
- Options:
  - `--out out/usa-members.json` to customize the path

2) Verify against USA Fencing portal using cached data:

- `pnpm verify:usa --in out/usa-members.json --limit 50 --verbose --log out/usa-status.log`
- Options:
  - `--in <file>` to specify input JSON (defaults to `out/usa-members.json`)
  - `--from-api` to fetch fresh from API instead of using the file
  - `--headful` to open the browser window

Outputs:
- Status JSON: `out/usa-status.json`
- CSV: `out/usa-status.csv`
- Log: `out/usa-status.log`
