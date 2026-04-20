# Repository Guidelines

## Project Structure & Module Organization

This is an Electron desktop app with a Vite/React renderer and Node/Express proxy. Renderer code lives in `src/`: UI in `src/components`, pages in `src/pages`, routing in `src/router`, Zustand state in `src/store`, API/map clients in `src/services`, types in `src/types`, and helpers in `src/utils`. Electron entry points are `electron/main.ts` and `electron/preload.ts`. The proxy starts from `server/index.js`. Static assets belong in `public/`; sample media belongs in `example/`.

## Build, Test, and Development Commands

- `npm ci` installs locked dependencies for local or CI use.
- `npm run dev` starts the Electron app through `electron-vite`.
- `npm run dev:web` starts the browser-only Vite renderer.
- `npm run dev:server` starts the Express proxy on the configured server port.
- `npm run dev:all` starts the web renderer and Express proxy together.
- `npm run test` runs the Vitest unit test suite once.
- `npm run typecheck` runs TypeScript project checks without emitting files.
- `npm run build` runs the Electron/Vite production build into `dist/`.
- `npm run package` creates the Windows portable zip in `dist-electron/`.
- `npm run preview` previews the built Electron app.

CI uses Node.js 22 and runs `npm ci`, `npm run build`, and `npm run package`.

## Coding Style & Naming Conventions

Use TypeScript for renderer and Electron code. Follow the existing style: two-space indentation, single quotes, semicolons, and named exports for components/utilities. Name React components in PascalCase (`CameraMapPanel.tsx`), hooks with `use` prefixes (`useBaiduMap.ts`), and stores similarly (`useAppStore.ts`). Prefer the `@/` alias for imports from `src`.

## Testing Guidelines

Vitest is configured through `vitest.config.ts`. Prefer colocated `*.test.ts`, `*.test.tsx`, or `*.test.js` files near the code under test. Before submitting behavior changes, run `npm run test`, `npm run typecheck`, and `npm run build`.

## Commit & Pull Request Guidelines

Recent commits use Conventional Commit-style prefixes, often with scopes: `feat:`, `feat(electron):`, `build:`, and `ci(workflow):`. Keep commits focused and imperative. Pull requests should include a behavior summary, verification commands, linked issues when applicable, and screenshots or recordings for UI changes.

## Security & Configuration Tips

Copy `.env.example` to `.env` and `.env.server.example` to `.env.server`; never commit real `.env` files. Keep Qwen API keys only in the server environment. Restrict Baidu Map browser AK usage by Referer, and ensure local development origins such as `http://localhost:5173` are explicitly allowed.
