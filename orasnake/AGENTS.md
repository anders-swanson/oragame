# Orasnake Agent Notes

## Project Shape

Orasnake is a client-only Vite, TypeScript, and Phaser arcade snake game. The runtime entrypoint is `src/main.ts`, scenes live in `src/scenes`, pure game logic lives in `src/game`, and bundled Oracle topic content lives in `src/content/oracleFacts.ts`.

## Commands

- `npm run dev` starts the local Vite server.
- `npm test` runs the Vitest suite.
- `npm run build` runs TypeScript checking and creates the production bundle.
- `npm run preview` serves the built bundle.

Run `npm test` for logic/content changes. Run `npm run build` when touching scene code, imports, types, or build-facing assets.

## Implementation Guidance

- Keep deterministic game rules in `src/game` where they can be unit tested.
- Keep Phaser rendering, input, particles, and scene transitions in `src/scenes`.
- Prefer small behavioral helpers over embedding complex state transitions directly in render methods.
- Do not hand-edit generated `dist` output unless the task explicitly asks for a built artifact.
- Preserve the bundled Oracle fact pack structure: every topic should keep valid prompts, source paths, source URLs, icon paths, and display copy.
- When changing gameplay behavior, update or add focused Vitest coverage in `src/game/*.test.ts` where practical.

## Visual QA

For visible gameplay or layout changes, run the app locally and smoke-check the Phaser canvas in a browser. Confirm there are no console errors and that desktop and compact layouts still fit without overlapping HUD, playfield, side panel, or prompt text.
