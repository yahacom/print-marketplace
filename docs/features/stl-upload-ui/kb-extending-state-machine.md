# KB: extending the upload UI state machine

Audience: engineers adding the quote / order-confirmation screens (PRD Goal 3) on top of stl-upload-ui.

## Where the state machine lives

- `src/ui/app.tsx` owns it. `UploadState` is a discriminated union on `status`: `idle → uploading → success | error`.
- `transitions` (same file) holds one pure function per move (`startUpload`, `progress`, `succeed`, `fail`, `reset`). `App` calls them from `useState`'s setter; it renders exactly one child per `status` in a `switch`.
- Components are presentational: they take props and call callbacks (`onFileSelected`). They never touch the network or the state directly.
- Network access is confined to `src/ui/upload-client.ts` (XHR, for upload progress). Failures reach the UI as an `UploadFailure` and are turned into user text only by `src/ui/errors.ts`.

## Adding a new screen (e.g. quote, order confirmation)

1. Add a variant to `UploadState`, carrying only the data that screen needs (e.g. `{ status: "quote"; fileId: string; ... }`).
2. Add a `transitions` entry that builds it. Keep transitions pure so they stay unit-testable without rendering.
3. Create `src/ui/components/<Screen>.tsx` as a presentational component with callback props.
4. Add a `case` to the `switch` in `App`. TypeScript's exhaustiveness on the union flags any missed state.
5. Wire the entry: the success path currently calls `transitions.succeed(file.name)` and drops the `file_id` returned by `submitUpload` (`UploadAccepted`). The quote flow needs it, so extend `succeed` (or add a new transition) to carry `file_id` forward.
6. New backend calls go in their own client module next to `upload-client.ts`, with new codes mapped in `errors.ts`.

## Rules to keep

- Render user-controlled strings (filenames) as text nodes only. No `dangerouslySetInnerHTML` or raw DOM string insertion (AC-06).
- Never show the backend `message` field; map `code` to fixed text in `errors.ts`.
- Add component tests per state and an integration test in `src/ui/app.integration.test.tsx` (mocked XHR) for each new transition.

## Limits of the current design

- `useState` plus a union is enough for a linear flow. If the flow gains back-navigation or many parallel states, reconsider before adding a state library; that is an architecture decision needing its own ADR.
- There is no router: the page is a single `/` served by `@fastify/static` from `dist-ui/`. Deep links to later screens need either a router or server-side routes.
