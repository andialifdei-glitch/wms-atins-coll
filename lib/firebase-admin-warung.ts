import { SignJWT, importPKCS8 } from "jose";

const WARUNG_IDENTITY_SCOPES = [
  "https://www.googleapis.com/auth/identitytoolkit",
  "https://www.googleapis.com/auth/cloud-platform",
];

const WARUNG_DATASTORE_SCOPES = [
  "https://www.googleapis.com/auth/datastore",
  "https://www.googleapis.com/auth/cloud-platform",
];

export const WARUNG_PROJECT_ID = "operasional-warung";

function getServiceAccount() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_WARUNG || "";
  if (!b64) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_WARUNG belum diset di environment.");
  }
  const json = Buffer.from(b64, "base64").toString("utf8");
  return JSON.parse(json);
}

export async function getWarungAccessToken(scopes: string[]): Promise<string> {
  const sa = getServiceAccount();
  const privateKey = await importPKCS8(sa.private_key, "RS256");
  const now = Math.floor(Date.now() / 1000);

  const jwt = await new SignJWT({
    iss: sa.client_email,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .sign(privateKey);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=" + jwt,
  });
  if (!res.ok) {
    throw new Error("Gagal dapat access token WARUNG: " + (await res.text()));
  }
  const data: any = await res.json();
  return data.access_token;
}

export function warungDatastoreBase() {
  return `https://firestore.googleapis.com/v1/projects/${WARUNG_PROJECT_ID}/databases/(default)/documents`;
}

export async function warungFsFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getWarungAccessToken(WARUNG_DATASTORE_SCOPES);
  const headers: any = { ...(init.headers || {}) };
  headers["Authorization"] = `Bearer ${token}`;
  if (init.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  return fetch(path, { ...init, headers, cache: "no-store" });
}

export async function warungAdminCreateUser(email: string, password: string, displayName: string) {
  const token = await getWarungAccessToken(WARUNG_IDENTITY_SCOPES);
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${WARUNG_PROJECT_ID}/accounts`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email, password, displayName, emailVerified: false }),
  });
  const data: any = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "WARUNG_CREATE_USER_FAILED");
  return data;
}