# Full-Stack API Connector Application

A robust self-contained React + Express + TypeScript full-stack application built for API routing and Gemini AI integrations.

---

## 🚀 Getting Started Locally

You can run this application locally either directly via **Node.js (npm)** or in isolated environments using **Docker / Docker Compose**.

### Prerequisite: Environment Secrets Configuration
Create a `.env` file in the root directory by copying the configuration blueprint:

```bash
cp .env.example .env
```

Open `.env` and fill in your respective values:
- `GEMINI_API_KEY`: Your official Google AI Studio Gemini API key.
- `APP_URL`: Set to `http://localhost:3000` for native local testing.

---

## Option 1: Direct Execution (Node.js & npm)

Ensure you have **Node.js 22+** installed on your workstation database structure.

### 1. Install Dependencies
Run npm package installation to populate your global caches:
```bash
npm install
```

### 2. Run in Development Mode (Hot-Reloading Server)
This starts the local web server with automatic tsx-compilation and live module hot-reloading:
```bash
npm run dev
```
- Open [http://localhost:3000](http://localhost:3000) to view the live app preview.

### 3. Build & Run for Production Simulation
Generate a compiled production bundle, then boot up the optimized static file server:
```bash
# Clean previous assets
npm run clean

# Package React code and minify bundle
npm run build

# Boot local production web server
npm run start
```

---

## Option 2: Docker Compose Integration (Recommended)

Docker isolates runtimes and locks down execution boundaries perfectly. Ports are mapped directly to `http://localhost:3000`.

### 1. Spin Up the Container
To build the Docker image and start the application container, execute:
```bash
docker compose up --build
```

### 2. Running in Background/Daemon Mode
You can spin the services into background tasks silently by running:
```bash
docker compose up -d
```

### 3. Stop and Remove Active Containers
To spin down containers and clean up networked ports:
```bash
docker compose down
```

---

## 🛠️ Diagnostics, Linting, & Cleanups

### Verify TS Type Safety and Lint Rules
```bash
npm run lint
```

### Reset Build Artifacts
```bash
npm run clean
```
