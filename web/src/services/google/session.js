import { GOOGLE_SCOPES, DRIVE_SCOPE } from "./scopes.js";
import { OperationCancelled } from "../cancellation.js";
// Google authorization and token lifetime are independent of project UI and drafts.
export class GoogleSession {
  constructor(config, fetcher = globalThis.fetch.bind(globalThis)) {
    this.config = config;
    this.fetcher = fetcher;
    this.clear();
  }
  configured() {
    return (
      !!this.config.clientId &&
      !!this.config.apiKey &&
      /^\d+$/.test(this.config.appId || "")
    );
  }
  token() {
    return Date.now() < this.expires ? this.accessToken : "";
  }
  clear() {
    this.accessToken = "";
    this.expires = 0;
  }
  async initialize() {
    if (globalThis.google?.accounts?.oauth2) return;
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.onload = resolve;
      script.onerror = () =>
        reject(
          new Error(
            "Google sign-in could not load. Check your connection and try again.",
          ),
        );
      document.head.append(script);
    });
  }
  signIn({ requestConsent = false } = {}) {
    // Open Google's popup synchronously within the user's click handler.
    return new Promise((resolve, reject) => {
      const oauth = globalThis.google.accounts.oauth2;
      const client = oauth.initTokenClient({
        client_id: this.config.clientId,
        scope: GOOGLE_SCOPES,
        include_granted_scopes: false,
        error_callback: (error) =>
          reject(
            error?.type === "popup_closed"
              ? new OperationCancelled("Google sign-in cancelled.")
              : new Error(
                  error?.type === "popup_failed_to_open"
                    ? "Google sign-in couldn’t open. Allow pop-ups for this site, then try again."
                    : "Google sign-in was closed or blocked. Try again.",
                ),
          ),
        callback: (response) => {
          this.identify(response, oauth).then(resolve, reject);
        },
      });
      client.requestAccessToken({
        prompt: requestConsent ? "consent select_account" : "select_account",
      });
    });
  }
  async identify(response, oauth) {
    if (response.error)
      throw new Error(response.error_description || response.error);
    const drivePermissionGranted = oauth.hasGrantedAllScopes(
      response,
      DRIVE_SCOPE,
    );
    // Log only permission metadata, never the token response or account data.
    console.info("[Google sign-in] Permission check", {
      returnedScopes:
        typeof response.scope === "string"
          ? response.scope.split(/\s+/).filter(Boolean)
          : [],
      drivePermissionGranted,
    });
    if (!drivePermissionGranted) {
      const error = new Error(
        "Team access wasn’t granted. Choose Grant access, then check the file-access box on Google’s permission screen before continuing.",
      );
      error.code = "drive_permission_missing";
      throw error;
    }
    this.accessToken = response.access_token;
    this.expires = Date.now() + (Number(response.expires_in) - 60) * 1000;
    try {
      const result = await this.fetcher(
        "https://openidconnect.googleapis.com/v1/userinfo",
        { headers: { Authorization: `Bearer ${this.accessToken}` } },
      );
      if (!result.ok)
        throw new Error(
          "Could not identify your Google account. Sign in again.",
        );
      const account = await result.json();
      if (!account.sub) throw new Error("Google did not return an account ID.");
      return account;
    } catch (error) {
      this.clear();
      throw error;
    }
  }
}
