# Can I 3D Print This?

Snap a photo or type what you’re looking for. The app identifies the object, searches Printables and Thangs for free 3D-printable models, and shows matches — or a Tinkercad starter path if nothing solid turns up.

## Run locally

```bash
npm install
cp .env.example .env   # add your XAI_API_KEY
npm run dev
```

Then open [http://localhost:8080](http://localhost:8080).

## Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `XAI_API_KEY` | Yes | Grok vision + search ranking |

Optional auth/database vars (`BETTER_AUTH_SECRET`, `DATABASE_URL`) are only needed if you turn accounts on.
