# My Hub

A dashboard of social media and learning links. It saves changes automatically in one of two ways.

## Option A: GitHub Pages (no server, free)
Changes are saved by committing `docs/data/state.json` to your repository.

1. Create a public GitHub repository and upload everything in this folder.
2. Open `docs/config.js` and set `repo` to `your-username/your-repo`.
3. Settings > Pages > Source: "Deploy from a branch", branch `main`, folder `/docs`.
4. Create a token: Settings > Developer settings > Personal access tokens > Fine-grained tokens.
   Repository access: only this repository. Permissions: Contents = Read and write.
5. Open your site (https://your-username.github.io/your-repo/), click Connect GitHub, paste the token.

After that, every add, remove or pin is committed to the repository. Visitors see the list but cannot change it,
because only a browser with your token can save. The token is stored in that browser only. Do not share it.
The repository is public, so the list of links is public too. Visitors see updates about a minute after each commit.

## Option B: Your own Node server
    node server.js        # then open http://localhost:3000
Needs Node.js 16 or newer. Links are saved to `data/state.json` on the server.
Environment variables: PORT, EDIT_PASSWORD (require a password to change links), DATA_FILE.
Use a host with a persistent disk (Render, Railway, Fly.io, a VPS). GitHub Pages cannot run this server.

## Backup
Use Export links / Import links on the page.
