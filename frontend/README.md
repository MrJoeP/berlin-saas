# Frontend

Vite plus React plus TypeScript plus Tailwind 4 plus Supabase.

## SETUP
```bash
cd frontend
npm install
cp .env.example .env.local
# .env.local mit Supabase-Werten füllen
npm run dev
```

Dev-Server läuft auf `http://localhost:5173`.

## ENV-VARIABLEN
- `VITE_SUPABASE_URL`: Project-URL.
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Publishable Key aus Supabase-Dashboard.

## STRUKTUR
```
frontend/
├── src/
│   ├── lib/
│   │   ├── supabase.ts    # Client plus Types
│   │   ├── auth.tsx       # AuthProvider plus useAuth
│   │   └── utils.ts       # cn, formatDate
│   ├── components/
│   │   └── ui/            # Button, Input, Card
│   ├── pages/
│   │   ├── Login.tsx      # Magic-Link-Login
│   │   ├── Setup.tsx      # Multi-Step Company-Setup
│   │   └── Dashboard.tsx  # Digest-View plus Run-Trigger
│   ├── App.tsx            # Routing
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
└── vite.config.ts
```

## ROUTES
- `/login`: Magic-Link-Auth.
- `/setup`: Multi-Step-Form (4 Schritte: Firma, Industrie, Konkurrenten, Sources).
- `/`: Dashboard mit Digests plus Run-Now-Button.

## FLOW
1. User loggt sich ein via Magic Link.
2. Falls keine Company existiert, automatisch nach `/setup`.
3. Setup-Form gibt Company-ID zurück, enqueued einen `scrape_company` Job.
4. Worker scraped Firma plus Konkurrenten im Hintergrund.
5. Dashboard zeigt Digests. Erster wird beim ersten Wochen-Cron-Run oder via Run-Now-Button erzeugt.

## DEPLOYMENT
Frontend ist deploy-bereit für Netlify oder Vercel.
- Build-Command: `npm run build`
- Output-Directory: `dist`
- Env-Variablen in Provider-UI setzen.

## LOVABLE-SYNC
Lovable kann das Repo connecten und im `frontend/`-Ordner arbeiten. Bei jedem `git push` auf `main` syncronisiert Lovable.

## BAUSTELLEN
- Multi-Tenant-Workspaces: aktuell eine Company pro User.
- Email-Templates: aktuell hart codiert in `send-digest/handler.ts`. Iteration im Repo.
- Source-Library-Verwaltung: nur Auswahl, kein Hinzufügen aus dem UI.
