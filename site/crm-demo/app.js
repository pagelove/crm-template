(function () {
  "use strict";

  // Directory routes must write the same concrete resource as the authorization rules.
  var PAGE = window.location.pathname.replace(/\/$/, "/index.html");
  var $ = function (selector, root) { return (root || document).querySelector(selector); };
  var personForm = $("#add-person");
  var logForm = $("#add-log");
  var people = [];
  var logs = [];
  var selected = "";
  var filter = "all";
  var allActivity = false;
  var busy = false;
  var pending = null;
  var refreshNeeded = false;

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function id(prefix) {
    return prefix + "-" + (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  }
  function today() {
    var date = new Date();
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }
  function validDay(day) {
    return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day + "T00:00:00Z")) && new Date(day + "T00:00:00Z").toISOString().slice(0, 10) === day;
  }
  function formatDay(day) {
    return validDay(day) ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(day + "T12:00:00Z")) : "Date not recorded";
  }
  function dueEpochFrom(day, cadence) { return Date.parse(day + "T00:00:00Z") / 1000 + cadence * 86400; }
  function dueDay(epoch) { return Number.isFinite(epoch) ? new Date(epoch * 1000).toISOString().slice(0, 10) : ""; }
  function isDue(person) { return Number.isFinite(person.due) && person.due < Date.now() / 1000; }
  function dueLabel(person) {
    if (!Number.isFinite(person.due)) return "No check-in date";
    if (isDue(person)) return "Due · " + formatDay(dueDay(person.due));
    return "Next check-in · " + formatDay(dueDay(person.due));
  }
  function prop(row, name) {
    var node = $('[itemprop="' + name + '"]', row);
    return node ? (node.getAttribute("content") === null ? node.textContent : node.getAttribute("content")) : "";
  }
  function currentPerson() { return people.find(function (person) { return person.id === selected; }); }
  function latestFor(person) { return logs.find(function (entry) { return entry.target === person.id; }); }
  function latestDayFor(person, proposed) {
    return [proposed, person.last].concat(logs.filter(function (entry) { return entry.target === person.id; }).map(function (entry) { return entry.when; })).filter(validDay).sort().pop() || today();
  }
  function readRecords() {
    people = Array.from(document.querySelectorAll("#people > li")).map(function (row) {
      return { id: prop(row, "contactId"), name: prop(row, "name"), cadence: Number(prop(row, "cadenceDays")), due: Number(prop(row, "dueEpoch")), last: prop(row, "lastContactedAt"), row: row };
    }).sort(function (a, b) { return Number(isDue(b)) - Number(isDue(a)) || a.due - b.due || a.name.localeCompare(b.name); });
    logs = Array.from(document.querySelectorAll("#log > li")).map(function (row, index) {
      return { id: prop(row, "interactionId"), target: prop(row, "interactionTargetId"), when: prop(row, "occurredAt"), note: prop(row, "note"), order: index };
    }).sort(function (a, b) { return b.when.localeCompare(a.when) || b.order - a.order; });
    if (!people.some(function (person) { return person.id === selected; }) && !logForm.elements.namedItem("note").value.trim()) selected = people.length ? people[0].id : "";
    var target = logForm.elements.namedItem("target");
    target.replaceChildren();
    people.forEach(function (person) { var option = new Option(person.name, person.id); target.add(option); });
    target.value = selected;
    var counts = { peoplecount: people.length, logcount: logs.length, overduecount: people.filter(isDue).length };
    Object.keys(counts).forEach(function (name) { var stamp = $(".stats [" + name + "]"); if (stamp) stamp.textContent = counts[name]; });
  }
  function initialsFor(person) {
    return person.name.trim().split(/\s+/).slice(0, 2).map(function (part) { return Array.from(part)[0] || ""; }).join("").toUpperCase();
  }
  function samplePortrait(person) {
    if (["c-seed1", "c-priv1"].includes(person.id)) return "portrait-ana";
    if (["c-seed2", "c-priv2"].includes(person.id)) return "portrait-ben";
    return "";
  }
  function portraitMarkup(person, named) {
    var portrait = samplePortrait(person);
    if (portrait) return '<span class="portrait-swatch ' + portrait + '"' + (named ? ' role="img" aria-label="Fictional sample portrait for ' + esc(person.name) + '"' : ' aria-hidden="true"') + '></span>';
    return '<span class="' + (named ? 'profile-monogram' : 'avatar-initials') + '" aria-hidden="true">' + esc(initialsFor(person)) + '</span>';
  }
  function renderContacts() {
    var query = $("#contact-search").value.trim().toLocaleLowerCase();
    var matches = people.filter(function (person) {
      var haystack = person.name + " " + logs.filter(function (entry) { return entry.target === person.id; }).map(function (entry) { return entry.note; }).join(" ");
      return (!query || haystack.toLocaleLowerCase().includes(query)) && (filter === "all" || (filter === "due" ? isDue(person) : !isDue(person)));
    });
    $("#all-count").textContent = people.length;
    $("#due-count").textContent = people.filter(isDue).length;
    $("#people-summary").textContent = matches.length + " of " + people.length + " people · due check-ins first";
    $("#contacts-view").innerHTML = matches.length ? matches.map(function (person) {
      var last = latestFor(person);
      return '<button class="contact-card" type="button" data-person="' + esc(person.id) + '" aria-pressed="' + (person.id === selected) + '"><span class="avatar">' + portraitMarkup(person, false) + '</span><span class="contact-main"><span class="contact-name">' + esc(person.name) + '</span><span class="contact-cadence">Every ' + esc(person.cadence) + ' days</span></span>' + '<span class="contact-state' + (isDue(person) ? ' is-due' : '') + '">' + esc(dueLabel(person)) + '</span><span class="contact-note">' + (last ? '<strong>Last conversation · ' + esc(formatDay(last.when)) + '</strong>' + esc(last.note) : 'No conversations recorded.') + '</span></button>';
    }).join("") : '<div class="empty-state"><h3>' + (people.length ? 'No people in this view' : 'No contacts yet') + '</h3><p>' + (people.length ? 'Try another search or choose Everyone.' : 'Add a person and choose how often to check in.') + '</p></div>';
  }
  function renderContext() {
    var person = currentPerson();
    var last = person && latestFor(person);
    $("#person-context").innerHTML = person ? '<div class="contact-identity"><span class="avatar context-avatar">' + portraitMarkup(person, true) + '</span><div><h2 class="context-name" id="selected-person-name">' + esc(person.name) + '</h2><p class="context-meta">Every ' + esc(person.cadence) + ' days</p></div><a class="back-to-people" href="#people-heading">Back to contacts</a></div><dl class="contact-facts"><div><dt>Last conversation</dt><dd>' + esc(last ? formatDay(last.when) : 'None recorded') + '</dd></div><div><dt>Next follow-up</dt><dd>' + esc(formatDay(dueDay(person.due))) + (isDue(person) ? '<span class="due-tag">Due now</span>' : '') + '</dd></div></dl><div class="context-note"><p class="context-label">Last note</p><p>' + esc(last ? last.note : 'No notes recorded for this person.') + '</p></div>' : '<h2 class="context-name" id="selected-person-name">Contact details</h2><p class="context-meta">Add or select a person to see conversations and follow-up dates.</p>';
    var when = logForm.elements.namedItem("when").value;
    $("#next-checkin").textContent = person && validDay(when) ? "Next check-in: " + formatDay(dueDay(dueEpochFrom(latestDayFor(person, when), person.cadence))) : "Choose a person and a date to set your next check-in.";
    renderActivity();
  }
  function renderActivity() {
    var entries = logs.filter(function (entry) { return allActivity || entry.target === selected; });
    $("#activity-toggle").textContent = allActivity ? "Show selected person" : "Show everyone";
    $("#activity-toggle").setAttribute("aria-pressed", String(allActivity));
    $("#activity-view").innerHTML = entries.length ? entries.map(function (entry) {
      var person = people.find(function (p) { return p.id === entry.target; });
      return '<li class="activity-item"><div class="activity-meta"><strong>' + esc(person ? person.name : "Unknown person") + '</strong><time datetime="' + esc(entry.when) + '">' + esc(formatDay(entry.when)) + '</time></div><p class="activity-note">' + esc(entry.note || "No note recorded.") + '</p></li>';
    }).join("") : '<li class="empty-state"><h3>No conversations recorded</h3><p>Save a conversation to start this person’s history.</p></li>';
  }
  function focusSelectedContact() {
    // This matches the stylesheet breakpoint where the roster moves above the
    // detail workspace. Wider layouts retain focus on the selected roster row.
    var stacked = typeof window.matchMedia === "function" && window.matchMedia("(max-width: 800px)").matches;
    if (stacked) {
      var context = $("#person-context");
      context.focus({ preventScroll: true });
      // Immediate scrolling respects reduced-motion preferences without adding
      // an animation to contact selection.
      if (typeof context.scrollIntoView === "function") context.scrollIntoView({ behavior: "auto", block: "start" });
    } else {
      var card = Array.from(document.querySelectorAll("[data-person]")).find(function (item) { return item.dataset.person === selected; });
      if (card) card.focus({ preventScroll: true });
    }
  }
  function updateControls() {
    Array.from(personForm.elements).forEach(function (el) { el.disabled = busy || !!pending || refreshNeeded; });
    Array.from(logForm.elements).forEach(function (el) { el.disabled = busy || !!pending || refreshNeeded || !people.length; });
    $("#add-log button[type=submit]").disabled = busy || !!pending || refreshNeeded || !currentPerson();
    $("#refresh").disabled = busy || !!pending;
    $("#retry").disabled = busy;
    document.querySelectorAll(".contact-card").forEach(function (el) { el.disabled = busy || !!pending; });
    personForm.setAttribute("aria-busy", String(busy));
    logForm.setAttribute("aria-busy", String(busy));
  }
  function render() { renderContacts(); renderContext(); updateControls(); }
  function say(message, bad, retryLabel) {
    $("#feedback").hidden = false;
    $("#feedback").classList.toggle("is-error", !!bad);
    $("#status").textContent = message;
    $("#retry").hidden = !retryLabel;
    if (retryLabel) $("#retry").textContent = retryLabel;
    // A failed save can happen below the fold on mobile. Reveal its recovery
    // action without moving focus, and leave visible feedback where it is.
    var feedback = $("#feedback");
    if (bad && typeof feedback.scrollIntoView === "function") {
      var rect = feedback.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) feedback.scrollIntoView({ block: "nearest", behavior: "auto" });
    }
  }
  async function request(method, selector, body) {
    var headers = { Range: "selector=" + selector };
    if (body) headers["Content-Type"] = "text/html";
    var response;
    try { response = await fetch(PAGE, { method: method, headers: headers, body: body, credentials: "same-origin" }); }
    catch (cause) { var unknown = new Error("The connection ended before the save could be confirmed."); unknown.uncertain = true; throw unknown; }
    if (!response.ok) {
      var detail = await response.text().catch(function () { return ""; });
      var message = response.status === 401 || response.status === 403 ? "This page does not allow that change in your current session." : /shape/i.test(detail) ? "The page rejected the record format." : /reference/i.test(detail) ? "That person is no longer available. Refresh the records." : response.status === 405 || response.status === 501 ? "This preview cannot save records. Open the Pagelove deployment to make changes." : "The save failed (HTTP " + response.status + ").";
      var error = new Error(message);
      error.uncertain = response.status >= 500 && response.status !== 501;
      error.duplicate = /uniqueness/i.test(detail);
      throw error;
    }
  }
  async function reload() {
    var url = new URL(PAGE, window.location.origin);
    url.searchParams.set("cb", String(Date.now()));
    var response = await fetch(url.href, { headers: { Range: "selector=body" }, cache: "no-store", credentials: "same-origin" });
    if (!response.ok) throw new Error("Records could not be refreshed (HTTP " + response.status + ").");
    var doc = new DOMParser().parseFromString(await response.text(), "text/html");
    var selectors = ["#people", "#log"];
    if (selectors.some(function (selector) { return !$(selector, doc); })) throw new Error("The response did not contain your contact records.");
    selectors.forEach(function (selector) { $(selector).innerHTML = $(selector, doc).innerHTML; });
    readRecords();
    refreshNeeded = false;
    render();
  }
  function hasRecord(operation) {
    return (operation.kind === "person" ? people : logs).some(function (record) { return record.id === operation.id; });
  }
  function applyConfirmedPost(operation) {
    if (!hasRecord(operation)) $(operation.selector).insertAdjacentHTML("beforeend", operation.body);
    if (operation.kind === "person") {
      if (!logForm.elements.namedItem("note").value.trim()) selected = operation.id;
      personForm.reset();
      $("#new-person").open = false;
      filter = "all";
      $("#contact-search").value = "";
      document.querySelectorAll("[data-filter]").forEach(function (button) { button.setAttribute("aria-pressed", String(button.dataset.filter === filter)); });
    } else {
      logForm.elements.namedItem("note").value = "";
      logForm.elements.namedItem("when").value = today();
    }
    operation.stage = operation.kind === "log" ? "due" : "complete";
    operation.uncertain = false;
    readRecords();
  }
  async function executePending() {
    if (busy || !pending) return;
    busy = true;
    updateControls();
    var operation = pending;
    var addedPerson = false;
    try {
      if (operation.uncertain) {
        await reload();
        if (hasRecord(operation)) applyConfirmedPost(operation);
        operation.uncertain = false;
      }
      if (operation.stage === "post") {
        say(operation.kind === "log" ? "Saving your conversation…" : "Adding this person…");
        await request("POST", operation.selector, operation.body);
        applyConfirmedPost(operation);
      }
      if (operation.stage === "due") {
        // Always re-read before a due-only retry so a newer conversation wins.
        if (operation.retryDue) await reload();
        var person = people.find(function (p) { return p.id === operation.target; });
        if (!person) throw new Error("The conversation was saved, but its person is no longer available.");
        var due = dueEpochFrom(latestDayFor(person, operation.when), person.cadence);
        await request("PUT", '#people > li[data-contact="' + CSS.escape(operation.target) + '"] [itemprop=dueEpoch]', '<meta itemprop="dueEpoch" content="' + due + '">');
        $('[itemprop=dueEpoch]', person.row).setAttribute("content", due);
        operation.stage = "complete";
      }
      pending = null;
      addedPerson = operation.kind === "person";
      readRecords();
      var success = operation.kind === "person" ? "Added " + operation.name + ". You can save your first conversation now." : "Conversation saved. The next check-in date is updated.";
      try { await reload(); say(success); }
      catch (error) { refreshNeeded = true; say(success + " The latest records could not be refreshed. Refresh before making another change.", true, "Refresh records"); }
    } catch (error) {
      if (operation.stage === "due") {
        operation.retryDue = true;
        say("Your conversation is saved. The next check-in date was not updated. " + error.message + " Retry the date update without saving the conversation again.", true, "Retry date update");
      } else if (error.uncertain || error.duplicate || operation.uncertain) {
        operation.uncertain = true;
        say("The save could not be confirmed. Check the saved records before retrying; the same record ID will be reused to avoid a duplicate.", true, "Check and retry save");
      } else {
        pending = null;
        say(error.message, true);
      }
    } finally {
      busy = false; render();
      if (addedPerson) {
        if (refreshNeeded) $("#retry").focus({ preventScroll: true });
        else focusSelectedContact();
      }
    }
  }
  personForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (busy || pending || refreshNeeded || !personForm.reportValidity()) return;
    var name = personForm.elements.namedItem("name").value.trim();
    var cadence = Number(personForm.elements.namedItem("cadence").value);
    if (!name || !Number.isInteger(cadence) || cadence < 1 || cadence > 3650) { say("Enter a name and a whole-number cadence between 1 and 3,650 days.", true); return; }
    var cid = id("c");
    pending = { kind: "person", stage: "post", id: cid, name: name, selector: "#people", body: '<li data-contact="' + cid + '" itemscope itemtype="https://wef.crm/Contact"><meta itemprop="contactId" content="' + cid + '"><meta itemprop="cadenceDays" content="' + cadence + '"><meta itemprop="dueEpoch" content="' + (Math.floor(Date.now() / 1000) - 1) + '"><span itemprop="name">' + esc(name) + '</span></li>' };
    executePending();
  });
  logForm.addEventListener("submit", function (event) {
    event.preventDefault();
    if (busy || pending || refreshNeeded || !logForm.reportValidity()) return;
    var target = logForm.elements.namedItem("target").value;
    var when = logForm.elements.namedItem("when").value;
    var note = logForm.elements.namedItem("note").value.trim();
    if (!people.some(function (p) { return p.id === target; }) || !note || !validDay(when) || when > today()) { say("Choose a person, a date up to today, and a note about the conversation.", true); return; }
    var iid = id("i");
    pending = { kind: "log", stage: "post", id: iid, target: target, when: when, selector: "#log", body: '<li data-contact="' + esc(target) + '" itemscope itemtype="https://wef.crm/Interaction"><meta itemprop="interactionId" content="' + iid + '"><meta itemprop="interactionTargetId" content="' + esc(target) + '"><meta itemprop="occurredAt" content="' + when + '"><span itemprop="note">' + esc(note) + '</span></li>' };
    executePending();
  });
  async function refresh() {
    if (busy) return;
    if (pending) { executePending(); return; }
    busy = true;
    updateControls();
    say("Refreshing your records…");
    try { await reload(); say("Your records are up to date."); }
    catch (error) { say(error.message + " Your current view and unsaved note are still here.", true, "Refresh records"); }
    finally { busy = false; updateControls(); }
  }
  $("#refresh").addEventListener("click", refresh);
  $("#retry").addEventListener("click", refresh);
  $("#contact-search").addEventListener("input", function () { renderContacts(); updateControls(); });
  document.querySelectorAll("[data-filter]").forEach(function (button) {
    button.addEventListener("click", function () {
      filter = button.dataset.filter;
      document.querySelectorAll("[data-filter]").forEach(function (item) { item.setAttribute("aria-pressed", String(item === button)); });
      renderContacts(); updateControls();
    });
  });
  $("#contacts-view").addEventListener("click", function (event) {
    var card = event.target.closest("[data-person]");
    if (!card || busy || pending) return;
    // A draft stays attached to its chosen person; selecting someone else never
    // silently moves unsaved conversation text to a different contact.
    if (logForm.elements.namedItem("note").value.trim() && card.dataset.person !== selected) { say(currentPerson() ? "Save your current note or clear it before choosing another person." : "This draft’s person is no longer available. Copy or clear the note before choosing another person.", true); return; }
    selected = card.dataset.person;
    logForm.elements.namedItem("target").value = selected;
    render();
    focusSelectedContact();
  });
  logForm.elements.namedItem("target").addEventListener("change", function () {
    if (logForm.elements.namedItem("note").value.trim() && this.value !== selected) { this.value = selected; say(currentPerson() ? "Save your current note or clear it before choosing another person." : "This draft’s person is no longer available. Copy or clear the note before choosing another person.", true); return; }
    selected = this.value; render();
  });
  logForm.elements.namedItem("when").addEventListener("change", renderContext);
  $("#activity-toggle").addEventListener("click", function () { allActivity = !allActivity; renderActivity(); });
  $("#open-person").addEventListener("click", function (event) { event.preventDefault(); $("#new-person").open = true; personForm.elements.namedItem("name").focus(); });
  logForm.elements.namedItem("when").value = today();
  logForm.elements.namedItem("when").max = today();
  readRecords();
  render();
  document.documentElement.classList.add("enhanced");
  // Only a server-provided marker identifies the isolated local preview.
  // Production remains an open demo or private template as declared in HTML.
  fetch(PAGE, { method: "HEAD", credentials: "same-origin", cache: "no-store" }).then(function (response) {
    if (response.headers.get("X-Pagelove-Preview") !== "local") return;
    $(".edition").textContent = "Local preview · sample data";
    $(".edition").classList.add("is-local-preview");
    var detail = $("footer details p");
    detail.textContent = "Changes are saved only in this local preview, separate from the live demo. " + detail.textContent;
  }).catch(function () { /* An unavailable HEAD does not block the real app. */ });
})();
