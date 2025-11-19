# Poker Night Tracker

A full-stack poker night companion that lets hosts coordinate sessions, track cash movement, and review historical performance. Session state now lives in PostgreSQL so it can be shared by multiple app replicas inside Kubernetes.

## Features

- Slide-out settings drawer with host controls for name, location, date/time, preferred currency (USD, EUR, or ILS), reported totals, and table expenses.
- Session lifecycle management: administrators can open/close a night, and once closed, player inputs are locked until a fresh session begins.
- Shareable player registration mode (`?role=player`) so guests can enter their buy-ins and cash-out amounts while the event remains open.
- Persistent session archive stored in PostgreSQL so every night is saved for future reference.
- Historical scoreboard that surfaces the most profitable player and win leaders per session, by year, or across all time, complete with filterable tables.
- Real-time summary metrics: total buy-ins, total cash out, table delta (highlighted bright red when not balanced), expense totals, and cumulative wins/losses.

## Getting started

1. Copy the example environment file and set the `DATABASE_URL` that points at your PostgreSQL instance (the built-in scripts use the `psql` CLI, so make sure it is installed):

   ```bash
   cp .env.example .env
   ```

2. Start PostgreSQL locally or in Docker:

   ```bash
   docker run --rm -p 5432:5432 \
     -e POSTGRES_PASSWORD=supersecret \
     -e POSTGRES_USER=pokerface \
     -e POSTGRES_DB=pokerface \
     --name pokerface-db postgres:15-alpine
   ```

3. Run the schema migration and load seed data (optional):

   ```bash
   npm run migrate
   npm run seed
   ```

4. Start the tracker and open http://localhost:3000:

   ```bash
   npm start
   ```

Sessions and player data are written to PostgreSQL. Each update is saved automatically while a session is open, and closing a session locks it into the archive so you can compare past results from the scoreboard.

## Importing the historical Google Sheet

Export the Google Sheet (`1mgjOcoFy3XRieHbR5LAjRwZdDKHzHLhpL5OtBIV5IDw`) to CSV and save it as `data/historicalSessions.csv`. The importer expects the following headers:

```
sessionId,playerId,playerName,buyins,final,hostName,location,datetime,expenses,reportedFinal,currency,status
```

Each row represents a player entry for a given session; the script groups rows by `sessionId` before inserting them. Once the CSV is in place, run:

```bash
npm run import:sessions
```

The repo includes `data/historicalSessions.sample.csv` that demonstrates the layout. Because the CI environment cannot reach Google Sheets directly, place the exported CSV in `data/historicalSessions.csv` before running the import command.

## Running with Docker

You can also run the tracker in a container using the provided `Dockerfile`. The image bundles the `psql` client so it can reach an external PostgreSQL database defined by `DATABASE_URL`.

1. Build the image:

   ```bash
   docker build -t poker-night-tracker .
   ```

2. Launch the container and expose port 3000. Provide a `DATABASE_URL` so the app can talk to PostgreSQL (running locally or elsewhere):

   ```bash
   docker run --rm -p 3000:3000 \
     -e DATABASE_URL=postgresql://pokerface:supersecret@host.docker.internal:5432/pokerface \
     poker-night-tracker
   ```

With the container running, browse to http://localhost:3000 to access the app.

## Kubernetes deployment

The `k8s/app.yaml` manifest now provisions the entire stack—namespace, shared secret, PostgreSQL `StatefulSet`, and the Poker Face deployment. The secret seeds a `DATABASE_URL` that already points at the in-cluster PostgreSQL service (`pokerface-postgres.pokerface.svc.cluster.local`), so the application talks to the database automatically as soon as both pods are up.

After pushing your container image to a registry that the cluster can reach, apply the manifest in one step:

```bash
kubectl apply -f k8s/app.yaml
```

If you need to change the default credentials or database name, edit the `stringData` block inside `k8s/app.yaml` before applying. Kubernetes will regenerate the base64-encoded secret data automatically.

### Troubleshooting Kubernetes validation

The manifest itself does not require any extra flags, but `kubectl` must be connected to a running cluster so it can download the API server's OpenAPI schema during validation. If you see an error similar to the following:

```
error validating "app.yaml": error validating data: failed to download openapi: Get "https://127.0.0.1:51240/openapi/v2?timeout=32s": dial tcp 127.0.0.1:51240: connectex: No connection could be made because the target machine actively refused it
```

your kubeconfig is pointing at an API server that is unreachable (for example, Docker Desktop Kubernetes is stopped, or `minikube` is not running). Fix the context rather than editing `app.yaml`:

1. Check your current context and ensure it matches the cluster you intend to use:

   ```bash
   kubectl config current-context
   ```

2. Start or connect to that cluster (`minikube start`, enabling Kubernetes in Docker Desktop, `kind create cluster`, etc.).

3. Verify connectivity:

   ```bash
   kubectl cluster-info
   kubectl get nodes
   ```

Once the API server is reachable, rerun `kubectl apply -f k8s/app.yaml` and the validation step will succeed without modifying the manifest.

## Branching

All development now lives on the `main` branch. Previous working branches have been consolidated so you can pull directly from `main` to receive the latest tracker updates.
