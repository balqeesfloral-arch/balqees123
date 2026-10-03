# Balqees Floral React Website

## Run locally
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Routes
- `/` Home
- `/services` Services catalogue
- `/projects` Work / projects
- `/about` About
- `/account` Client/company/admin portal UI
- `/certification` Official certification

## Notes
- Arabic/English toggle is built in.
- Seasonal theme switches automatically using Saudi time and the Umm al-Qura calendar for Ramadan, Eid and Hajj, plus Saudi National Day.
- The login page is UI-ready; connect Supabase/Auth later using environment variables and your project credentials.
- Main brand colors and contact/business details are centralized in `src/lib/content.js`.

## If Vite says it cannot resolve react-router-dom or lucide-react
Stop the dev server, then from the project root run:

```bash
npm install
npm run dev
```

If this project folder previously had an older `node_modules`, on Windows PowerShell use:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm install
npm run dev
```
