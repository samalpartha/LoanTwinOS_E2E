export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8010";

async function handle(res: Response) {
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText);
  }
  return res.json();
}

export async function createLoan(name: string) {
  return handle(await fetch(`${API_BASE}/api/loans`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({name})
  }));
}

export async function createSampleLoan() {
  return handle(await fetch(`${API_BASE}/api/loans/sample`, { method: "POST" }));
}

export async function socialLogin(full_name: string, email: string, social_provider: string) {
  return handle(await fetch(`${API_BASE}/api/auth/social-login`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ full_name, email, social_provider })
  }));
}

export async function login(email: string, password: string) {
  return handle(await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ email, password })
  }));
}

export async function register(full_name: string, email: string, password: string) {
  return handle(await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ full_name, email, password })
  }));
}

export async function uploadDoc(loanId: number, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return handle(await fetch(`${API_BASE}/api/loans/${loanId}/documents`, { method: "POST", body: fd }));
}

export async function getLoanDocuments(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/loans/${loanId}/documents`));
}

export async function processDoc(loanId: number, documentId: number) {
  return handle(await fetch(`${API_BASE}/api/loans/${loanId}/process-document/${documentId}`, { method: "POST" }));
}

export async function getDLR(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/loans/${loanId}/dlr`));
}

export async function getClauses(loanId: number, query?: string) {
  const q = query ? `?query=${encodeURIComponent(query)}` : "";
  return handle(await fetch(`${API_BASE}/api/loans/${loanId}/clauses${q}`));
}

export async function getObligations(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/loans/${loanId}/obligations`));
}

export async function getTradePack(loanId: number) {
  return handle(await fetch(`${API_BASE}/api/loans/${loanId}/trade-pack`));
}

export function getDocumentUrl(documentId: number) {
  return `${API_BASE}/api/documents/${documentId}/file`;
}

export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    return res.ok;
  } catch (e) {
    return false;
  }
}
