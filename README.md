# Incirql

Incirql is a React + Vite app with a mobile-first strategy chat experience.

## Prerequisites

- Node.js 20+
- npm 10+

## Run locally

```bash
npm install
npm run dev
```

## Build for production

```bash
npm run build
npm run preview
```

## Deploy to Vercel

1. Push this folder to GitHub.
2. Import the repo in Vercel.
3. Framework preset: Vite.
4. Build command: npm run build.
5. Output directory: dist.
6. Add environment variable VITE_GEMINI_API_KEY.

## API key setup

Create a .env file from .env.example and set:

```bash
VITE_GEMINI_API_KEY=your_key_here
VITE_GEMINI_MODEL=gemini-2.5-flash
VITE_GEMINI_FALLBACK_MODELS=gemini-2.5-flash
```

The app retries transient model/network failures automatically with exponential backoff.
If the primary model is overloaded, it will try fallback models from `VITE_GEMINI_FALLBACK_MODELS`.

## Android prep for Play Store (later)

1. Build web app:

```bash
npm run build
```

2. Add Android project (one time):

```bash
npx cap add android
```

3. Sync web build into Android project:

```bash
npm run cap:sync
```

4. Open Android Studio:

```bash
npm run cap:open:android
```

From Android Studio, generate signed AAB and publish in Google Play Console.
