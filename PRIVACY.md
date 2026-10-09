# Evony Consilium Privacy Policy

Effective date: October 6, 2026

Evony Consilium is an unofficial community tool for planning Evony alliance formations and hives. This policy describes the current application maintained by the Evony Consilium project maintainers. It is not operated by Google or Top Games Inc.

## Information the application accesses

When you sign in with Google, the application requests your Google account identifier, email address, and basic profile information, such as your name and profile image if Google returns them. This identifies your account and separates its remembered projects and local drafts from those of other accounts.

The application requests the Google Drive permission `drive.file`. It uses that permission to create project folders and files and to access files you explicitly authorize through Google Picker. Selecting a folder does not automatically authorize all its contents. The application reads project-file metadata, including names, file identifiers, parent folders, resource keys, versions, and permission capabilities, and reads the authorized project content needed to open your formation.

Project content may include keep names, optional game account identifiers, keep levels, castle choices, alliance tags, troop buffs, march sizes and boosts, rally capacities, attack-march layers, subordinate-city records (including cultures, quality, mayors, and coordinates), map coordinates, formations, building locations, imported player files, custom graphics, and map screenshots. Include only information you are authorized to use and share. Do not enter game passwords, Google passwords, or other credentials into project files.

## How information is used

Information is used to sign you in, open and save your chosen projects, render and edit formations, recover local drafts, identify known save conflicts, and track manually entered player statistics. Player details are cached together with team settings and maps in the shared team document. New player profiles also have individual files in the central team Drive folder so their editing can be delegated through Google Drive permissions. Opening a player profile checks access to its linked file; writable files accessible to the app can be loaded automatically, and otherwise the Unlock action authorizes that file through Google Picker. Profile edits save directly to the player file. An authorized team editor’s session automatically refreshes the cached profiles while the team is open; local player drafts remain separate from team drafts.

The application does not sell Google user data, use it for advertising, or send it to AI services for model training. Its use and transfer of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements where applicable: https://developers.google.com/terms/api-services-user-data-policy.

## Where information is stored

The application runs in your browser. This implementation has no application backend that receives your Google profile, project contents, or access tokens. Your browser communicates directly with Google for authentication, file selection, and Drive operations.

Google OAuth access tokens are held in browser memory rather than saved in localStorage or IndexedDB. The application does not receive your Google password or store refresh tokens. Signing out clears the application's active account and token from memory; it does not sign you out of Google or delete project data.

The application uses localStorage for account-specific remembered project folders, including their names, identifiers, resource keys, and last-opened times. It uses IndexedDB for account-, folder-, and formation-specific local drafts, including imported images. These records remain on the device until you clear them or the browser removes them. They are not additionally encrypted by the application; protect access to your browser profile, especially on shared devices.

Creating a project writes its initial files to Google Drive. Ordinary edits save a local draft. Selecting Save uploads the formation, including any embedded images and account identifiers in it, to the project folder.

## Sharing and access

Access to a Drive project is controlled by the permissions on its folder and files. People you or another authorized collaborator grant access to may be able to read or edit its contents. The application does not independently make projects public or invite teammates. It checks Drive capabilities before saving and checks the known file version for conflicts; these checks are not a guarantee against simultaneous overwrites.

Anyone who downloads project files through Google Drive may retain or redistribute them. Review project sharing permissions before sharing. The application cannot revoke copies downloaded by collaborators.

Maintainers do not receive project contents through an application server. If you send project files, screenshots, or diagnostic information to a maintainer for support, that information will be visible to the recipient. Avoid including private data in public support discussions.

## Hosting and third-party services

The website's hosting provider receives ordinary web requests, which may include IP addresses, browser information, and requested URLs, and may maintain operational logs under its own policies. GitHub Pages deployments are subject to GitHub's privacy statement: https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement.

The application loads Google Identity Services, Google Picker, and fonts from Google and uses Google's identity and Drive APIs. These requests disclose network and browser information to Google. Google may use its own cookies or other mechanisms for its services. Google's processing, storage, and retention are governed by its privacy policy and account settings: https://policies.google.com/privacy.

Team Discord links use a bundled icon. The application does not request Discord metadata or widgets. Clicking the link opens Discord, where Discord’s privacy policy applies: https://discord.com/privacy.

The current application includes no application analytics, advertising trackers, or marketing cookies. Local storage described above supports project functionality. The application does not contact Evony game servers at runtime.

## Retention, deletion, and your choices

To forget a project shortcut, use the circle × on a team shortcut. This removes the remembered entry for that account on that device; it does not delete its local draft or the Drive project. Load latest replaces that formation's local draft with the current Drive version.

To remove all local records, use your browser's site-data controls for this website. This removes remembered projects and drafts for all accounts stored by this site in that browser. Export any unsaved work first. Signing out alone does not clear these records.

To delete a shared project, delete its folder and files through Google Drive, subject to your permissions. Drive trash, revision history, organizational retention, and collaborators' copies are controlled by Google and the relevant account or organization. To withdraw Google API consent, remove Evony Consilium's connection in your Google Account settings: https://myaccount.google.com/connections. Withdrawing consent does not itself delete files or local drafts.

## Policy changes

This policy will be updated when the application's data practices change. The effective date identifies the published version. New uses of Google user data will be disclosed before they are introduced, with renewed consent where required. The existence of a future-feature roster file does not authorize undisclosed collection or use.

## Contact

For privacy questions, contact the project maintainer at the user-support email displayed on Evony Consilium's Google consent screen. Include the website address you are using so the maintainer can identify the deployment. Do not include passwords or access tokens.
