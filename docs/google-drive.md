# Google Drive projects

The deployment model is an **External, In production** Google OAuth app requesting only `openid`, `email`, `profile`, and `https://www.googleapis.com/auth/drive.file`. Google classifies `drive.file` as non-sensitive. The app does not request full Drive access, read-only Drive access, or Drive metadata scopes. Previously granted scopes are not added to new token requests.

The site opens at Google sign-in, followed by a team selector. New teams start empty.

## Opening and sharing teams

1. Create a team. The app creates a folder containing one `Team - <name>.team.consilium.json` file.
2. Share that folder or file using Drive's sharing controls and send its URL to teammates.
3. Paste the link in **Open team**. If authorization is needed, choose the single team file in Picker. A folder link opens Picker inside that folder; it does not require authorizing the folder first. The browse button also selects one team file.
4. Subsequent opens use the remembered file ID and its existing grant. Revoked access asks for that file again without requesting broader scopes.

A link and a remembered shortcut do not grant access. Picker authorization does not replace the owner's sharing permissions. Viewers can open a team and keep local drafts but cannot save to its shared file.

## Team document

The team file contains `{format: "evony-consilium-team", schema: 1, plan}`. The plan holds team name, logo, Discord link, players and their statistics and marches, and all maps and placements. Save writes this entire document.

Only the `evony-consilium-team` schema 1 envelope is supported. Older multi-file teams are not loaded or migrated. A folder with several team documents requires choosing one explicitly.

Team-file Editor access permits roster and map administration. Player files have independent permissions: share the folder as Viewer with members and grant each member Editor access to their own profile. Folder Editors inherit editing permission on its files; use that role only for trusted administrators. A planner can have Editor access to just the team document, but needs permission to add children to create new player files. Roster alt ownership does not grant Drive access.

The Team screen exposes the app link and links to the team document and folder in Drive; the player screen exposes its source file. **Connect player file** selects only the linked profile when an app grant is missing. **Check editing access** queries Drive directly; it does not reopen Picker when a file is already connected. Read-only users keep viewing the cached team data. Accessible sources refresh locally even without an online team editor.

New team/player files use distinct `application/vnd.evony-consilium.team+json` and `application/vnd.evony-consilium.player+json` MIME types and role-prefixed names. Picker uses list mode, limits selection to one file, and includes existing JSON documents in the same list as the new Drive types. The initial filename search narrows browsing to team or player documents; the app validates the selected document's contents. Connections target the known file ID without a filename search, so renaming a linked file does not prevent authorization. Existing documents adopt the new type/name on save. Submitting the New player form requests central folder access only when needed; the small import icon selects an existing player file from that folder. Cancelling either picker keeps the team intact and returns to the form. No automatic folder discovery adds players.

Opening never initializes a seemingly empty shared folder: a filtered Drive listing is not proof that it is empty.

## Notes and their audiences

Each note is a separate `{format: "evony-consilium-note", schema: 1, note}` JSON file, named `Note - <team> - <player> - <title> [<short ID>].note.consilium.json` with MIME type `application/vnd.evony-consilium.note+json`. Notes apply equally to regular players and alts. A linked profile file provides the stable subject identity, so changing alt ownership does not move or relabel its notes. Embedded profiles use a team/player identity; those existing notes remain attached if the profile later gets a central file. Attaching a note validates that identity; arbitrary documents and another player's notes are rejected.

**New note** defaults to **Only me**, creating the file in an app-created **Consilium - Personal notes** folder in the signed-in account's My Drive. The app checks that folder for inherited sharing before creating a private note. **Specific people** uses the same storage and explicitly grants each entered Google account Viewer or Editor permission on that one file. Additional recipients can be added after creation. Sharing may send Google's normal notification. Recipient permissions, permission removal, moving files, and deletion remain manageable in Drive. If the app cannot inspect all permissions, the audience label says **Access in Drive** rather than claiming the note is private.

**Team** stores the source directly in the shared team folder and inherits its permissions. Creating a file needs `canAddChildren` on that folder, separately from Editor access to the team document. A member with those creation permissions can save a team note without team Editor access. The app reports missing folder permissions and suggests a personal note followed by an editor-created team copy. It does not request broader Drive scopes or change folder permissions.

The team document contains only published team-note attachments and snapshots, in `plan.teamNotes`. Personal/restricted note bodies, titles, recipients, and references never enter that cache. **Create team copy** is an explicit publication step: it creates a new team source and retains the personal original. Team-file readers can see published snapshots regardless of source-file authorization. Moving or restricting a source stops subsequent publication but does not retract its previous snapshot; a team editor must remove the published attachment, and collaborators may already retain copies.

### Connecting and publishing under `drive.file`

Sharing a Drive folder or selecting it in Picker does not authorize every existing child file for the app. A non-editor's new team note therefore says **awaiting publication** until an editor follows its Consilium link, uses **Unlock linked note**, and selects that exact file in Picker. The app then shows **Publish to team**, allowing review before adding the source snapshot to the team cache. There is no automatic discovery of unpublished notes. Send the copied note link to an editor outside the app; the app does not send that request for you.

