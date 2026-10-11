// Network-boundary mock: production code still runs the full Google/Drive UI.
export async function mockGoogleDrive(
  context,
  {
    files = new Map(),
    grants = new Set(),
    account = { sub: "test-account", email: "team@example.test" },
    access = new Map(),
  } = {},
) {
  const metadataFor = (entry) => ({
    ...entry.file,
    ownedByMe: entry.owner === account.sub,
    capabilities: { ...entry.file.capabilities, ...access.get(entry.file.id) },
  });
  let next = Math.max(
    0,
    ...[...files.keys()].map((id) => Number(id.replace(/^mock/, "")) || 0),
  );
  files.grants = grants;
  await context.route("**/google-config.js", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: 'export const googleConfig={clientId:"browser-test.apps.googleusercontent.com",apiKey:"test-key",appId:"123456"};',
    }),
  );
  await context.route("https://accounts.google.com/gsi/client", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: 'window.google={accounts:{oauth2:{hasGrantedAllScopes:(response,scope)=>response.scope.split(" ").includes(scope),initTokenClient:options=>({requestAccessToken:()=>{if(options.scope.includes("auth/drive ") || options.scope.endsWith("auth/drive") || options.include_granted_scopes!==false)throw new Error("Broad Drive authorization requested");window.__oauthOptions=options;options.callback({access_token:"test-token",expires_in:3600,scope:options.scope});}})}}};',
    }),
  );
  await context.route("https://apis.google.com/js/api.js", (r) =>
    r.fulfill({
      contentType: "application/javascript",
      body: `
    window.gapi={load:(name,options)=>{
      class View {constructor(){this.options={};} setIncludeFolders(v){this.options.includeFolders=v;return this;} setSelectFolderEnabled(v){this.options.folders=v;return this;} setMode(v){this.options.mode=v;return this;} setQuery(v){this.options.query=v;return this;} setLabel(v){this.options.label=v;return this;} setOwnedByMe(v){return this;} setEnableDrives(v){return this;} setMimeTypes(v){this.options.mime=v;return this;} setFileIds(v){this.options.ids=v;return this;} setParent(v){this.options.parent=v;return this;}}
      class Builder {
        addView(v){(this.views ||= []).push(v);this.view ||= v;return this;} setSelectableMimeTypes(v){this.selectable=v;return this;} setMaxItems(v){return this;} setOAuthToken(v){return this;} setDeveloperKey(v){return this;} setAppId(v){return this;} setOrigin(v){return this;} setTitle(v){this.title=v;return this;} setCallback(v){this.callback=v;return this;} enableFeature(v){return this;}
        build(){const builder=this;return {dispose(){},setVisible:async()=>{
          window.__pickerModalStates=(window.__pickerModalStates||[]);window.__pickerModalStates.push(!!document.querySelector("dialog:modal"));
          window.__pickerCalls=(window.__pickerCalls||[]);window.__pickerCalls.push({...builder.view.options,title:builder.title,selectable:builder.selectable,views:builder.views.map(view=>view.options)});
          if(window.__pickerCancelNext){window.__pickerCancelNext=false;return builder.callback({action:"cancel"});}
          // Opening Picker shows its first view; it does not visit other tabs
          // automatically when that view is empty.
          const query=new URLSearchParams(builder.view.options);
          const docs=await fetch("https://picker.test/select?"+query).then(r=>r.json());
          builder.callback(docs.length?{action:"picked",docs}:{action:"cancel"});
        }}}
      }
      window.google.picker={DocsView:View,DocsViewMode:{LIST:"list"},PickerBuilder:Builder,ViewId:{DOCS:"docs"},Feature:{MULTISELECT_ENABLED:"multi"},Action:{PICKED:"picked",CANCEL:"cancel"}};options.callback();
    }};
  `,
    }),
  );
  await context.route("https://picker.test/select?**", (route) => {
    const query = new URL(route.request().url()).searchParams;
    const folder = query.get("folders") === "true";
    const rows = [...files.values()].filter((r) =>
      folder
        ? r.file.mimeType === "application/vnd.google-apps.folder" &&
          (!query.get("ids") || r.file.id === query.get("ids"))
        : query.get("mime").split(",").includes(r.file.mimeType) &&
          (!query.get("query") || r.file.name.includes(query.get("query"))) &&
          (!query.get("ids") || r.file.id === query.get("ids")) &&
          (!query.get("parent") ||
            r.file.parents?.includes(query.get("parent"))),
    );
    const selected = rows.slice(0, 1);
    selected.forEach((r) => grants.add(r.file.id));
    return route.fulfill({
      json: selected.map((r) => ({
        id: r.file.id,
        name: r.file.name,
        resourceKey: r.file.resourceKey,
      })),
    });
  });
  await context.route("https://openidconnect.googleapis.com/v1/userinfo", (r) =>
    r.fulfill({ json: account }),
  );
  await context.route("https://www.googleapis.com/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const id = url.pathname.match(/\/files\/([^/]+)/)?.[1];
    if (id && url.pathname.endsWith("/permissions")) {
      const entry = files.get(id);
      if (!entry || !grants.has(id))
        return route.fulfill({
          status: 404,
          json: { error: { message: "Not found" } },
        });
      entry.permissions ||= [
        {
          id: "owner",
          type: "user",
          role: "owner",
          emailAddress: account.email,
        },
      ];
      if (request.method() === "POST") {
        const permission = {
          id: "permission" + entry.permissions.length,
          ...JSON.parse(request.postData()),
        };
        entry.permissions.push(permission);
        return route.fulfill({ json: permission });
      }
      return route.fulfill({ json: { permissions: entry.permissions } });
    }
    if (request.method() === "POST") {
      const body = request.postData();
      let metadata, data;
      if (body.startsWith("{")) metadata = JSON.parse(body);
      else
        [metadata, data] = body
          .split("\r\n")
          .filter((s) => s.startsWith("{"))
          .map((s) => JSON.parse(s));
      const file = {
        ...metadata,
        id: "mock" + ++next,
        version: "1",
        capabilities: {
          canEdit: true,
          canAddChildren: true,
          canShare: true,
          canCopy: true,
        },
        webViewLink: "https://drive.google.com/drive/folders/mock" + next,
      };
      files.set(file.id, {
        file,
        data,
        owner: account.sub,
        permissions: [
          {
            id: "owner",
            type: "user",
            role: "owner",
            emailAddress: account.email,
          },
        ],
      });
      grants.add(file.id);
      return route.fulfill({ json: file });
    }
    if (request.method() === "PATCH") {
      const entry = files.get(id);
      entry.data = JSON.parse(request.postData());
      entry.file.version = String(Number(entry.file.version) + 1);
      return route.fulfill({ json: entry.file });
    }
    if (request.method() === "PUT") {
      const entry = files.get(id);
      if (!entry || !grants.has(id))
        return route.fulfill({
          status: 404,
          json: { error: { message: "Not found" } },
        });
      if (!metadataFor(entry).capabilities.canEdit)
        return route.fulfill({
          status: 403,
          json: { error: { message: "Read-only file" } },
        });
      if (request.headers()["if-match"] !== `"${id}:${entry.file.version}"`)
        return route.fulfill({
          status: 412,
          json: { error: { message: "Revision changed" } },
        });
      const [metadata, data] = request
        .postData()
        .split("\r\n")
        .filter((line) => line.startsWith("{"))
        .map((line) => JSON.parse(line));
      entry.data = data;
      entry.file.name = metadata.title;
      entry.file.mimeType = metadata.mimeType;
      entry.file.version = String(Number(entry.file.version) + 1);
      return route.fulfill({
        json: {
          ...entry.file,
          title: entry.file.name,
          etag: `"${id}:${entry.file.version}"`,
          parents: entry.file.parents?.map((id) => ({ id })),
        },
      });
    }
    if (id) {
      const entry = files.get(id);
      // Simulate Drive settling a new team's revision during its first download.
      if (
        entry &&
        grants.has(id) &&
        url.searchParams.get("alt") === "media" &&
        entry.data?.format === "evony-consilium-team" &&
        !entry.settled
      ) {
        entry.settled = true;
        entry.file.version = String(Number(entry.file.version) + 1);
      }
      return entry && grants.has(id)
        ? route.fulfill({
            json:
              url.searchParams.get("alt") === "media"
                ? entry.data
                : url.pathname.includes("/v2/")
                  ? {
                      ...metadataFor(entry),
                      title: entry.file.name,
                      etag: `"${id}:${entry.file.version}"`,
                      parents: entry.file.parents?.map((id) => ({ id })),
                    }
                  : files.hideParentMetadata
                    ? Object.fromEntries(
                        Object.entries(entry.file).filter(
                          ([key]) => key !== "parents",
                        ),
                      )
                    : metadataFor(entry),
          })
        : route.fulfill({
            status: 404,
            json: { error: { message: "Not found" } },
          });
    }
    const query = url.searchParams.get("q") || "";
    const folder = query.match(/^'([^']+)'/)?.[1];
    return route.fulfill({
      json: {
        files: [...files.values()]
          .filter(
            (r) =>
              grants.has(r.file.id) &&
              (query.includes("consiliumKind")
                ? r.owner === account.sub &&
                  r.file.appProperties?.consiliumKind === "notes-index"
                : r.file.parents?.includes(folder)),
          )
          .map((r) => r.file),
      },
    });
  });
  return files;
}
