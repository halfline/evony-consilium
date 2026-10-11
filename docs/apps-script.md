# Unattended player and team-note sync

The optional Apps Script job refreshes linked player profiles, including alts, and already-published team notes without an editor keeping Consilium open. Each team runs its own standalone script under a designated administrator's Google account. The administrator needs Editor access to the team document and read access to its source files. The browser's OAuth client and `drive.file` permission remain unchanged.

This is a scheduled job, not a web app or public endpoint. It uses no Cloud Run, Cloud Scheduler, database, service account, or stored refresh token. Use Apps Script's default Cloud project; the manifest enables the advanced Drive service so Google automatically enables its API. A standard Cloud project is optional and requires manually enabling Drive API. See [Google's service setup instructions](https://developers.google.com/apps-script/guides/services/advanced).

## What gets synchronized

- Linked player files directly inside the configured team folder, using `playerSource.fileId`. Source profiles refresh name, account ID, alliance tag, keep level, castle, avatar, and player details such as buffs and marches. Embedded profiles without a source are left alone.
- Already-published team-note files directly inside that folder, using `plan.teamNotes`. Each source must retain its team audience, team ID, note identity, and matching player identity.
- Only cache fields in the existing team document. Source files, maps, placements, alt relationships, team settings, subcities, permissions, and unrelated document fields are retained.

New players still need to be added or imported into the roster in Consilium. A new team note still needs an editor's initial **Unlock linked note → Publish to team** review. Once published, subsequent source edits can synchronize without the editor's browser or remembered source grant. The script's independently authorized Drive access does not grant any browser user editing access or eliminate their Picker steps.

Personal notes, notes shared with specific accounts, personal attachment indexes, and unpublished team notes are never discovered or attached. Folder listing supplies revision metadata; the job downloads only changed, explicitly linked sources. Moving a source out of the configured folder, losing access, or changing a note's identity/audience stops further publication and retains its previous snapshot. Removing an attachment in Consilium prevents the script from adding it back, including during a concurrent upload.

## Generate the deployment files

With Node dependencies installed, run:

```sh
npm run build:apps-script
```

The output is:

| File                                | Purpose                                                                            |
| ----------------------------------- | ---------------------------------------------------------------------------------- |
| `apps-script/build/Code.gs`         | Generated synchronizer and six runnable entry points.                              |
| `apps-script/build/Config.gs`       | Editable team IDs and scheduling settings.                                         |
| `apps-script/build/appsscript.json` | V8 runtime, Drive service, explicit scopes, and fixed Google request destinations. |

Rebuilding preserves an existing local `Config.gs`. The output directory is ignored by Git. The ordinary site build also publishes template files under `<your-site>/apps-script/`, so another team can obtain the script without building game assets or configuring another application server. Those public templates contain placeholders, not your team's local configuration.

The build bundles the same profile/note validators and cache transformations used by the browser. It substitutes a JSON-only clone for the browser's `structuredClone`, which is unavailable in Apps Script. Authored sources live in `apps-script/`; change those and rebuild rather than editing generated `Code.gs`.

## Upload without copying files

For a team with a working script, future updates can be one command. The repository wraps Google's [clasp command-line tool](https://developers.google.com/apps-script/guides/clasp), fetched on demand at a pinned version; it is not a dependency of the site. This workflow requires Node 20 or newer.

Set up the connection once:

1. Enable **Google Apps Script API** in [Apps Script user settings](https://script.google.com/home/usersettings).
2. Run `npm run apps-script:login` and sign in as the account that owns or can edit your script.
3. Open the script's **Project Settings → IDs** and copy its **Script ID**. This is a different ID from your team document and Drive folder.
4. Run `npm run apps-script:link -- "SCRIPT_ID"`. You can supply the script editor URL instead. This records the target locally in an ignored `.clasp.json`; it does not upload anything. Use `npm run apps-script:link -- --replace "SCRIPT_ID"` to switch teams deliberately.

Then, after pulling updated repository code, run:

```sh
npm run apps-script:push
```

The command downloads the current script into a temporary directory, rebuilds `Code.gs` and the manifest, and uploads the resulting project. It preserves the **remote `Config` file** and any extra script or HTML files. Your local `apps-script/build/Config.gs` is not used for updates. Generated code and the manifest come from the repository, so make synchronizer changes in the authored sources. Finish edits in the online editor before uploading.

Existing Script Properties and scheduled triggers remain in place; ordinary code updates do not require running configure or install again. If an update changes required scopes, run a function in the editor to grant Google's authorization again. Google may also prompt in the terminal to confirm a manifest change. No web-app deployment is needed. Temporary downloaded files are removed when the command finishes, including after failures. `clasp` keeps its login credentials in your home directory; those credentials must remain private.

For a new team, create a blank standalone project, link it, and push to upload all three files. Then follow the configuration, authorization, and trigger steps below, starting at step 4. The first upload supplies placeholder settings; edit Config in the Google editor before configuring sync. Teams using the public site without a local checkout can use the copy-and-paste installation instead.

## Install by copying files

1. Sign in as the administrator who will run sync and create a standalone project at [Google Apps Script](https://script.google.com/home). Keep that project private; people who can edit a scheduled script can change what runs under its operator's authorization.
2. Replace the default `Code.gs` with the generated file. Create a script file named **Config** and paste `Config.gs` into it.
3. In **Project Settings**, enable **Show "appsscript.json" manifest file in editor**. Replace that manifest with the generated JSON and save. The **Drive** service should appear under Services.
4. Edit `consiliumConfig_()` in Config. Set `teamFileId` to the ID in the team document's Drive URL and `folderId` to its parent folder ID. The Team screen's Drive links identify both. If either URL has a `resourcekey` query parameter, copy it into the corresponding resource-key setting. Use IDs, not full URLs. Leave the five-minute interval and 100-source limit initially.
5. Select **configureConsiliumSync** and run it. Review Google's authorization prompt. This performs a preview without uploading anything, then saves the configuration and removes any old sync trigger installed by that account. Review the execution log for unavailable sources.
6. Select **syncConsiliumTeam** and run it to verify an actual conditional upload. If all caches are current, `written: false` is expected.
7. Select **installConsiliumSync** and run it. It checks access with another preview and installs one time-driven trigger. Running it again replaces that account's existing sync trigger rather than adding duplicates. No **Deploy** operation or web-app URL is needed.
8. Close Consilium, edit an existing source from another account, wait for a scheduled pass, then reopen Consilium and inspect its shared cache. Confirm both a player/alt profile and a published note.

Install from one account only. [Google's triggers run as their creator](https://developers.google.com/apps-script/guides/triggers/installable), and one account cannot enumerate or remove another account's triggers. If the administrator leaves, remove their trigger or revoke its authorization, then have the replacement administrator authorize and install a new private copy.

## Permissions and cost

The standalone script requests:

| Scope                                                     | Use                                                                                                                     |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `https://www.googleapis.com/auth/drive`                   | Read linked files created by different teammates and conditionally update the team cache without browser Picker grants. |
| `https://www.googleapis.com/auth/script.external_request` | Send REST requests to Google Drive, including strong ETag headers.                                                      |
| `https://www.googleapis.com/auth/script.scriptapp`        | Install and remove the operator's scheduled trigger.                                                                    |

Full Drive authorization is broader than one folder; the code enforces the configured folder boundary, but OAuth does not. Google or an organization policy may show an unverified-app warning or restrict authorization. Review the code and consent from the intended operator account. Do not add these scopes to the browser OAuth deployment or replace its non-sensitive `drive.file` model. [Google explains explicit Apps Script scopes and granular consent](https://developers.google.com/apps-script/concepts/scopes).

The implementation requires no paid Google Cloud service. Consumer Google accounts have Apps Script quotas, including 20,000 URL Fetch calls per day, 90 minutes of daily trigger runtime, and six minutes per execution; Workspace limits differ. These limits are per user, shared with their other scripts, and can change. Exceeding them stops execution rather than purchasing more capacity. See [Google's current quotas](https://developers.google.com/apps-script/guides/services/quotas).

This job uses a five-minute default, a two-minute work budget with time reserved for saving, and at most 100 source checks per pass. A persisted cursor rotates larger teams across later passes. Unchanged sources use folder-list revision metadata without individual downloads; a stable changed-source read takes three requests, and a successful team upload uses a metadata preflight plus a conditional write. An idle run usually needs five requests plus additional folder-list pages. A team with 250 linked players and published notes takes up to three scheduled passes for a complete scan with the default source limit, before delays or failures.

Conservative local accounting pauses at 15,000 fetch calls or 60 minutes of work in a 24-hour window, then resumes after that window. Those counters cannot see usage from unrelated scripts and do not guarantee remaining Google quota. Authentication, throttling, and server failures stop the pass; a later scheduled run retries without unconditional writes. Large documents remain subject to Google's response/upload size limits.

## Operation and troubleshooting

| Function                  | Behavior                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `configureConsiliumSync`  | Validate Config, preview sources, save settings, reset the cursor, and remove the operator's previous sync trigger. Run install afterward. |
| `previewConsiliumSync`    | Report candidate changes without uploading or advancing the persisted cursor.                                                              |
| `syncConsiliumTeam`       | Run a sync immediately; also the scheduled handler.                                                                                        |
| `installConsiliumSync`    | Preflight access and install/replace the operator's trigger.                                                                               |
| `showConsiliumSyncStatus` | Log current settings, trigger presence, last report, and local quota accounting.                                                           |
| `uninstallConsiliumSync`  | Remove only the operator's sync triggers; keep Drive files, cached snapshots, and settings.                                                |

Reports have `state` (`ok`, `partial`, `error`, or `quota-paused`), a timestamp, counts, whether an upload happened, and whether another pass is needed. A partial report retains the first ten source warnings plus their total count. Logs and Script Properties contain operational IDs, settings, and counters, not profile/note text or OAuth tokens. Consilium continues to show its existing cache timestamps; it does not currently display this script's health report.

Use the Apps Script **Executions** and **Triggers** screens to diagnose failures. A missing source can mean a move, deletion, or revoked sharing; restore access or explicitly remove its attachment in Consilium. An API-disabled error requires the manifest's Drive service or Drive API enablement for a standard Cloud project. An authorization error requires the installing administrator to run a function interactively and grant the required scopes again. Quota pauses require waiting or increasing the interval; edit Config, run configure, then install.

Team uploads use Drive v2's strong metadata ETag and `If-Match`, as browser uploads do. A concurrent change reloads the latest team and reapplies only eligible caches, with at most three attempts. A missing/weak ETag stops the upload. A script lock prevents overlapping executions in the same project; the Drive precondition also protects against browser editors and independent script projects.

Automated tests exercise the generated bundle with Apps Script globals, transport pagination, stable reads, conditional writes, privacy boundaries, concurrent removal/relinking, cursor rotation, quotas, and trigger management. Live Google authorization, actual ETag behavior, and unattended trigger execution still require the deployment check above with real accounts.
