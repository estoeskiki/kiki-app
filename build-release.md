# Kiki — Build & Release Strategy

## Overview

| Phase | Approach | When to use |
|---|---|---|
| **Phase 1** | Manual EAS builds | Now — getting on hardware fast, one developer |
| **Phase 2** | GitHub Actions CI/CD | When the team grows or release cadence increases |

---

## Phase 1 — Manual Builds with EAS

> Goal: get a real APK onto the Senraise POS (and later kiosk tablet / kitchen tablet) as fast as possible.

### Prerequisites

```bash
# Install EAS CLI globally (one-time)
npm install -g eas-cli

# Log in to your Expo account
eas login
```

You need an [Expo account](https://expo.dev). The free tier is enough for manual builds.

---

### 1.1 — Configure EAS for the Admin App

```bash
cd apps/admin

# Initialize EAS for this app (one-time)
eas init

# This will create / update eas.json
eas build:configure
```

Commit the generated `eas.json`. It should look like this — edit if needed:

```json
{
  "cli": {
    "version": ">= 14.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

> **Note:** We use `buildType: "apk"` (not AAB) because we sideload onto the device — we're not going through the Play Store.

---

### 1.2 — Set Environment Variables in EAS

Secrets (Supabase URL, anon key) must be set in EAS — do **not** commit `.env` to git.

```bash
# Set production secrets (run once, they are stored in the EAS cloud)
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://your-project.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-anon-key"
```

Then update `apps/admin/app.json` to pull them in:

```json
{
  "expo": {
    "extra": {
      "supabaseUrl": "$(EXPO_PUBLIC_SUPABASE_URL)",
      "supabaseAnonKey": "$(EXPO_PUBLIC_SUPABASE_ANON_KEY)"
    }
  }
}
```

---

### 1.3 — Build the Admin APK

```bash
cd apps/admin

# Build a preview APK (internal distribution — no signing key required)
eas build --platform android --profile preview
```

EAS will:
1. Upload your code to Expo's build servers
2. Build the APK in the cloud (~5–10 min)
3. Give you a download link

Download the `.apk` → transfer to the Senraise POS via USB or download link → install.

> **Enable unknown sources on Android:** Settings → Security → Install unknown apps → allow for your file manager.

---

### 1.4 — Build Profiles

| Profile | Command | Use for |
|---|---|---|
| `preview` | `eas build --profile preview` | Testing on real hardware (APK, no Play Store) |
| `production` | `eas build --profile production` | Stable builds ready for permanent install |
| `development` | `eas build --profile development` | Development client for Expo Go replacement |

---

### 1.5 — Process for New Apps (Kiosk, KDS)

When setting up a new app in the monorepo for EAS, follow these exact steps (using `apps/kiosk` as the example):

**1. File Modifications**
- Edit `apps/kiosk/app.json`:
  - Change `android.package` to something unique (e.g., `"com.kiki.kiosk"`)
  - Add `"versionCode": 1` inside `android`
  - Add the `extra` object so EAS can inject env vars during the build:
    ```json
    "extra": {
      "supabaseUrl": "$(EXPO_PUBLIC_SUPABASE_URL)",
      "supabaseAnonKey": "$(EXPO_PUBLIC_SUPABASE_ANON_KEY)"
    }
    ```
- Edit `apps/kiosk/.gitignore`: ensure `.env` and `.env.*` are ignored so secrets aren't pushed.
- Copy `.npmrc` from Admin to Kiosk:
  ```bash
  echo "legacy-peer-deps=true" > apps/kiosk/.npmrc
  ```
- Copy `eas.json` from Admin to Kiosk:
  ```bash
  cp apps/admin/eas.json apps/kiosk/eas.json
  ```

**2. Terminal Setup Commands**
Run these inside the app directory (`cd apps/kiosk`):

```bash
# 1. Register the project on Expo (this assigns the projectId in app.json)
eas init

# 2. Upload the Supabase URL to both environments
eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "YOUR_URL" --type string --visibility plaintext --environment preview
eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "YOUR_URL" --type string --visibility plaintext --environment production

# 3. Upload the Supabase Anon Key to both environments
eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_KEY" --type string --visibility sensitive --environment preview
eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "YOUR_KEY" --type string --visibility sensitive --environment production

# 4. Trigger the build
eas build --platform android --profile preview
```

---

### 1.6 — Updating the App on the Device

For now, updating is manual:
1. Make code changes
2. Run `eas build --platform android --profile preview`
3. Download APK → sideload onto device (overwrites previous install)

---

## Phase 2 — CI/CD with GitHub Actions

> Goal: automated builds triggered by git events. Merge to `main` → new APK built and available for download/distribution.

### 2.1 — Repository Structure for CI/CD

Each app will have its own workflow file:

```
.github/
  workflows/
    build-admin.yml
    build-kiosk.yml
    build-kds.yml
    build-admin-web.yml
```

---

### 2.2 — GitHub Secrets

Add these to your GitHub repo (Settings → Secrets → Actions):

| Secret | Description |
|---|---|
| `EXPO_TOKEN` | Your EAS personal access token (`expo whoami --token`) |
| `SUPABASE_URL` | Production Supabase project URL |
| `SUPABASE_ANON_KEY` | Production Supabase anon key |

---

### 2.3 — Admin App Workflow (`build-admin.yml`)

```yaml
name: Build Admin APK

on:
  push:
    branches: [main]
    paths:
      - 'apps/admin/**'
      - 'packages/**'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: apps/admin/package-lock.json

      - name: Install dependencies
        run: npm install
        working-directory: apps/admin

      - name: Setup EAS
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Build APK
        run: eas build --platform android --profile production --non-interactive
        working-directory: apps/admin
        env:
          EXPO_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          EXPO_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

> This builds a new APK every time code under `apps/admin/` changes on `main`. The APK download link appears in the EAS dashboard.

---

### 2.4 — Kiosk and KDS Workflows

Same structure, scoped to their respective `paths`:

```yaml
# build-kiosk.yml
on:
  push:
    branches: [main]
    paths:
      - 'apps/kiosk/**'
      - 'packages/**'

# build-kds.yml
on:
  push:
    branches: [main]
    paths:
      - 'apps/kds/**'
      - 'packages/**'
```

---

### 2.5 — Admin Web Workflow (`build-admin-web.yml`)

```yaml
name: Deploy Admin Web

on:
  push:
    branches: [main]
    paths:
      - 'apps/admin-web/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install & Build
        run: |
          npm install
          npm run build
        working-directory: apps/admin-web

      # Add Vercel / your hosting provider deploy step here
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: apps/admin-web
```

---

### 2.6 — Branching Workflow

```
main          → production builds (auto-triggered)
develop       → integration branch (optional: preview builds)
feature/*     → feature branches, no ci build
```

**Recommended flow:**
1. Work on `feature/my-feature`
2. Open PR → code review
3. Merge to `main` → CI triggers build automatically
4. Download APK from EAS dashboard → test → sideload

---

### 2.7 — OTA Updates with Expo EAS Update (optional)

For **bug fixes that don't touch native code**, you can push updates without rebuilding the full APK:

```bash
# Push a JS-only update to devices already running the app
eas update --branch production --message "Fix order status bug"
```

Devices check for updates on launch and apply them silently. This makes hotfixes instant — no sideloading needed.

> This only works for JS/TS changes. Any change to native modules (e.g., the Senraise printer SDK) requires a full APK rebuild.

---

## Summary

```
Today (Phase 1):
  eas build --platform android --profile preview   →   download APK   →   sideload onto Senraise

Later (Phase 2):
  git push main   →   GitHub Actions   →   EAS builds APK   →   available in dashboard
```
