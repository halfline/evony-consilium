# Google Drive projects

The deployment model is an **External, In production** Google OAuth app requesting only `openid`, `email`, `profile`, and `https://www.googleapis.com/auth/drive.file`. Google classifies `drive.file` as non-sensitive. The app does not request full Drive access, read-only Drive access, or Drive metadata scopes. Previously granted scopes are not added to new token requests.

The site opens at Google sign-in, followed by a team selector. New teams start empty.

## Opening and sharing teams

1. Create a team. The app creates a folder containing one `team.consilium.json` file.
2. Share that folder or file using Drive's sharing controls and send its URL to teammates.
3. Paste the link in **Open team**. If authorization is needed, choose the single team file in Picker. A folder link opens Picker inside that folder; it does not require authorizing the folder first. The browse button also selects one team file.
4. Subsequent opens use the remembered file ID and its existing grant. Revoked access asks for that file again without requesting broader scopes.

A link and a remembered shortcut do not grant access. Picker authorization does not replace the owner's sharing permissions. Viewers can open a team and keep local drafts but cannot save to its shared file.

## Team document

`team.consilium.json` contains `{format: "evony-consilium-team", schema: 1, plan}`. The plan holds team name, logo, Discord link, players and their statistics and marches, and all maps and placements. Save writes this entire document.

Only the `evony-consilium-team` schema 1 envelope is supported. Older multi-file teams are not loaded or migrated. A folder with several team documents requires choosing one explicitly.

Team-file permissions govern roster and map administration. Player profiles are also stored in separate files in the central team folder, so each player file can be shared independently: write access enables profile editing, while team access alone does not. The team document keeps a read-only cache of those profiles. Adding a player checks central folder access before opening the form and asks for that folder through Picker only if needed.

Opening never initializes a seemingly empty shared folder: a filtered Drive listing is not proof that it is empty.

## Google Cloud setup

Use one Google Cloud project for all three public configuration values. No backend, service account, client secret, or stored refresh token is used.

1. Create a Google Cloud project and enable **Google Drive API** and **Google Picker API**.
2. Configure Google Auth Platform branding: app name, user support email, developer contact information, and applicable homepage/privacy-policy details. Use **External** audience for personal Gmail accounts and teams spanning organizations.
3. In **Data Access**, declare only `openid`, `email`, `profile`, and `https://www.googleapis.com/auth/drive.file`. Remove old broad Drive scopes from this deployment's consent configuration. Google's [scope documentation](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) classifies `drive.file` as non-sensitive; branding/basic verification requirements can still apply.
4. Create an OAuth client of type **Web application**. Add authorized JavaScript origins, for example `https://USERNAME.github.io` and `http://127.0.0.1:4173`. Origins do not include `/evony-consilium/`. The current popup token flow does not use a server redirect endpoint.
5. Create a public browser **API key** for Google Picker. Restrict it to Google Picker API. With Website restrictions, allow the deployment (`https://USERNAME.github.io/*`), any actual development origin, and **`https://docs.google.com/*`**, because Picker runs in a Google-hosted iframe. The app's direct Drive requests use OAuth tokens, not the API key. Follow Google's [Picker setup and key restrictions](https://developers.google.com/workspace/drive/picker/guides/web-picker).
6. Find the numeric **Cloud project number**, not the textual project ID. Picker's app ID must be this number from the same project as the OAuth client and API key.
7. Set `GOOGLE_CLIENT_ID`, `GOOGLE_PICKER_API_KEY`, and `GOOGLE_CLOUD_PROJECT_NUMBER` in the environment for local development. Add the same names as GitHub Actions repository secrets for Pages. The build writes `dist/google-config.js`; the development server serves the values from its environment. These browser settings are visible in the deployed JavaScript, so restrict the key and OAuth client to the intended origins and APIs.

8. Change the audience publishing status to **In production** for deployment. Build and publish the static site. Check branding/verification prompts in the console; production publishing and branding verification are separate actions.

In **Testing**, Drive authorization still requires manually listed test accounts (up to 100) and expires after seven days, even with `drive.file`. In **production**, that testing-specific seven-day expiry and test-user list do not apply. The lifetime 100-user limit for unapproved sensitive/restricted scopes does not apply to this non-sensitive-only scope configuration. Normal token expiry, account policies, app quotas, and revoked user consent still apply. See [Google's audience and cap rules](https://support.google.com/cloud/answer/15549945?hl=en).

A Cloud project remains necessary. It is the testing consent that expires, not the Cloud project. Production mode does not make OAuth access tokens permanent.

Without complete configuration, the login screen explains which configuration is needed and keeps sign-in disabled. Browser tests mock OAuth, Picker and Drive at the network boundary, including per-file grants. Actual Google authorization must still be validated with the deployment's own credentials.

## Live deployment check

Use two distinct Google accounts, ideally personal Gmail accounts:

- Sign in as the creator, create an empty project, add a keep, save, and share the project folder with the second account.
- Sign in as the teammate in a separate browser profile. Paste the folder link, select the single team file in Picker. Open the same formation and verify a save with editor permissions.
- Reload and reopen the remembered project without selecting files again. Test cancelled Picker dialogs and missing/revoked access. If a file was truly deleted or moved, repair the folder in Drive rather than initializing it again.
- Give the teammate view-only permission and verify they can open but cannot save over the formation. Test the draft conflict behavior after the creator changes the Drive version.
- Confirm the requested Drive permission is for files used with the app, not all Drive files. If testing an account that granted full Drive access to an earlier build, remove that old app connection in Google Account settings before this check. Narrow token requests do not erase an earlier account-wide grant.

## Persistence and collaboration

`localStorage` stores recently opened project folders separately for each Google account ID. It is a convenience list, not authority for access. OAuth access tokens stay in memory. Reloads return to sign-in, then the remembered-project selector. Expired tokens require another sign-in, following [Google's browser token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model).

IndexedDB keeps account/folder/file-scoped drafts, including imported images. Editing saves a local draft; **Save** writes the entire team document. The original version is retained with a dirty draft, so restoring it cannot silently ignore a teammate's newer version. **Load latest** replaces the local draft with the shared version.

A save checks the current Drive version and refuses a known stale version. This is best-effort, not an atomic lock: two users saving between the metadata check and upload can still race. Coordinate writes for now; live collaborative editing and robust concurrency control remain future work. Drive revisions can help recover overwritten content.
