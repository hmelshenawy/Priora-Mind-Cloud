Run the focused onboarding browser tests from `frontend`:

```powershell
npm install
npx playwright install chromium
npm test
```

The runner starts Next.js on port 3100. If this checkout already has a dev server, use it instead:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3001'
npm test
```

Tests intercept `/api/v1` responses and exercise real frontend routing, forms, session storage, and the application shell. They do not require a backend or create real accounts. Coverage includes success, validation, duplicate email, automatic login retry, creation retry, network failure, expired authentication, pending submissions, refresh persistence, and Arabic mobile layout.
