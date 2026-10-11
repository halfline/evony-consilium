import { view } from "./dom.js";
import { routeHash } from "./navigation.js";
import { OperationCancelled } from "../services/cancellation.js";
import { icon, labelWithIcon } from "./icons.js";

export function createPlayerNotes({
  root,
  dialog,
  getWorkspace,
  getPlayer,
  status,
}) {
  const $ = view(root, dialog),
    panel = root.querySelector('[data-player-panel="notes"]');
  let editor = null,
    incoming = null,
    incomingContext = null,
    loadedKey = null,
    loading = false,
    busy = false,
    timer;
  const workspace = () => getWorkspace();
  const context = () =>
    `${workspace()?.key()}:${workspace()?.notes?.generation}:${getPlayer()?.id}`;
  $("note-form").noValidate = true;
  labelWithIcon($("note-new"), "plus", "New note");
  labelWithIcon($("note-attach"), "link", "Attach note");
  labelWithIcon($("note-close"), "close");
  labelWithIcon($("note-copy-link"), "link", "Copy note link");
  root.querySelector(".notes-empty-icon").append(icon("note"));
  dialog.querySelector(".note-heading-icon").append(icon("note"));
  const rows = () =>
    getPlayer() && workspace()?.sync.file
      ? workspace().notes.list(getPlayer())
      : [];
  const row = () => rows().find((item) => item.id === editor?.id);
  const values = () => ({
    title: $("note-title").value,
    body: $("note-body").value,
  });
  const newDraftKey = () =>
    `consilium-new-note:${workspace().account.sub}:${workspace().notes.subject(getPlayer())}`;
  const date = (value) =>
    value
      ? new Intl.DateTimeFormat(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(value))
      : "";
  function clearEditor() {
    clearTimeout(timer);
    editor = null;
    for (const id of [
      "note-title",
      "note-body",
      "note-remote-title",
      "note-remote-body",
      "note-email",
    ])
      $(id).value = "";
    $("note-error").textContent = "";
    $("note-message").textContent = "";
    $("note-link-result").hidden = true;
    $("note-link-result").value = "";
    $("note-sharing").open = false;
    $("note-more-actions").open = false;
  }
  $("note-close").onclick = () => dialog.close();
  dialog.addEventListener("close", () => {
    clearTimeout(timer);
    if (!busy) clearEditor();
  });
  function paintEditor() {
    if (!editor) return;
    const item = row(),
      existing = !!editor.id;
    const editable = !existing || !!item?.canEdit;
    $("note-heading").textContent = existing ? "Note" : "New note";
    $("note-player-name").textContent = getPlayer()?.name || "";
    $("note-create-options").hidden = existing;
    $("note-title").readOnly = !editable || (busy && !existing);
    $("note-body").readOnly = !editable || (busy && !existing);
    $("note-save").hidden = !editable;
    $("note-save").disabled = busy || !!item?.entry?.saving;
    $("note-unlock").hidden = !existing || !!item?.canEdit;
    $("note-unlock").textContent = item?.connected
      ? "Check editing access"
      : "Unlock note";
    $("note-unlock").disabled = busy;
    $("note-document-actions").hidden = !existing;
    $("note-sharing").hidden = existing
      ? item?.note?.scope !== "personal" ||
        !item?.entry?.file?.capabilities?.canShare
      : $("note-audience").value !== "people";
    $("note-share").hidden = !existing;
    $("note-share").disabled =
      busy || !item?.entry?.file?.capabilities?.canShare;
    $("note-publish").hidden =
      !existing ||
      item?.note?.scope !== "team" ||
      item?.published ||
      !workspace()?.notes.canPublish() ||
      !item?.connected;
    $("note-team-copy").hidden =
      !existing ||
      item?.note?.scope !== "personal" ||
      !item?.connected ||
      !workspace()?.notes.canPublish() ||
      item?.entry?.file?.capabilities?.canCopy === false;
    $("note-remove").hidden =
      !!item?.published && !workspace()?.notes.canPublish();
    $("note-remove").textContent = item?.published
      ? "Remove from team"
      : "Remove from my notes";
    $("note-more-actions").hidden =
      $("note-team-copy").hidden && $("note-remove").hidden;
    if (existing) {
      const url = new URL(`https://drive.google.com/file/d/${editor.id}/view`);
      if (item?.resourceKey)
        url.searchParams.set("resourcekey", item.resourceKey);
      $("note-drive-link").href = url.href;
    }
    const conflict = item?.entry?.conflict;
    $("note-review").hidden = !conflict;
    if (conflict) {
      $("note-remote-title").value = conflict.note.title;
      $("note-remote-body").value = conflict.note.body;
    } else {
      $("note-remote-title").value = "";
      $("note-remote-body").value = "";
    }
    $("note-save-status").textContent = !existing
      ? $("note-title").value || $("note-body").value
        ? "Draft kept on this device"
        : ""
      : item?.entry?.saving
        ? "Saving note…"
        : conflict
          ? "Changes need review · draft kept on this device"
          : item?.draft
            ? "Unsaved note · draft kept on this device"
            : item?.entry?.error
              ? "Source unavailable · reconnect to check access"
              : !item?.connected
                ? item?.published
                  ? `Published copy · refreshed ${date(item.syncedAt)}`
                  : "Unlock the source to view this note."
                : item?.note?.scope === "team"
                  ? item.published
                    ? `${item.canEdit ? "Saved" : "Read-only"} · Team copy refreshed ${date(item.syncedAt)}`
                    : "Saved in Drive · awaiting editor publication"
                  : item?.canEdit
                    ? "Saved"
                    : "Read-only";
    const audience = existing
      ? item?.note?.scope === "team"
        ? "team"
        : item?.audience
      : $("note-audience").value;
    $("note-storage").textContent =
      audience === "team"
        ? existing && item?.published
          ? "Shared with the team."
          : "Team folder members can read this note. An editor publishes it in Consilium."
        : audience === "personal" || audience === "Only you"
          ? "Only you can read this note."
          : audience === "people"
            ? "Share only with the Google accounts you add."
            : audience === "Specific people"
              ? "Shared with specific Google accounts."
              : "Check who has access in Drive.";
    $("note-access").hidden = existing && !item?.note;
    $("note-sharing").classList.toggle("note-sharing-new", !existing);
    if (!existing) $("note-sharing").open = audience === "people";
    $("note-save-status").hidden = !$("note-save-status").textContent;
  }
  async function run(task, { picker = false } = {}) {
    if (busy) return;
    const activeContext = context(),
      reopen = dialog.open;
    busy = true;
    $("note-error").textContent = "";
    $("note-message").textContent = "";
    paintEditor();
    if (picker && reopen) dialog.close();
    try {
      await task();
    } catch (error) {
      if (activeContext !== context() || error instanceof OperationCancelled)
        return;
      if (editor) $("note-error").textContent = error.message;
      else status(error.message, true);
    } finally {
      busy = false;
      if (activeContext === context()) {
        if (picker && reopen && editor && !dialog.open) dialog.showModal();
        paintEditor();
        render();
      } else {
        if (dialog.open) dialog.close();
        clearEditor();
      }
    }
  }
  function fillEditor(item) {
    $("note-title").value = item?.draft?.title ?? item?.note?.title ?? "";
    $("note-body").value = item?.draft?.body ?? item?.note?.body ?? "";
    paintEditor();
  }
  function open(id) {
    const item = rows().find((item) => item.id === id);
    if (!item) return;
    clearEditor();
    editor = { id, context: context() };
    fillEditor(item);
    dialog.showModal();
  }
  async function create() {
    if (!getPlayer() || !workspace()?.healthy()) return;
    const activeContext = context(),
      draftKey = newDraftKey();
    const draft = await workspace().repository.read(draftKey);
    if (activeContext !== context()) return;
    clearEditor();
    editor = { id: null, context: activeContext, draftKey };
    $("note-audience").value = draft?.audience || "personal";
    $("note-title").value = draft?.title || "";
    $("note-body").value = draft?.body || "";
    $("note-email").value = draft?.email || "";
    $("note-share-role").value = draft?.role || "reader";
    paintEditor();
    dialog.showModal();
    $("note-body").focus();
  }
  function capture() {
    if (!editor || editor.context !== context()) return;
    if (editor.id) {
      workspace().notes.updateDraft(editor.id, values());
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (editor?.id && dialog.open && !busy) run(() => save());
      }, 30000);
    } else {
      workspace()
        .repository.write(
          {
            ...values(),
            audience: $("note-audience").value,
            email: $("note-email").value,
            role: $("note-share-role").value,
          },
          editor.draftKey,
        )
        .catch(() => status("New note draft backup unavailable.", true));
    }
    paintEditor();
  }
  for (const id of ["note-title", "note-body"])
    $(id).addEventListener("input", capture);
  for (const id of ["note-audience", "note-email", "note-share-role"])
    $(id).addEventListener("change", () => {
      if (!editor?.id) capture();
      paintEditor();
    });
  async function save(resolution = null) {
    if (!editor) return;
    const notes = workspace().notes,
      player = getPlayer();
    if (!editor.id) {
      const activeContext = context(),
        choice = $("note-audience").value,
        draftKey = editor.draftKey;
      const email = $("note-email").value.trim(),
        role = $("note-share-role").value;
      if (choice === "people" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new Error(
          "Enter the Google account to share with, or choose Only me.",
        );
      const id = await notes.create(
        player,
        values(),
        choice === "team" ? "team" : "personal",
      );
      if (context() !== activeContext) return;
      editor.id = id;
      await workspace().repository.write(null, draftKey);
      if (choice === "people") await notes.share(id, email, role);
    } else await notes.save(player, editor.id, resolution);
    fillEditor(row());
  }
  $("note-form").onsubmit = (event) => {
    event.preventDefault();
    run(() => save(), {
      picker: !editor?.id && $("note-audience").value === "team",
    });
  };
  $("note-keep-mine").onclick = () => run(() => save("local"));
  $("note-use-remote").onclick = () => run(() => save("remote"));
  $("note-new").onclick = () => run(create);
  $("note-attach").onclick = () =>
    run(async () => {
      const id = await workspace().notes.connect(getPlayer());
      open(id);
    });
  $("note-unlock").onclick = () =>
    run(
      async () => {
        const notes = workspace().notes,
          item = row();
        if (item?.connected) {
          await notes.load(item.entry.file);
          if (!row()?.canEdit)
            throw new Error(
              "The note is still read-only. Ask its owner for Editor access in Drive.",
            );
        } else
          await notes.connect(getPlayer(), {
            id: editor.id,
            resourceKey: item?.resourceKey || "",
          });
        fillEditor(row());
      },
      { picker: true },
    );
  $("note-publish").onclick = () =>
    run(() => workspace().notes.publish(getPlayer(), editor.id));
  $("note-team-copy").onclick = () =>
    run(
      async () => {
        const id = await workspace().notes.create(
          getPlayer(),
          values(),
          "team",
        );
        editor.id = id;
        fillEditor(row());
      },
      { picker: true },
    );
  $("note-share").onclick = () =>
    run(async () => {
      await workspace().notes.share(
        editor.id,
        $("note-email").value.trim(),
        $("note-share-role").value,
      );
      $("note-email").value = "";
      $("note-message").textContent =
        "Access granted. Copy the note link for the recipient.";
    });
  $("note-copy-link").onclick = () =>
    run(async () => {
      const w = workspace(),
        item = row(),
        url = new URL(location.href);
      url.hash = routeHash({
        team: w.sync.file.id,
        resourceKey: w.sync.file.resourceKey,
        screen: "player",
        player: getPlayer().id,
        section: "notes",
        note: editor.id,
        noteKey: item?.resourceKey || "",
      });
      $("note-link-result").hidden = false;
      $("note-link-result").value = url.href;
      try {
        await navigator.clipboard.writeText(url.href);
        $("note-message").textContent =
          item?.note?.scope === "team" && !item.published
            ? "Link copied. Ask a team editor to unlock and publish this note."
            : "Link copied. Recipients also need access to the file in Drive.";
      } catch {
        $("note-link-result").focus();
        $("note-link-result").select();
      }
    });
  $("note-remove").onclick = () =>
    run(async () => {
      await workspace().notes.detach(
        getPlayer(),
        editor.id,
        !!row()?.published,
      );
      clearEditor();
      dialog.close();
    });
  $("note-connect-incoming").onclick = () =>
    run(async () => {
      const id = await workspace().notes.connect(getPlayer(), incoming);
      incoming = null;
      open(id);
    });
  function render() {
    if (editor && editor.context !== context()) {
      dialog.close();
      clearEditor();
    }
    if (incoming && incomingContext !== context()) incoming = null;
    if (panel.hidden || !getPlayer() || !workspace()?.sync.file) return;
    const key = `${context()}:${getPlayer().id}`;
    if (loadedKey !== key && !loading) {
      loading = true;
      $("notes-status").textContent = "Loading your note attachments…";
      workspace()
        .notes.ready(getPlayer())
        .then(() => {
          if (key === `${context()}:${getPlayer()?.id}`) loadedKey = key;
        })
        .catch((error) => {
          if (
            !(error instanceof OperationCancelled) &&
            key === `${context()}:${getPlayer()?.id}`
          ) {
            loadedKey = key;
            status("Personal notes unavailable: " + error.message, true);
          }
        })
        .finally(() => {
          loading = false;
          $("notes-status").textContent = "";
          render();
        });
    }
    $("note-incoming").hidden = !incoming;
    const list = $("player-notes");
    list.replaceChildren();
    const items = rows();
    $("notes-count").textContent = items.length;
    $("notes-count").hidden = !items.length;
    $("notes-empty").hidden = !!items.length || loading;
    for (const item of items) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "note-card";
      button.dataset.noteId = item.id;
      const header = document.createElement("div");
      header.className = "note-card-heading";
      const heading = document.createElement("strong");
      heading.textContent =
        (item.draft?.title ?? item.note?.title)?.trim() ||
        (item.note ? "Untitled note" : "Connect note to view");
      header.append(heading, icon("forward"));
      const badge = document.createElement("span");
      badge.className = "note-audience";
      const audience = document.createElement("span");
      audience.textContent = item.note ? item.audience : "Access needed";
      badge.append(
        icon(item.audience === "Only you" ? "lock" : "people"),
        audience,
      );
      const labels = document.createElement("div");
      labels.className = "note-card-labels";
      labels.append(badge);
      if (item.note?.scope === "team" && !item.published) {
        const pending = document.createElement("span");
        pending.className = "note-publication";
        pending.textContent = "Awaiting publication";
        labels.append(pending);
      }
      const preview = document.createElement("p");
      preview.textContent =
        item.draft?.body ??
        item.note?.body ??
        "Unlock the linked file to check access.";
      const meta = document.createElement("small");
      meta.textContent = item.draft
        ? "Unsaved draft"
        : item.entry?.error
          ? item.published
            ? "Source unavailable · published copy retained"
            : "Source unavailable · reconnect to check access"
          : `${item.note?.author || ""}${item.note?.updatedAt ? " · " + date(item.note.updatedAt) : ""}`;
      button.append(header, labels, preview, meta);
      button.onclick = () => open(item.id);
      list.append(button);
    }
    if (editor?.id && row()?.entry?.error) fillEditor(row());
    else paintEditor();
  }
  for (const button of root.querySelectorAll("[data-player-tab]"))
    button.addEventListener("click", () => queueMicrotask(render));
  $("player-section-select").addEventListener("change", () =>
    queueMicrotask(render),
  );
  return {
    render,
    openLink(route) {
      incoming = route.note
        ? { id: route.note, resourceKey: route.noteKey || "" }
        : null;
      incomingContext = context();
      if (route.section === "notes" || incoming)
        root.querySelector('[data-player-tab="notes"]').click();
      render();
    },
    route: () =>
      !panel.hidden
        ? {
            section: "notes",
            ...(incoming
              ? { note: incoming.id, noteKey: incoming.resourceKey }
              : {}),
          }
        : {},
  };
}
