# Can I 3D Print This?

Snap a photo or type what you’re looking for. The app identifies the object, searches Printables, Thangs, and MakerWorld for free 3D-printable models, and shows how close they are — or a Tinkercad starter path if nothing solid turns up. Thingiverse is included when a token is configured.

A photo is never searched as a generic “3D printable object.” If photo recognition can’t run, the app asks you to type what the object is instead of showing unrelated models. A description on its own still searches.

## Run locally

```bash
npm install
cp .env.example .env   # add your XAI_API_KEY
npm run dev
```

Then open [http://localhost:8080](http://localhost:8080).

## Environment

| Variable            | Required                       | Purpose                                                                                                                                   |
| ------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `XAI_API_KEY`       | Required for photo recognition | xAI key used to identify a photo and compare model thumbnails. Without it, a photo alone asks for a description. Text searches still run. |
| `XAI_MODEL`         | No                             | Chat model override. Defaults to `grok-4.6`, then retries once with `grok-4.5` if that model is unknown.                                  |
| `THINGIVERSE_TOKEN` | No                             | Official Thingiverse API token. When unset, Thingiverse is skipped and the other sites still search.                                      |

Optional auth/database vars (`BETTER_AUTH_SECRET`, `DATABASE_URL`) are only needed if you turn accounts on.