An account-owned `Consilium - Personal notes index.json` file stores its note connections and personal-folder reference **inside the account's Consilium - Personal notes folder**, alongside personal note files. The app creates that folder only when it needs to save an attachment or create a note, including for people who only attach shared notes or contribute team notes. It never creates the index directly in My Drive's root or in a shared team folder. It uses `application/vnd.evony-consilium.notes-index+json` and an app-private discovery property. Discovery filters to files owned by the signed-in account and accessible under `drive.file`. The index contains no note text. A recipient connecting a shared personal note records it in their own index. Copying a note link itself grants neither app authorization nor Drive permission; recipients also need access to the linked team to open its player context.

Note filenames include the team and player names at creation, the note title, and a short note ID, for example `Note - Avalon - Ice - Growth [01234567].note.consilium.json`. Those creation labels remain with the note when it is shared or edited from another team; changing its title updates the filename. The app identifies attachments by Drive file ID and associates them with the player's source identity, independently of filenames. Matching titles across teams, players, or multiple notes do not overwrite one another.

An editor's remembered published-note connections refresh the shared cache every 30 seconds while the team is open, visible, and authenticated, without opening the Notes tab. An editor lacking a source connection reads its last published snapshot until they unlock it. Source revision checks avoid redundant cache uploads. Removing a published attachment wins over a concurrent refresh; background work cannot rediscover it.

An optional [team-owned Apps Script job](apps-script.md) refreshes already-linked players and published team notes without any browser open. It uses separate administrator authorization with full Drive scope, restricted by the implementation to the configured team folder. It does not alter the browser's scopes, grant browser access to sources, discover new roster entries, publish new notes, or inspect personal note indexes. The default remains browser synchronization until a team installs that job.

### Note drafts and conflicts

New-note drafts use account/subject-scoped IndexedDB records; existing drafts use account/source-file keys. Both remain separate from player and team drafts. Existing editable notes autosave at the normal interval, and **Save note** saves immediately. The note dialog's timer also saves existing drafts while it is open. Creating a new note always requires an explicit save. Title and text merge independently, with the entire body treated as one conflict unit; review shows the latest source text and offers **Save my version** or **Use latest version**. A later source revision requires renewed review. A changed subject or audience blocks saving a recovered draft. Note uploads use the same strong ETag preconditions as team/player writes. Edits arriving during an upload remain pending, and failed saves retain local drafts.

Note publication transforms only the shared team baseline, so an unrelated unfinished formation cannot be included. Source saves and publication remain separate transactions. **Undo team** does not undo source-file saves or note publication. Removing a player removes its published note attachments while retaining source files and account-private connections for deliberate later recovery.

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
- Create a personal note and share it with the second account as Viewer. Verify that its text and reference stay outside the team file and that the recipient explicitly connects the source to read it. Test an Editor recipient and competing note edits as well.
- With the teammate able to add files to the shared folder but unable to edit the team document, create a team note, send its app link to the creator, and unlock/publish it. Change its source in the teammate's session and verify publication from the creator's next background interval, including after reloading without opening Notes. Verify cancelled Picker, missing folder permissions, and revoked source access.
- Confirm the requested Drive permission is for files used with the app, not all Drive files. If testing an account that granted full Drive access to an earlier build, remove that old app connection in Google Account settings before this check. Narrow token requests do not erase an earlier account-wide grant.

## Persistence and collaboration

`localStorage` stores recently opened project folders separately for each Google account ID. It is a convenience list, not authority for access. OAuth access tokens stay in memory. Reloads return to sign-in, then the remembered-project selector. Expired tokens require another sign-in, following [Google's browser token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model).

IndexedDB keeps account/folder/file-scoped team drafts, including their full shared baseline. Team drafts save to Drive every 30 seconds while the team is open and the page is active; **Save team** saves immediately. Both paths merge the draft with a newer shared document by stable entity IDs. Independent changes combine; overlapping changes pause automatic saves until **Save team** opens review for an explicit choice. Invalid combined layouts are rejected and the draft is retained. **Discard team draft** confirms replacement with the shared version. Older stale drafts without a baseline cannot be automatically merged.

Player forms keep a separate account/source-file-scoped draft as inputs change, including avatar and castle choices. Editable connected player drafts save on the same 30-second interval, including after navigation away from the profile; **Save player** writes immediately. Source saves merge independent fields against the form's original baseline; overlapping changes pause automatic saves until **Save player** opens review. Invalid fields retain their draft, temporary upload failures retry, and edits made during an upload remain pending for the next save. Uploads wait while a modal dialog is open. **Undo team** never reverts source saves or refreshed caches. Background cache publication uses the saved team baseline, preserving unsaved local formations. Source saves and cache publication are separate transactions. Alt relationships are team data, managed in the player's Alts tab and saved under the team's permissions.

Uploads fetch the current version and strong JSON metadata ETag through [Drive v2 files](https://developers.google.com/workspace/drive/api/reference/rest/v2/files), then send a multipart [v2 update](https://developers.google.com/workspace/drive/api/reference/rest/v2/files/update) with `If-Match`. A competing write produces a precondition failure and a bounded merge/retry. The app never falls back to an unconditional upload when the revision token is missing. Normal reads and creation remain on Drive v3. Tokens remain in memory.

Before relying on a deployment, use two real Google accounts to verify the custom MIME filters in Picker (including Shared with me and Shared drives), targeted player/folder selection, cancellation, Viewer versus Editor roles, source refresh, and simultaneous conditional updates. Network-boundary browser tests simulate these APIs; they cannot establish Google’s deployed authorization or upload behavior. For a race check, hold both clients after they read the same ETag, then release both writes: exactly one should succeed initially, and the other should merge/retry or show conflict review without losing either draft.
