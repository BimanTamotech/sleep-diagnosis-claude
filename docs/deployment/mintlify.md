---
title: "Mintlify deployment"
description: "Host the docs site on Mintlify with continuous deploys from GitHub."
---

# Mintlify deployment

These steps show how to deploy the documentation portion of this project to Mintlify.

## Prerequisites

- A GitHub repository with this project pushed and accessible.
- A Mintlify account (https://mintlify.com).
- A Mintlify project linked to your GitHub repository.

## 1. Create and connect a Mintlify project

1. Sign in at https://mintlify.com.
2. Click **New project**.
3. Select **GitHub** and authorize Mintlify to access your repo.
4. Choose the repository that contains this project.

Mintlify will scan your repository and detect the documentation structure.

## 2. Configure the build settings

1. In the Mintlify dashboard, go to **Settings** → **Build**.
2. Set the **Build command** to:

```bash
mint build
```

3. Set the **Output directory** to:

```
build
```

4. (Optional) Set **Node version** to match the project (for example, `18.x`).

## 3. Add environment variables (if needed)

If your documentation build requires environment variables (for example, API keys used in snippets), add them in **Settings** → **Environment variables**.

> Note: Most documentation sites build without environment variables.

## 4. Preview locally (optional but recommended)

From the project root, run:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` to confirm the site renders correctly locally.

## 5. Deploy

1. Push your latest changes to GitHub.

```bash
git add docs/deployment/mintlify.md
git commit -m "Add Mintlify deployment guide"
git push
```

2. Mintlify will automatically start a deploy when it detects the push.
3. Wait for the deploy to complete and open the deployed URL shown in the Mintlify dashboard.

## 6. Verify the deployed site

- Visit the Mintlify deployment URL.
- Verify key pages render (for example, `/deployment/overview` and `/deployment/mintlify`).
- Use Mintlify’s preview links to validate changes before merging.

## 7. Update docs

Whenever you change docs content, commit and push the changes. Mintlify will rebuild and redeploy automatically.
