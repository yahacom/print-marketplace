import { type App, cert, initializeApp } from "firebase-admin/app";

const CREDENTIALS_ENV = "FIRESTORE_CREDENTIALS_JSON";

let app: App | undefined;

// Returns the process-wide Firebase app (ADR-0002). firebase-admin throws on a
// second default-app init, so every module that needs Firestore shares this
// one. The service-account key is read from FIRESTORE_CREDENTIALS_JSON (the
// JSON itself, not a path). The credential is validated on every call, so a
// missing or malformed value fails fast even after the app was initialized.
// Errors never include the credential value.
export const getFirestoreApp = (env: NodeJS.ProcessEnv = process.env): App => {
  const rawCredentials = env[CREDENTIALS_ENV];
  if (!rawCredentials) {
    throw new Error(`${CREDENTIALS_ENV} is not set; cannot connect to Firestore`);
  }

  let serviceAccount: unknown;
  try {
    serviceAccount = JSON.parse(rawCredentials);
  } catch {
    throw new Error(`${CREDENTIALS_ENV} is not valid JSON`);
  }

  app ??= initializeApp({ credential: cert(serviceAccount as Parameters<typeof cert>[0]) });
  return app;
};
