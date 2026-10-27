import { SignJWT, importPKCS8 } from "jose";

const IDENTITY_SCOPES = [
  "https://www.googleapis.com/auth/identitytoolkit",
  "https://www.googleapis.com/auth/cloud-platform",
];

function getServiceAccount() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT || "";
  if (!b64) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT belum diset di environment.");
  }
  const json = Buffer.from(b64, "base64").toString("utf8");
  return JSON.parse(json);
}

export async function getGoogleAccessToken(scopes: string[]): Promise<string> {
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
    throw new Error("Gagal dapat access token Google: " + (await res.text()));
  }
  const data: any = await res.json();
  return data.access_token;
}

export async function adminCreateUser(email: string, password: string, displayName: string) {
  const token = await getGoogleAccessToken(IDENTITY_SCOPES);
  const sa = getServiceAccount();
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${sa.project_id}/accounts`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ email, password, displayName, emailVerified: false }),
  });
  const data: any = await res.json();
  if (!res.ok) {
    const errMsg = data?.error?.message || "CREATE_FAILED";
    throw new Error(errMsg);
  }
  return data;
}

export async function adminSetPassword(uid: string, newPassword: string) {
  const token = await getGoogleAccessToken(IDENTITY_SCOPES);
  const sa = getServiceAccount();
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${sa.project_id}/accounts:update`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ localId: uid, password: newPassword }),
  });
  const data: any = await res.json();
  if (!res.ok) {
    const errMsg = data?.error?.message || "SET_PASSWORD_FAILED";
    throw new Error(errMsg);
  }
  return data;
}

export async function adminDeleteUser(uid: string) {
  const token = await getGoogleAccessToken(IDENTITY_SCOPES);
  const sa = getServiceAccount();
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${sa.project_id}/accounts:delete`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ localId: uid }),
  });
  const data: any = await res.json();
  if (!res.ok) {
    const errMsg = data?.error?.message || "DELETE_FAILED";
    throw new Error(errMsg);
  }
  return data;
}

export async function adminDisableUser(uid: string, disabled: boolean) {
  const token = await getGoogleAccessToken(IDENTITY_SCOPES);
  const sa = getServiceAccount();
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${sa.project_id}/accounts:update`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ localId: uid, disableUser: disabled }),
  });
  const data: any = await res.json();
  if (!res.ok) {
    const errMsg = data?.error?.message || "DISABLE_FAILED";
    throw new Error(errMsg);
  }
  return data;
}