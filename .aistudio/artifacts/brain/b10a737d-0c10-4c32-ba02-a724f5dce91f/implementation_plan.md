# Repository Cleanup: Remove Single-Use & Obsolete Files

A plan to identify, delete, and document all single-use and irrelevant files and folders across the Nanobot repository, prune unused dependencies, and keep the README project structure synchronized.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following files and folders have been identified as single-use or irrelevant to Nanobot's runtime functionality:
> - **`scripts/generate-preview.js` & `scripts/`**: A one-time generation script created solely to generate `public/preview.png`. The preview PNG is already saved in `public/preview.png`. The script and its folder are no longer needed.
> - **`bun.lock`**: A leftover Bun lockfile. Nanobot runs on Node.js 20 and uses `npm` exclusively with `package-lock.json` across Netlify and GitHub Actions. `bun.lock` is completely unused.
> - **`dist/`**: An ephemeral local build artifact directory ignored by `.gitignore`.
> - **`sharp`**: A heavy native dependency in `package.json` installed only for `generate-preview.js`. It is not used in `src/` or `worker/` and will be cleanly pruned from `package.json`.

- **Confirmed Decision 1**: Delete `scripts/generate-preview.js` and delete the `scripts/` directory.
- **Confirmed Decision 2**: Delete the obsolete `bun.lock` file.
- **Confirmed Decision 3**: Delete the local generated `dist/` directory.
- **Confirmed Decision 4**: Remove the unused `sharp` dependency from `package.json` and sync `package-lock.json`.
- **Confirmed Decision 5**: Update the "Project Structure" tree in `README.md` to reflect the removed paths, accompanied by the mandatory comment format.

---

### 1. Overview & Core Concept

- **What It Does**: Purges all once-used, dead, and redundant files, directories, and package dependencies from the Nanobot repository, leaving only essential production source files, configurations, CI workflows, and documentation.
- **Target Audience / Purpose**: Clean repository maintenance for open-source deployment, fast CI installation, and clarity for contributors and automated build runners.
- **Key Value**: Eliminates developer confusion, reduces repository bloat, prevents CI lockfile conflicts, and keeps `README.md` in 100% parity with the filesystem.

---

### 2. File Removal & Modification Inventory

```
┌─────────────────────────────────┬──────────┬────────────────────────────────────────────────────────┐
│ Path                            │ Action   │ Rationale                                              │
├─────────────────────────────────┼──────────┼────────────────────────────────────────────────────────┤
│ scripts/generate-preview.js     │ Delete   │ One-time script; preview.png is already in public/    │
│ scripts/                        │ Delete   │ Empty folder once generate-preview.js is deleted       │
│ bun.lock                        │ Delete   │ Irrelevant lockfile; repo strictly uses npm            │
│ dist/                           │ Delete   │ Ephemeral build folder; regenerated during build       │
│ package.json                    │ Edit     │ Remove unused "sharp": "^0.35.5" dependency            │
│ package-lock.json               │ Regenerate │ Synchronize lockfile after removing sharp            │
│ README.md                       │ Edit     │ Remove scripts/ entry from Project Structure tree      │
└─────────────────────────────────┴──────────┴────────────────────────────────────────────────────────┘
```

---

### 3. Key Decisions & Rationale

- **Decision 1: Delete `scripts/` entirely**
  - *Chosen Approach*: Remove `scripts/generate-preview.js` and delete the `scripts/` directory.
  - *Why*: The script's sole purpose was to rasterize SVG into `public/preview.png`. That output asset is already committed to `public/preview.png` and embedded in the web app. Keeping the script adds 25MB of native dependency bloat (`sharp`) with zero runtime value.
- **Decision 2: Delete `bun.lock`**
  - *Chosen Approach*: Delete the 49KB `bun.lock` file from the repository root.
  - *Why*: Nanobot is configured for `npm` (Node.js 20). Netlify runs `npm run build`, and GitHub Actions runs `verify-frontend.yml` with `npm install` and `package-lock.json`. The Bun lockfile is unused and previously triggered CI setup errors.
- **Decision 3: Prune `sharp` from `package.json`**
  - *Chosen Approach*: Remove `sharp` from `dependencies` and run `npm install` to update `package-lock.json`.
  - *Why*: Eliminates unnecessary compilation time and dependencies during CI/CD.
- **Decision 4: Update `README.md` Project Structure**
  - *Chosen Approach*: Remove the `scripts/` entry from the ASCII tree in `README.md`, keeping all other production paths intact. Include the required Google AI Studio comment with timestamp in DD/MM/YYYY HH:MM AM/PM format.

---

### 4. Technical Architecture & Execution Strategy

```
┌────────────────────────────────────────────────────────┐
│              Nanobot Repository Root                   │
├────────────────────────────────────────────────────────┤
│  KEEP (Essential):                                     │
│  ├── .env.example / .gitignore / metadata.json         │
│  ├── .github/workflows/ (deploy-worker, verify-front)  │
│  ├── index.html / vite.config.ts / tsconfig.json       │
│  ├── netlify.toml                                      │
│  ├── package.json & package-lock.json (pruned)         │
│  ├── public/ (preview.png)                             │
│  ├── src/ (App, components, lib, index.css)            │
│  ├── supabase/ (schema.sql)                            │
│  └── worker/ (src, schema.sql, wrangler.toml)          │
│                                                        │
│  REMOVE (Obsolete / Single-Use):                       │
│  ├── ❌ scripts/generate-preview.js & scripts/         │
│  ├── ❌ bun.lock                                       │
│  └── ❌ dist/                                          │
└────────────────────────────────────────────────────────┘
```

#### Step-by-Step Execution Sequence
1. Delete `scripts/generate-preview.js` using `delete_file`.
2. Delete `scripts/` directory using `delete_dir`.
3. Delete `bun.lock` using `delete_file`.
4. Delete `dist/` directory using `delete_dir`.
5. Remove `"sharp": "^0.35.5"` from `package.json`.
6. Update `README.md` to remove `scripts/` from the Project Structure ASCII tree, including the timestamped comment.
7. Run `npm install` and verify `npm run lint` and `npm run build` pass without errors.
