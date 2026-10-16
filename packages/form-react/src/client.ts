import type { ValidationError } from "@coderlifenet/form-core";

export class FormRequestError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string, public readonly fieldErrors: ValidationError[] = []) {
    super(message);
    this.name = "FormRequestError";
  }
}

/** Browser transport only; hosts retain control of mounting, authentication and CSRF. */
export function createFormApiClient(options: { baseUrl: string; fetch?: typeof fetch; credentials?: RequestCredentials; headers?: HeadersInit }) {
  return async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers);
    if (init.body !== undefined && typeof init.body === "string") headers.set("content-type", "application/json");
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    const response = await (options.fetch ?? fetch)(`${options.baseUrl.replace(/\/$/, "")}${path}`, { credentials: options.credentials ?? "include", ...init, headers });
    if (!response.ok) {
      const parsed = await response.json().catch(() => ({}));
      const body = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      const fieldErrors = Array.isArray(body.fieldErrors) ? body.fieldErrors.filter((error: ValidationError) => typeof error?.fieldId === "string" && typeof error.code === "string" && typeof error.message === "string") : [];
      throw new FormRequestError(response.status, typeof body.code === "string" ? body.code : "REQUEST_FAILED", typeof body.message === "string" ? body.message : `Request failed (${response.status})`, fieldErrors);
    }
    return response.status === 204 ? undefined as T : await response.json() as T;
  };
}

/** Keep one instance per mutation flow. Reuse a key after a lost response; change it when the payload changes. */
export function createMutationRetryKey() {
  let pending: { payload: string; key: string } | undefined;
  return {
    keyFor(payload: string): string {
      if (!pending || pending.payload !== payload) pending = { payload, key: crypto.randomUUID() };
      return pending.key;
    },
    committed(): void { pending = undefined; }
  };
}
