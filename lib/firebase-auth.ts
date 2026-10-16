const FIREBASE_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "";

export async function verifyUserPassword(email: string, password: string) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data: any = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "AUTHENTICATION_FAILED");
  }
  return data;
}

export async function createAuthUser(email: string, password: string, displayName: string) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName, returnSecureToken: true }),
  });
  const data: any = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "CREATE_USER_FAILED");
  }
  return data;
}

export async function deleteAuthUser(idToken: string) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${FIREBASE_API_KEY}`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
}