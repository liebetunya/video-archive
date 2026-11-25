(function () {
  "use strict";

  var PAGE = 24;
  var STORAGE_KEY = "eunjo-archive-overrides-v1";
  var EXPORT_KIND = "eunjo-video-overrides";
  var PAGE_MODE = document.documentElement.getAttribute("data-page") === "coaching" ? "coaching" : "main";
  var DATA_ROOT = (document.documentElement.getAttribute("data-root") || ".").replace(/\/?$/, "/");

  function assetUrl(rel) {
    return new URL(DATA_ROOT + rel, document.baseURI);
  }

  var KAKAO_CATS = ["암웨이 관련", "일반 영상", "미분류"];
  var KAKAO_VALID_CATS = KAKAO_CATS.concat(["소비자에게"]);
  var KAKAO_SUBS = ["제품설명", "사업·강의"];
  var CHANNEL_CATS = ["박주희북텔링", "최현홍북텔링", "화목한9시", "각오미팅", "제품설명", "박주희", "최현홍", "강의와미팅", "미분류"];
  var BOOK_CHIP_CATS = ["박주희북텔링"];
  var EAGLE_SUBS = ["Q&A", "넛츠 앤 볼츠", "텐코아", "이동훈박주희"];
  var COACH_SUBS = ["셀프리더코칭", "하드코아코칭", "그 외 코칭"];

  var KAKAO_MOVES = [
    { category: "암웨이 관련", subcategory: "제품설명", label: "암웨이 관련 · 제품설명" },
    { category: "암웨이 관련", subcategory: "사업·강의", label: "암웨이 관련 · 사업·강의" },
    { category: "일반 영상", subcategory: null, label: "일반 영상" },
    { category: "소비자에게", subcategory: null, label: "소비자에게" },
    { category: "미분류", subcategory: null, label: "미분류" },
  ];
  var CHANNEL_MOVES = CHANNEL_CATS.map(function (category) {
    return { category: category, subcategory: null, label: category };
  });
  var EAGLE_MOVES = EAGLE_SUBS.map(function (sub) {
    return { category: "이글드림", subcategory: sub, label: sub };
  });
  var COACH_MOVES = COACH_SUBS.map(function (sub) {
    return { category: "코칭", subcategory: sub, label: sub };
  });

  var $ = function (id) { return document.getElementById(id); };

  var els = {
    wrap: $("wrap"),
    tabKakao: $("tab-kakao"),
    tabChannel: $("tab-channel"),
    tabConsumer: $("tab-consumer"),
    tabEagledream: $("tab-eagledream"),
    q: $("q"),
    clearQ: $("clear-q"),
    chips: $("chips"),
    subchips: $("subchips"),
    meta: $("result-meta"),
    note: $("save-note"),
    status: $("status"),
    grid: $("grid"),
    more: $("more"),
    bar: $("bar"),
    selCount: $("sel-count"),
    moveCat: $("move-cat"),
    moveBtn: $("move-btn"),
    clearSel: $("clear-sel"),
    exportBtn: $("export-btn"),
    importBtn: $("import-btn"),
    importFile: $("import-file"),
    toast: $("toast"),
    descBackdrop: $("desc-backdrop"),
    descSheetPrefix: $("desc-sheet-prefix"),
    descSheetHint: $("desc-sheet-hint"),
    descSheetText: $("desc-sheet-text"),
    descSheetSave: $("desc-sheet-save"),
    descSheetCancel: $("desc-sheet-cancel"),
  };

  var state = {
    tab: "kakao",
    query: "",
    category: "전체",
    sub: "전체",
    shown: PAGE,
    selected: new Set(),
    expanded: new Set(),
    descExpanded: new Set(),
    overrides: loadOverrides(),
    kakao: [],
    channel: [],
    eagledream: [],
    coaching: [],
    loading: true,
    toastTimer: 0,
    searchTimer: 0,
    movesStamp: "",
    lastFocus: null,
    editing: null,
    editDraft: "",
    descFocus: false,
  };

  function h(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (key) {
        var value = props[key];
        if (value == null || value === false) return;
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = String(value);
        else if (key.indexOf("on") === 0 && typeof value === "function") {
          node.addEventListener(key.slice(2).toLowerCase(), value);
        } else node.setAttribute(key, value === true ? "" : String(value));
      });
    }
    if (children) {
      var list = Array.isArray(children) ? children : [children];
      list.forEach(function (child) {
        if (child == null || child === false) return;
        node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
      });
    }
    return node;
  }

  function icon(name) {
    var wrap = document.createElement("span");
    wrap.className = "ico";
    wrap.setAttribute("aria-hidden", "true");
    if (name === "lock") {
      wrap.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg>';
    } else if (name === "unlock") {
      wrap.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 7.5-2"></path></svg>';
    } else {
      wrap.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M8 4v16M3 9h5M3 15h5"></path></svg>';
    }
    return wrap;
  }

  function norm(value) {
    return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function formatDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
    if (!match) return value || "";
    return match[1] + "." + match[2] + "." + match[3];
  }

  // 2026-11-17 -> 261117화 추천. 요일은 시간대와 무관하게 그 날짜의 UTC 요일입니다.
  function recommendLabel(iso) {
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    if (!match) return "";
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var utc = new Date(Date.UTC(year, month - 1, day));
    if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return "";
    var initials = ["일", "월", "화", "수", "목", "금", "토"];
    var yy = String(year % 100).padStart(2, "0");
    var mm = String(month).padStart(2, "0");
    var dd = String(day).padStart(2, "0");
    return yy + mm + dd + initials[utc.getUTCDay()] + " 추천";
  }

  function formatDuration(value) {
    if (value == null || value === "") return "";
    if (typeof value === "number" && isFinite(value)) {
      var total = Math.max(0, Math.round(value));
      var hours = Math.floor(total / 3600);
      var minutes = Math.floor((total % 3600) / 60);
      var seconds = total % 60;
      var pad = function (n) { return String(n).padStart(2, "0"); };
      return hours ? hours + ":" + pad(minutes) + ":" + pad(seconds) : minutes + ":" + pad(seconds);
    }
    return String(value);
  }

  function formatWhen(value) {
    if (!value) return "";
    var match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value);
    if (!match) return value;
    return match[1] + "." + match[2] + "." + match[3] + " " + match[4] + ":" + match[5];
  }

  function stringList(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(function (item) { return typeof item === "string" && item.trim(); })
      .map(function (item) { return item.trim(); });
  }

  function safeUrl(url, id) {
    try {
      var parsed = new URL(url);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.href;
    } catch (error) { /* fall through */ }
    if (id && !String(id).startsWith("PL")) return "https://www.youtube.com/watch?v=" + encodeURIComponent(id);
    return "https://www.youtube.com/";
  }

  function bookNameFrom(raw) {
    var named = typeof raw.book === "string" ? raw.book.trim() : "";
    if (named) return named;
    var title = typeof raw.title === "string" ? raw.title.trim() : "";
    var cut = title.search(/[0-9０-９(（]/);
    var prefix = (cut < 0 ? title : title.slice(0, cut)).replace(/[\s.,·,…]+$/g, "").trim();
    return prefix || "기타";
  }

  function withSearch(item) {
    var parts = [item.title, item.channel, item.caption, item.description, item.book, item.bookName, item.recommendLabel];
    parts.push(item.tags.join(" "));
    parts.push(item.speakers.join(" "));
    item.reviews.forEach(function (review) {
      parts.push(review.text_masked || "", review.author_masked || "");
    });
    var text = norm(parts.filter(Boolean).join("\n"));
    item.search = text;
    item.searchCompact = text.replace(/\s/g, "");
    return item;
  }

  function normalizeKakao(raw) {
    var reviews = Array.isArray(raw.reviews) ? raw.reviews.filter(function (review) {
      return review && (review.text_masked || review.author_masked);
    }) : [];
    var source = raw.source === "playlist" ? "playlist" : "kakao";
    var postDate = raw.post_date || "";
    return withSearch({
      source: source,
      id: String(raw.id || "").trim(),
      url: raw.url || "",
      type: raw.type || "watch",
      date: postDate,
      recommendLabel: source === "kakao" ? recommendLabel(postDate) : "",
      playlistOrder: typeof raw.playlist_order === "number" ? raw.playlist_order : null,
      title: raw.title || "(제목 없음)",
      channel: raw.channel || "",
      duration: formatDuration(raw.duration),
      caption: typeof raw.caption === "string" ? raw.caption : "",
      description: typeof raw.description === "string" ? raw.description.trim() : "",
      category: raw.category || "미분류",
      subcategory: raw.subcategory || null,
      suggested: raw.suggested_category || "",
      tags: stringList(raw.tags),
      book: raw.book || "",
      speakers: stringList(raw.speakers),
      reviews: reviews,
      incomplete: raw.metadata_incomplete === true,
      overridden: false,
    });
  }

  function normalizeChannel(raw, source) {
    return withSearch({
      source: source,
      id: String(raw.id || "").trim(),
      url: raw.url || "",
      type: raw.type || "watch",
      date: raw.date || "",
      title: raw.title || "(제목 없음)",
      channel: raw.channel || "",
      duration: formatDuration(raw.duration),
      caption: typeof raw.caption === "string" ? raw.caption : "",
      description: typeof raw.description === "string" ? raw.description.trim() : "",
      category: raw.category || "미분류",
      subcategory: raw.subcategory || null,
      suggested: raw.suggested_category || "",
      tags: stringList(raw.tags),
      book: raw.book || "",
      bookName: bookNameFrom(raw),
      speakers: stringList(raw.speakers),
      reviews: [],
      incomplete: false,
      overridden: false,
    });
  }

  var SELF_LEADER_FROM = "2026-06-01";
  var SELF_LEADER_UNTIL = "2026-11-25";
  var MANUAL_COACH_SUB = {
    "7sxFu9Say5I": "하드코아코칭",
    "a1QRlReXPPM": "셀프리더코칭"
  };

  function coachingSubFromTitle(title, date, videoId) {
    if (videoId && MANUAL_COACH_SUB[videoId]) return MANUAL_COACH_SUB[videoId];
    if (date && date >= SELF_LEADER_FROM && date <= SELF_LEADER_UNTIL) return "셀프리더코칭";
    var text = title || "";
    if (text.indexOf("하드코아") !== -1 || text.indexOf("하드코어") !== -1) return "하드코아코칭";
    if (text.indexOf("셀프리더") !== -1 || text.indexOf("셀프코칭방") !== -1) return "셀프리더코칭";
    return "그 외 코칭";
  }

  function normalizeEagle(raw) {
    return withSearch({
      source: "eagledream",
      id: String(raw.id || "").trim(),
      url: raw.url || "",
      type: raw.type || "watch",
      date: raw.upload_date || raw.date || "",
      recommendLabel: "",
      playlistOrder: typeof raw.playlist_order === "number" ? raw.playlist_order : null,
      title: raw.title || "(제목 없음)",
      channel: raw.channel || "",
      duration: formatDuration(raw.duration),
      caption: typeof raw.caption === "string" ? raw.caption : "",
      description: typeof raw.description === "string" ? raw.description.trim() : "",
      category: raw.category || "이글드림",
      subcategory: raw.subcategory || null,
      suggested: raw.suggested_category || "",
      tags: stringList(raw.tags),
      book: raw.book || "",
      speakers: stringList(raw.speakers),
      reviews: [],
      incomplete: raw.metadata_incomplete === true,
      overridden: false,
    });
  }

  function loadOverrides() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function saveOverrides() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.overrides));
      return true;
    } catch (error) {
      toast("이 브라우저에 저장하지 못했어요.");
      return false;
    }
  }

  function keyOf(item) { return item.source + ":" + item.id; }

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function viewOf(item) {
    var saved = state.overrides[keyOf(item)];
    if (!saved) return item;
    var catChanged = saved.category !== item.category || (saved.subcategory || null) !== (item.subcategory || null);
    var descChanged = hasOwn(saved, "description") && String(saved.description || "").trim() !== (item.description || "");
    if (!catChanged && !descChanged) return item;
    var next = Object.assign({}, item);
    if (catChanged) {
      next.category = saved.category;
      next.subcategory = saved.subcategory || null;
      next.overridden = true;
    }
    if (descChanged) {
      next.description = String(saved.description || "").trim();
      next.descOverridden = true;
      withSearch(next);
    }
    return next;
  }

  function isMobileEditor() {
    return window.matchMedia("(max-width: 719px)").matches;
  }

  function pencilIcon() {
    var wrap = document.createElement("span");
    wrap.setAttribute("aria-hidden", "true");
    wrap.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>';
    return wrap;
  }

  function saveDescription(raw, text) {
    var key = keyOf(raw);
    var desc = String(text || "").trim();
    var prev = state.overrides[key];
    var category = prev ? prev.category : raw.category;
    var subcategory = prev ? (prev.subcategory || null) : (raw.subcategory || null);
    var catSame = category === raw.category && subcategory === (raw.subcategory || null);
    var descSame = desc === (raw.description || "");
    if (catSame && descSame) delete state.overrides[key];
    else {
      var entry = {
        source: raw.source,
        id: raw.id,
        category: category,
        subcategory: subcategory,
      };
      if (!descSame) entry.description = desc;
      state.overrides[key] = entry;
    }
    saveOverrides();
  }

  function openDescEditor(item) {
    state.editing = keyOf(item);
    state.editDraft = item.description || "";
    state.descFocus = true;
    state.lastFocus = document.activeElement;
    render();
  }

  function closeDescEditor() {
    state.editing = null;
    state.editDraft = "";
    state.descFocus = false;
    if (els.descBackdrop) els.descBackdrop.hidden = true;
    if (els.wrap) els.wrap.inert = false;
    render();
  }

  function saveDescEditor() {
    var raw = state.editing ? findRaw(state.editing) : null;
    if (!raw) {
      closeDescEditor();
      return;
    }
    saveDescription(raw, state.editDraft);
    state.editing = null;
    state.editDraft = "";
    state.descFocus = false;
    toast("설명을 이 브라우저에 저장했어요.");
    render();
  }

  function renderDescSheet() {
    var open = !!(state.editing && isMobileEditor());
    if (els.descBackdrop) els.descBackdrop.hidden = !open;
    if (els.wrap) els.wrap.inert = open;
    if (!open) return;
    var raw = findRaw(state.editing);
    var item = raw ? viewOf(raw) : null;
    var rec = item && item.source === "kakao" ? (item.recommendLabel || "") : "";
    if (rec) {
      els.descSheetPrefix.hidden = false;
      els.descSheetPrefix.textContent = rec;
      els.descSheetHint.hidden = false;
    } else {
      els.descSheetPrefix.hidden = true;
      els.descSheetHint.hidden = true;
    }
    if (document.activeElement !== els.descSheetText) {
      els.descSheetText.value = state.editDraft;
    }
  }

  function focusDescEditor() {
    if (!state.descFocus || !state.editing) return;
    state.descFocus = false;
    setTimeout(function () {
      var field = isMobileEditor() ? els.descSheetText : document.querySelector(".desc-input");
      if (!field) return;
      field.focus();
      var len = field.value.length;
      try { field.setSelectionRange(len, len); } catch (error) { /* ignore */ }
    }, 30);
  }

  function findRaw(key) {
    var pools = [state.kakao, state.channel, state.eagledream, state.coaching];
    for (var i = 0; i < pools.length; i += 1) {
      for (var j = 0; j < pools[i].length; j += 1) {
        if (keyOf(pools[i][j]) === key) return pools[i][j];
      }
    }
    return null;
  }

  function matches(item, query) {
    var text = norm(query);
    if (!text) return true;
    if (item.search.indexOf(text) !== -1) return true;
    var compact = text.replace(/\s/g, "");
    return compact.length > 0 && item.searchCompact.indexOf(compact) !== -1;
  }

  function isConsumerItem(item) {
    return item.category === "소비자에게";
  }

  function baseItems() {
    if (PAGE_MODE === "coaching") return state.coaching;
    if (state.tab === "eagledream") return state.eagledream;
    if (state.tab === "kakao" || state.tab === "consumer") return state.kakao;
    return state.channel;
  }

  function searched() {
    var query = state.query;
    return baseItems().map(viewOf).filter(function (item) { return matches(item, query); });
  }

  function isBookChipCategory(category) {
    return BOOK_CHIP_CATS.indexOf(category) !== -1;
  }

  function bookOrder() {
    return state.tab === "channel" && isBookChipCategory(state.category) && state.sub !== "전체";
  }

  function compareItems(a, b) {
    var aDated = !!a.date;
    var bDated = !!b.date;
    if (aDated !== bDated) return aDated ? -1 : 1;
    if (aDated) {
      if (a.date !== b.date) {
        if (bookOrder()) return a.date < b.date ? -1 : 1;
        return a.date < b.date ? 1 : -1;
      }
      return a.title.localeCompare(b.title, "ko");
    }
    var ao = a.playlistOrder;
    var bo = b.playlistOrder;
    if (ao != null && bo != null && ao !== bo) return ao < bo ? -1 : 1;
    if (ao != null && bo == null) return -1;
    if (ao == null && bo != null) return 1;
    return a.title.localeCompare(b.title, "ko");
  }

  function filtered(items) {
    var list = items;
    if (PAGE_MODE === "coaching") {
      if (state.sub !== "전체") {
        list = list.filter(function (item) { return item.subcategory === state.sub; });
      }
    } else if (state.tab === "eagledream") {
      if (state.sub !== "전체") {
        list = list.filter(function (item) { return item.subcategory === state.sub; });
      }
    } else if (state.tab === "consumer") {
      list = list.filter(isConsumerItem);
    } else if (state.tab === "kakao") {
      list = list.filter(function (item) { return !isConsumerItem(item); });
      if (state.category !== "전체") list = list.filter(function (item) { return item.category === state.category; });
      if (state.category === "암웨이 관련" && state.sub !== "전체") {
        list = list.filter(function (item) { return item.subcategory === state.sub; });
      }
    } else if (state.category === "전체") {
      list = list.filter(function (item) { return item.category !== "코칭"; });
    } else {
      list = list.filter(function (item) { return item.category === state.category; });
      if (isBookChipCategory(state.category) && state.sub !== "전체") {
        list = list.filter(function (item) { return item.bookName === state.sub; });
      }
    }
    return list.slice().sort(compareItems);
  }

  function countBy(items, field) {
    var map = Object.create(null);
    items.forEach(function (item) {
      var key = item[field] || "미분류";
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }

  function currentMoves() {
    if (PAGE_MODE === "coaching") return COACH_MOVES;
    if (state.tab === "eagledream") return EAGLE_MOVES;
    return state.tab === "channel" ? CHANNEL_MOVES : KAKAO_MOVES;
  }

  function localCoachingCount() {
    return state.channel.reduce(function (sum, item) {
      return sum + (viewOf(item).category === "코칭" ? 1 : 0);
    }, 0);
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () { els.toast.hidden = true; }, 2400);
  }

  function showFatal(message) {
    state.loading = true;
    els.status.hidden = false;
    els.status.replaceChildren(
      document.createTextNode(message + " "),
      h("button", { type: "button", onClick: function () { location.reload(); } }, "다시 시도")
    );
    els.grid.replaceChildren();
    els.more.hidden = true;
  }

  function syncMoveOptions() {
    if (state.movesStamp === state.tab) return;
    state.movesStamp = state.tab;
    var moves = currentMoves();
    els.moveCat.replaceChildren(h("option", { value: "", text: "옮길 분류" }));
    moves.forEach(function (move, index) {
      els.moveCat.appendChild(h("option", { value: String(index), text: move.label }));
    });
    els.moveCat.value = "";
  }

  function chipButton(label, pressed, count, onClick, locked) {
    var button = h("button", {
      type: "button",
      class: "chip",
      "aria-pressed": pressed ? "true" : "false",
      onClick: onClick,
    });
    if (locked) button.appendChild(icon("lock"));
    button.appendChild(document.createTextNode(label));
    if (count != null) button.appendChild(h("span", { class: "count", text: String(count) }));
    return button;
  }

  function hideSubchips() {
    if (!els.subchips) return;
    els.subchips.hidden = true;
    els.subchips.replaceChildren();
  }

  function renderChips(items) {
    if (PAGE_MODE === "coaching") {
      els.chips.hidden = false;
      var coachScroll = els.chips.scrollLeft;
      var coachCounts = countBy(items, "subcategory");
      var coachFrag = document.createDocumentFragment();
      coachFrag.appendChild(chipButton("전체", state.sub === "전체", items.length, function () {
        chooseSub("전체");
      }, false));
      COACH_SUBS.forEach(function (sub) {
        coachFrag.appendChild(chipButton(sub, state.sub === sub, coachCounts[sub] || 0, function () {
          chooseSub(sub);
        }, false));
      });
      els.chips.replaceChildren(coachFrag);
      els.chips.scrollLeft = coachScroll;
      hideSubchips();
      return;
    }
    if (state.tab === "eagledream") {
      els.chips.hidden = false;
      var chipScroll = els.chips.scrollLeft;
      var counts = countBy(items, "subcategory");
      var frag = document.createDocumentFragment();
      frag.appendChild(chipButton("전체", state.sub === "전체", items.length, function () {
        chooseSub("전체");
      }, false));
      EAGLE_SUBS.forEach(function (sub) {
        frag.appendChild(chipButton(sub, state.sub === sub, counts[sub] || 0, function () {
          chooseSub(sub);
        }, false));
      });
      els.chips.replaceChildren(frag);
      els.chips.scrollLeft = chipScroll;
      hideSubchips();
      return;
    }
    if (state.tab === "consumer") {
      els.chips.hidden = true;
      hideSubchips();
      return;
    }
    els.chips.hidden = false;
    if (state.tab === "kakao") {
      items = items.filter(function (item) { return !isConsumerItem(item); });
    }
    var chipScroll = els.chips.scrollLeft;
    var subScroll = els.subchips.scrollLeft;
    var counts = countBy(items, "category");
    var categories = state.tab === "kakao" ? KAKAO_CATS : CHANNEL_CATS;
    var total = items.length;
    var frag = document.createDocumentFragment();
    frag.appendChild(chipButton("전체", state.category === "전체", total, function () {
      chooseCategory("전체");
    }, false));
    categories.forEach(function (category) {
      var count = counts[category] || 0;
      frag.appendChild(chipButton(category, state.category === category, count, function () {
        chooseCategory(category);
      }, false));
    });
    els.chips.replaceChildren(frag);
    els.chips.scrollLeft = chipScroll;

    var showAmway = state.tab === "kakao" && state.category === "암웨이 관련";
    var showBooks = state.tab === "channel" && isBookChipCategory(state.category);
    els.subchips.hidden = !(showAmway || showBooks);
    els.subchips.classList.toggle("bookchips", showBooks);
    els.subchips.setAttribute("aria-label", showBooks ? state.category + " 책" : "암웨이 하위 분류");
    if (!showAmway && !showBooks) return;
    var subFrag = document.createDocumentFragment();
    if (showAmway) {
      var amway = items.filter(function (item) { return item.category === "암웨이 관련"; });
      var subCounts = countBy(amway, "subcategory");
      subFrag.appendChild(chipButton("전체", state.sub === "전체", amway.length, function () {
        chooseSub("전체");
      }, false));
      KAKAO_SUBS.forEach(function (sub) {
        subFrag.appendChild(chipButton(sub, state.sub === sub, subCounts[sub] || 0, function () {
          chooseSub(sub);
        }, false));
      });
    } else {
      var morning = items.filter(function (item) { return item.category === state.category; });
      var bookCounts = countBy(morning, "bookName");
      var latest = Object.create(null);
      morning.forEach(function (item) {
        var name = item.bookName || "기타";
        if (!latest[name] || latest[name] < item.date) latest[name] = item.date;
      });
      var names = Object.keys(bookCounts).filter(function (name) { return name !== "기타" && bookCounts[name]; });
      names.sort(function (a, b) {
        if (latest[a] !== latest[b]) return latest[a] < latest[b] ? 1 : -1;
        return a.localeCompare(b, "ko");
      });
      if (bookCounts["기타"]) names.push("기타");
      subFrag.appendChild(chipButton("전체", state.sub === "전체", morning.length, function () {
        chooseSub("전체");
      }, false));
      names.forEach(function (name) {
        subFrag.appendChild(chipButton(name, state.sub === name, bookCounts[name] || 0, function () {
          chooseSub(name);
        }, false));
      });
    }
    els.subchips.replaceChildren(subFrag);
    els.subchips.scrollLeft = subScroll;
  }

  function chooseCategory(category) {
    state.category = category;
    state.sub = "전체";
    state.shown = PAGE;
    state.selected.clear();
    render();
  }

  function chooseSub(sub) {
    state.sub = sub;
    state.shown = PAGE;
    state.selected.clear();
    render();
  }

  function categoryLabel(item) {
    if (item.source === "kakao" && item.category === "암웨이 관련" && item.subcategory) return item.subcategory;
    if (item.source === "eagledream" && item.subcategory) return item.subcategory;
    if (item.source === "coaching" && item.subcategory) return item.subcategory;
    return item.category || "미분류";
  }

  function placeholder(text) {
    var box = h("div", { class: "placeholder" });
    box.appendChild(icon("list"));
    box.appendChild(h("span", { text: text }));
    return box;
  }

  function renderCard(item) {
    var key = keyOf(item);
    var url = safeUrl(item.url, item.id);
    var card = h("article", { class: item && state.selected.has(key) ? "card is-selected" : "card" });
    var selected = state.selected.has(key);

    var thumb = h("a", {
      class: "thumb",
      href: url,
      target: "_blank",
      rel: "noopener noreferrer",
      "aria-label": "유튜브에서 열기: " + item.title,
    });
    var playlist = item.type === "playlist" || String(item.id).indexOf("PL") === 0;
    if (playlist) thumb.appendChild(placeholder("재생목록"));
    else {
      var img = h("img", {
        src: "https://i.ytimg.com/vi/" + encodeURIComponent(item.id) + "/mqdefault.jpg",
        alt: "",
        width: "320",
        height: "180",
        loading: "lazy",
        decoding: "async",
        referrerpolicy: "no-referrer",
      });
      img.addEventListener("error", function () {
        if (img.parentNode) img.replaceWith(placeholder("썸네일 없음"));
      });
      thumb.appendChild(img);
    }
    thumb.appendChild(h("span", { class: "pill", text: categoryLabel(item) }));
    var badges = h("div", { class: "badges" });
    if (item.type === "live") badges.appendChild(h("span", { class: "badge", text: "라이브" }));
    if (playlist) badges.appendChild(h("span", { class: "badge", text: "재생목록" }));
    if (item.incomplete) badges.appendChild(h("span", { class: "badge warn", text: "정보 부족" }));
    if (badges.childNodes.length) thumb.appendChild(badges);

    var checkbox = h("input", { type: "checkbox", "aria-label": "선택: " + item.title });
    checkbox.checked = selected;
    checkbox.addEventListener("change", function () {
      if (checkbox.checked) state.selected.add(key);
      else state.selected.delete(key);
      render();
    });
    var pick = h("label", { class: "pick" }, [checkbox, h("span")]);

    var title = h("a", {
      class: "title",
      href: url,
      target: "_blank",
      rel: "noopener noreferrer",
      text: item.title,
    });
    var heading = h("h2", { class: "title-row" }, [pick, title]);

    var metaBits = [];
    if (item.date) metaBits.push(formatDate(item.date) + (item.source === "kakao" ? " 공유" : ""));
    if (item.duration) metaBits.push(item.duration);
    if (item.channel) metaBits.push(item.channel);
    var body = h("div", { class: "body" }, [
      heading,
      metaBits.length ? h("p", { class: "meta", text: metaBits.join(" · ") }) : null,
    ]);

    var descText = item.description || "";
    var recLabel = item.source === "kakao" ? item.recommendLabel : "";
    var editingHere = state.editing === key && !isMobileEditor();
    var descBox = h("div", { class: "desc-box" });
    if (editingHere) {
      if (recLabel) {
        descBox.appendChild(h("p", { class: "desc-prefix" }, [
          h("span", { class: "rec-label", text: recLabel }),
          " ",
          h("span", { class: "desc-prefix-note", text: "추천일은 자동으로 붙어요" }),
        ]));
      }
      var ta = h("textarea", {
        class: "desc-input",
        rows: "5",
        placeholder: "제목과 후기를 참고해 설명을 적어 주세요",
      });
      ta.value = state.editDraft;
      ta.addEventListener("input", function () { state.editDraft = ta.value; });
      descBox.appendChild(ta);
      descBox.appendChild(h("div", { class: "desc-actions" }, [
        h("button", { type: "button", class: "btn-ghost desc-cancel", onClick: function () { closeDescEditor(); } }, "취소"),
        h("button", { type: "button", class: "btn-primary desc-save", onClick: function () { saveDescEditor(); } }, "저장"),
      ]));
      body.appendChild(descBox);
    } else {
      if (recLabel || descText) {
        var descOpen = state.descExpanded.has(key);
        var longDesc = descText.length > 180;
        var desc = h("p", { class: longDesc && !descOpen ? "desc clamp" : "desc" });
        if (recLabel) desc.appendChild(h("span", { class: "rec-label", text: recLabel }));
        if (descText) desc.appendChild(document.createTextNode((recLabel ? " · " : "") + descText));
        descBox.appendChild(desc);
        if (longDesc) {
          descBox.appendChild(h("button", {
            type: "button",
            class: "review-btn",
            onClick: function () {
              if (descOpen) state.descExpanded.delete(key);
              else state.descExpanded.add(key);
              render();
            },
          }, descOpen ? "설명 접기" : "설명 더 보기"));
        }
      }
      descBox.appendChild(h("button", {
        type: "button",
        class: "desc-edit-btn",
        "aria-label": "설명 수정: " + item.title,
        onClick: function () { openDescEditor(item); },
      }, [pencilIcon(), "설명 수정"]));
      body.appendChild(descBox);
    }

    var people = [];
    if (item.book) people.push(item.book);
    if (item.speakers.length) people.push(item.speakers.join(", "));
    if (people.length) body.appendChild(h("p", { class: "people", text: people.join(" · ") }));

    if (item.tags.length) {
      var tags = h("div", { class: "tags" });
      item.tags.slice(0, 5).forEach(function (tag) {
        tags.appendChild(h("span", { class: "tag", text: tag }));
      });
      body.appendChild(tags);
    }

    if (item.category === "미분류" && item.suggested) {
      body.appendChild(h("p", { class: "hint", text: "추천 분류 · " + item.suggested }));
    }
    if (item.overridden || item.descOverridden) {
      var editedLabel = item.overridden && item.descOverridden
        ? "이 브라우저에서 분류와 설명을 바꿨어요"
        : item.descOverridden
          ? "이 브라우저에서 설명을 바꿨어요"
          : "이 브라우저에서 분류를 바꿨어요";
      body.appendChild(h("p", { class: "edited", text: editedLabel }));
    }

    if (item.source === "kakao" && item.reviews.length) {
      var open = state.expanded.has(key);
      body.appendChild(h("button", {
        type: "button",
        class: "review-btn",
        "aria-expanded": open ? "true" : "false",
        onClick: function () {
          if (open) state.expanded.delete(key);
          else state.expanded.add(key);
          render();
        },
      }, open ? "후기 접기 · " + item.reviews.length : "후기 " + item.reviews.length + "개 보기"));
      if (open) {
        var list = h("div", { class: "reviews" });
        item.reviews.slice().sort(function (a, b) {
          return String(a.time || "").localeCompare(String(b.time || ""));
        }).forEach(function (review) {
          var who = h("div", {}, [
            h("span", { class: "who", text: review.author_masked || "이름 없음" }),
            review.time ? h("span", { class: "when", text: formatWhen(review.time) }) : null,
          ]);
          list.appendChild(h("div", { class: "review" }, [
            who,
            h("p", { class: "text", text: review.text_masked || "" }),
          ]));
        });
        body.appendChild(list);
      }
    }

    card.append(thumb, body);
    return card;
  }

  function renderCoachNote() {
    return;
  }

  function render() {
    if (state.loading) return;
    if (els.tabKakao) els.tabKakao.setAttribute("aria-selected", state.tab === "kakao" ? "true" : "false");
    if (els.tabChannel) els.tabChannel.setAttribute("aria-selected", state.tab === "channel" ? "true" : "false");
    if (els.tabConsumer) els.tabConsumer.setAttribute("aria-selected", state.tab === "consumer" ? "true" : "false");
    if (els.tabEagledream) els.tabEagledream.setAttribute("aria-selected", state.tab === "eagledream" ? "true" : "false");
    if (els.clearQ) els.clearQ.hidden = !state.query;

    var matched = searched();
    renderChips(matched);
    var list = filtered(matched);
    var slice = list.slice(0, state.shown);
    var frag = document.createDocumentFragment();
    slice.forEach(function (item) { frag.appendChild(renderCard(item)); });
    els.grid.replaceChildren(frag);

    var editCount = Object.keys(state.overrides).length;
    var meta = list.length + "개 · " + (bookOrder() ? "읽는 순" : "최신순");
    if (state.query) meta = "검색 결과 " + meta;
    if (editCount) meta += " · 브라우저 수정 " + editCount + "건";
    els.meta.textContent = meta;
    els.note.textContent = editCount
      ? "이 브라우저에만 변경 " + editCount + "건이 저장되어 있어요. 다른 기기나 저장소에는 반영되지 않아요."
      : "변경사항은 이 브라우저에만 저장됩니다. 다른 기기에는 내보낸 파일을 가져와 주세요.";
    renderDescSheet();
    focusDescEditor();

    if (!list.length) {
      els.status.hidden = false;
      els.status.className = "empty";
      els.status.replaceChildren();
      if (state.query) {
        els.status.textContent = "검색 결과가 없어요.";
      } else if (PAGE_MODE === "coaching") {
        els.status.textContent = "코칭 영상이 없어요.";
      } else {
        els.status.textContent = "이 분류의 영상이 없어요.";
      }
    } else {
      els.status.hidden = true;
    }

    var rest = list.length - slice.length;
    els.more.hidden = rest <= 0;
    els.more.textContent = "더 보기 · " + Math.min(PAGE, rest) + "개";

    renderCoachNote();
    syncMoveOptions();
    var selectedCount = state.selected.size;
    els.selCount.textContent = selectedCount + "개 선택";
    els.bar.hidden = selectedCount === 0;
    els.moveBtn.disabled = selectedCount === 0 || !els.moveCat.value;
    document.body.classList.toggle("has-bar", selectedCount > 0);
  }

  function setTab(tab) {
    if (state.tab === tab) return;
    state.tab = tab;
    state.category = "전체";
    state.sub = "전체";
    state.shown = PAGE;
    state.selected.clear();
    render();
  }

  function allowedOverride(key, entry) {
    if (!entry || typeof entry !== "object") return false;
    if (typeof entry.source !== "string" || typeof entry.id !== "string" || !entry.id) return false;
    if (key !== entry.source + ":" + entry.id) return false;
    if (hasOwn(entry, "description") && typeof entry.description !== "string") return false;
    if (entry.source === "kakao" || entry.source === "playlist") {
      if (KAKAO_VALID_CATS.indexOf(entry.category) === -1) return false;
      if (entry.category === "암웨이 관련") return KAKAO_SUBS.indexOf(entry.subcategory) !== -1;
      return !entry.subcategory;
    }
    if (entry.source === "coaching") {
      if (entry.category !== "코칭") return false;
      return !entry.subcategory || COACH_SUBS.indexOf(entry.subcategory) !== -1;
    }
    if (entry.source === "channel") {
      return CHANNEL_CATS.indexOf(entry.category) !== -1;
    }
    if (entry.source === "eagledream") {
      return entry.category === "이글드림" && EAGLE_SUBS.indexOf(entry.subcategory) !== -1;
    }
    return false;
  }

  function parseImport(data) {
    if (!data || typeof data !== "object" || !data.overrides || typeof data.overrides !== "object" || Array.isArray(data.overrides)) {
      throw new Error("shape");
    }
    if (data.kind && data.kind !== EXPORT_KIND) throw new Error("kind");
    if (data.version && data.version !== 1) throw new Error("version");
    var next = {};
    Object.keys(data.overrides).forEach(function (key) {
      var entry = data.overrides[key];
      if (!allowedOverride(key, entry)) throw new Error("entry");
      next[key] = {
        source: entry.source,
        id: entry.id,
        category: entry.category,
        subcategory: ((entry.source === "kakao" || entry.source === "playlist") && entry.category === "암웨이 관련") || entry.source === "eagledream" || entry.source === "coaching" ? (entry.subcategory || null) : null,
      };
      if (hasOwn(entry, "description")) next[key].description = entry.description;
    });
    return next;
  }

  function exportOverrides() {
    var sorted = {};
    Object.keys(state.overrides).sort().forEach(function (key) { sorted[key] = state.overrides[key]; });
    var payload = {
      version: 1,
      kind: EXPORT_KIND,
      exportedAt: new Date().toISOString(),
      overrides: sorted,
    };
    var blob = new Blob([JSON.stringify(payload, null, 2) + "\n"], { type: "application/json" });
    var link = h("a", { href: URL.createObjectURL(blob), download: "eunjo-overrides-" + payload.exportedAt.slice(0, 10) + ".json" });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
    toast(Object.keys(sorted).length ? "변경사항 파일을 저장했어요." : "저장된 변경이 없어 빈 목록을 내려받았어요.");
  }

  function moveSelected() {
    var choice = currentMoves()[Number(els.moveCat.value)];
    if (!choice || state.selected.size === 0) return;
    var count = 0;
    state.selected.forEach(function (key) {
      var item = findRaw(key);
      if (!item) return;
      var same = item.category === choice.category && (item.subcategory || null) === (choice.subcategory || null);
      var prev = state.overrides[key];
      var keepDesc = hasOwn(prev || {}, "description");
      if (same && !(keepDesc && prev.description !== (item.description || ""))) delete state.overrides[key];
      else {
        var entry = {
          source: item.source,
          id: item.id,
          category: choice.category,
          subcategory: choice.subcategory,
        };
        if (keepDesc) entry.description = prev.description;
        if (same && keepDesc && entry.description === (item.description || "")) delete entry.description;
        if (same && !hasOwn(entry, "description")) delete state.overrides[key];
        else state.overrides[key] = entry;
      }
      count += 1;
    });
    saveOverrides();
    state.selected.clear();
    els.moveCat.value = "";
    if (choice.category === "소비자에게") {
      state.tab = "consumer";
      state.category = "전체";
      state.sub = "전체";
      state.shown = PAGE;
    } else if (state.tab === "consumer") {
      state.tab = "kakao";
      state.category = choice.category || "전체";
      state.sub = choice.subcategory || "전체";
      state.shown = PAGE;
    } else if (PAGE_MODE === "coaching") {
      state.sub = choice.subcategory || "전체";
      state.shown = PAGE;
    }
    toast(count + "개 영상을 옮겼어요.");
    render();
  }

  if (els.tabKakao) els.tabKakao.addEventListener("click", function () { setTab("kakao"); });
  if (els.tabChannel) els.tabChannel.addEventListener("click", function () { setTab("channel"); });
  if (els.tabConsumer) els.tabConsumer.addEventListener("click", function () { setTab("consumer"); });
  if (els.tabEagledream) els.tabEagledream.addEventListener("click", function () { setTab("eagledream"); });
  function syncSearchPadding() {
    els.q.parentElement.classList.toggle("has-value", els.q.value.length > 0);
  }

  els.q.addEventListener("input", function () {
    syncSearchPadding();
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(function () {
      state.query = els.q.value;
      state.shown = PAGE;
      state.selected.clear();
      render();
    }, 150);
  });
  els.q.addEventListener("keydown", function (event) {
    if (event.key === "Enter") els.q.blur();
  });
  els.clearQ.addEventListener("click", function () {
    els.q.value = "";
    syncSearchPadding();
    state.query = "";
    state.shown = PAGE;
    state.selected.clear();
    els.q.focus();
    render();
  });
  els.more.addEventListener("click", function () {
    state.shown += PAGE;
    render();
  });
  els.clearSel.addEventListener("click", function () {
    state.selected.clear();
    render();
  });
  els.moveCat.addEventListener("change", function () {
    els.moveBtn.disabled = state.selected.size === 0 || !els.moveCat.value;
  });
  els.moveBtn.addEventListener("click", moveSelected);
  els.exportBtn.addEventListener("click", exportOverrides);
  els.importBtn.addEventListener("click", function () { els.importFile.click(); });
  els.importFile.addEventListener("change", function () {
    var file = els.importFile.files && els.importFile.files[0];
    els.importFile.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var next = parseImport(JSON.parse(String(reader.result || "")));
        var current = Object.keys(state.overrides).length;
        if (current && !window.confirm("이 브라우저의 변경 " + current + "건을 가져온 파일로 바꿀까요?")) return;
        state.overrides = next;
        saveOverrides();
        state.selected.clear();
        toast(Object.keys(next).length + "건을 가져왔어요.");
        render();
      } catch (error) {
        toast("가져올 수 없는 파일이에요.");
      }
    };
    reader.readAsText(file);
  });
  els.descSheetText.addEventListener("input", function () {
    state.editDraft = els.descSheetText.value;
  });
  els.descSheetSave.addEventListener("click", saveDescEditor);
  els.descSheetCancel.addEventListener("click", closeDescEditor);
  els.descBackdrop.addEventListener("click", function (event) {
    if (event.target === els.descBackdrop) closeDescEditor();
  });
  window.matchMedia("(max-width: 719px)").addEventListener("change", function () {
    if (state.editing) {
      state.descFocus = true;
      render();
    }
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && state.editing) closeDescEditor();
    var typing = document.activeElement === els.q || (document.activeElement && document.activeElement.tagName === "TEXTAREA");
    if (event.key === "/" && !typing) {
      event.preventDefault();
      els.q.focus();
    }
  });

  async function init() {
    if (location.protocol === "file:") {
      showFatal("파일을 직접 열면 영상을 불러올 수 없어요. 로컬 서버로 열어 주세요.");
      return;
    }
    if (PAGE_MODE === "coaching") {
      try {
        var coachRes = await fetch(assetUrl("data/coaching.json"));
        if (!coachRes.ok) throw new Error("fetch");
        var coachJson = await coachRes.json();
        var coachVideos = Array.isArray(coachJson) ? coachJson : coachJson.videos;
        if (!Array.isArray(coachVideos)) throw new Error("shape");
        state.coaching = coachVideos.map(function (item) {
          var normalized = normalizeChannel(item, "coaching");
          if (!normalized.subcategory) normalized.subcategory = coachingSubFromTitle(normalized.title, normalized.date, normalized.id);
          return normalized;
        }).filter(function (item) { return item.id; });
        state.category = "코칭";
        state.loading = false;
        render();
      } catch (error) {
        showFatal("영상을 불러오지 못했어요.");
      }
      return;
    }
    try {
      var responses = await Promise.all([
        fetch(assetUrl("data/kakao.json")),
        fetch(assetUrl("data/channel.json")),
        fetch(assetUrl("data/eagledream.json")),
      ]);
      if (!responses[0].ok || !responses[1].ok || !responses[2].ok) throw new Error("fetch");
      var kakaoJson = await responses[0].json();
      var channelJson = await responses[1].json();
      var eagleJson = await responses[2].json();
      var kakaoVideos = Array.isArray(kakaoJson) ? kakaoJson : kakaoJson.videos;
      var channelVideos = Array.isArray(channelJson) ? channelJson : channelJson.videos;
      var eagleVideos = Array.isArray(eagleJson) ? eagleJson : eagleJson.videos;
      if (!Array.isArray(kakaoVideos) || !Array.isArray(channelVideos) || !Array.isArray(eagleVideos)) throw new Error("shape");
      state.kakao = kakaoVideos.map(normalizeKakao).filter(function (item) { return item.id; });
      state.channel = channelVideos.map(function (item) {
        return normalizeChannel(item, "channel");
      }).filter(function (item) { return item.id; });
      state.eagledream = eagleVideos.map(normalizeEagle).filter(function (item) { return item.id; });
      state.loading = false;
      render();
    } catch (error) {
      showFatal("영상을 불러오지 못했어요.");
    }
  }

  init();
})();
