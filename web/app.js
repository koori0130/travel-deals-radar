// 旅行說飛就飛 — front end. Reads data/fares.json and data/promos.json (or fixtures/ with ?data=fixtures).
import { airportName } from "./airports.js";
import {
  TRIP_LABEL, addDays, buildHash, formatPrice, googleExploreLink, googleFlightsLink, isGenericLink, monthDetail,
  parseHash, promoList, rankDestinations, safeUrl, searchDate, skyscannerLink, staleSources, taipeiDate,
} from "./logic.js";

const params = new URLSearchParams(location.search);
const DATA_DIR = params.get("data") === "fixtures" ? "fixtures" : "data";
const NOW = params.get("now") ? new Date(params.get("now")) : new Date();

const state = {
  ...parseHash(location.hash),
  expanded: null,
  fares: null,
  promos: null,
  loadError: null,
};

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") el.className = value;
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

const $ = (id) => document.getElementById(id);
const fmtDate = (iso) => new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
const fmtDay = (iso) => new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "numeric", day: "numeric" }).format(new Date(iso));
const monthLabel = (m) => `${m.slice(0, 4)} 年 ${Number(m.slice(5))} 月`;

async function loadJson(name) {
  const response = await fetch(`${DATA_DIR}/${name}`, { cache: "no-cache" });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  return response.json();
}

async function load() {
  const [fares, promos] = await Promise.allSettled([loadJson("fares.json"), loadJson("promos.json")]);
  if (fares.status === "fulfilled") state.fares = fares.value;
  if (promos.status === "fulfilled") state.promos = promos.value;
  if (fares.status === "rejected" && promos.status === "rejected") {
    state.loadError = "資料載入失敗，請稍後再試。";
  }
  state.faresError = fares.status === "rejected" ? "票價資料載入失敗。" : null;
  state.promosError = promos.status === "rejected" ? "促銷資料載入失敗。" : null;
}

function renderControls() {
  const originChips = $("origin-chips");
  originChips.replaceChildren(
    ...["TPE", "TSA"].map((code) =>
      h("button", {
        type: "button",
        class: "chip",
        "aria-pressed": String(state.origins.has(code)),
        onclick: () => {
          if (state.origins.has(code) && state.origins.size === 1) return; // keep at least one airport
          if (state.origins.has(code)) state.origins.delete(code);
          else state.origins.add(code);
          state.expanded = null;
          render();
        },
      }, airportName(code)),
    ),
  );
  const tripChips = $("trip-chips");
  tripChips.replaceChildren(
    ...Object.entries(TRIP_LABEL).map(([key, label]) =>
      h("button", {
        type: "button",
        class: "chip",
        "aria-pressed": String(state.tripType === key),
        onclick: () => { state.tripType = key; state.expanded = null; render(); },
      }, label),
    ),
  );
  const airlineControl = $("airline-control");
  const sources = state.promos?.sources ?? [];
  airlineControl.hidden = state.view !== "promo" || sources.length === 0;
  $("airline-chips").replaceChildren(
    h("button", {
      type: "button", class: "chip", "aria-pressed": String(state.airlines.size === 0),
      onclick: () => { state.airlines = new Set(); render(); },
    }, "全部"),
    ...sources.map((s) =>
      h("button", {
        type: "button", class: "chip", "aria-pressed": String(state.airlines.has(s.id)),
        onclick: () => {
          if (state.airlines.has(s.id)) state.airlines.delete(s.id);
          else state.airlines.add(s.id);
          render();
        },
      }, s.airlineZh ?? s.airline),
    ),
  );
  const tabs = $("tabs");
  tabs.replaceChildren(
    ...[["year", "未來 1 年最便宜"], ["promo", "未來 1 個月特價"]].map(([key, label]) =>
      h("button", {
        type: "button", role: "tab", class: "tab", id: `tab-${key}`,
        "aria-selected": String(state.view === key),
        onclick: () => { state.view = key; state.expanded = null; render(); },
      }, label),
    ),
  );
}

function bookLink(url, text = "前往訂購") {
  const safe = safeUrl(url);
  if (!safe) return null;
  return h("a", { class: "book", href: safe, target: "_blank", rel: "noopener noreferrer" }, text);
}

/** Prefilled searches on Google Flights and Skyscanner, so the visitor lands on this route and date. */
function searchLinks(origin, destination, date) {
  return [
    bookLink(googleFlightsLink(origin, destination, date), "用 Google Flights 查價"),
    bookLink(skyscannerLink(origin, destination, date), "用 Skyscanner 查價"),
  ];
}

function emptyState(text) {
  return h("div", { class: "empty-state" }, text);
}

function renderYear() {
  if (!state.fares) return emptyState("目前沒有可顯示的票價資料。");
  const groups = rankDestinations(state.fares.fares ?? [], state.origins);
  const list = groups[state.tripType];
  if (list.length === 0) return emptyState(`目前沒有${TRIP_LABEL[state.tripType]}票價資料。`);
  const today = taipeiDate(NOW);
  return h("div", {},
    h("h2", { class: "group-title" }, `${TRIP_LABEL[state.tripType]}・最低價由低到高`),
    h("ol", { class: "list" }, list.map((fare) => {
      const key = `${fare.tripType}|${fare.destination}`;
      const open = state.expanded === key;
      const card = h("li", { class: "card" },
        h("button", {
          type: "button", class: "row-button", "aria-expanded": String(open),
          onclick: () => { state.expanded = open ? null : key; render(); },
        },
          h("span", { class: "row-title" }, airportName(fare.destination),
            fare.stale ? h("span", { class: "tag warn" }, "資料過期") : null),
          h("span", { class: "row-price" }, formatPrice(fare.price, fare.currency)),
          h("span", { class: "row-sub" }, `${airportName(fare.origin)} 出發・${monthLabel(fare.month)}`),
          h("span", { class: "row-sub right" }, `${TRIP_LABEL[fare.tripType]}・${fare.taxIncluded ? "含稅" : "未稅"}`),
        ),
      );
      if (open) {
        const detail = monthDetail(state.fares.fares, { destination: fare.destination, origins: state.origins, tripType: fare.tripType, today });
        card.append(h("div", { class: "detail" },
          h("ul", { class: "months" }, detail.map(({ month, fare: f }) =>
            h("li", { class: f ? "month" : "month empty" },
              h("span", { class: "m" }, monthLabel(month)),
              f ? formatPrice(f.price, f.currency) : "無資料"),
          )),
          h("div", { class: "actions" }, searchLinks(fare.origin, fare.destination, fare.departureDate ?? addDays(today, 1))),
        ));
      }
      return card;
    })),
  );
}

function promoCard(p) {
  const end = p.saleEnd ? `${fmtDate(p.saleEnd)} 截止` : "截止時間未公告";
  const travel = p.travelFrom || p.travelTo
    ? `出發 ${p.travelFrom ?? "即日"} 至 ${p.travelTo ?? "未公告"}`
    : "出發日期未公告";
  const source = (state.promos?.sources ?? []).find((s) => s.id === p.sourceId);
  const generic = isGenericLink(p.sourceUrl, source?.siteUrl);
  const airlineName = source?.airlineZh ?? p.airline;
  const date = searchDate(p, taipeiDate(NOW));
  return h("li", { class: "card" },
    h("div", { class: "card-static" },
      h("span", { class: "row-title" }, `${airportName(p.destination)}`,
        h("span", { class: "tag" }, p.airline),
        p.manual ? h("span", { class: "tag" }, "人工整理") : null),
      h("span", { class: "row-price" }, formatPrice(p.price, p.currency)),
      h("span", { class: "row-sub" }, `${airportName(p.origin)} 出發・${TRIP_LABEL[p.tripType]}・${p.taxIncluded ? "含稅" : "未稅"}`),
      h("span", { class: "row-sub right" }, end),
      h("span", { class: "row-sub" }, travel),
    ),
    h("div", { class: "detail" },
      generic
        ? h("p", { class: "row-sub" }, `這筆促銷沒有專屬頁面，下方「${airlineName}官網」只是首頁，不會帶入查詢條件（網站語言也可能不是中文）。建議用下方的航線查價連結，或到官網自行搜尋 ${p.origin} 到 ${p.destination}。`)
        : null,
      h("div", { class: "actions" },
        bookLink(p.sourceUrl, generic ? `${airlineName}官網` : "前往促銷頁"),
        searchLinks(p.origin, p.destination, date),
      ),
    ),
  );
}

function renderPromos() {
  if (!state.promos) return emptyState("目前沒有可顯示的促銷資料。");
  const groups = promoList(state.promos.promos ?? [], { origins: state.origins, now: NOW, airlines: state.airlines });
  const list = groups[state.tripType];
  if (list.length === 0) {
    return emptyState(state.airlines.size > 0
      ? `所選航空公司目前沒有${TRIP_LABEL[state.tripType]}促銷，可以改選其他航空公司或按「全部」。`
      : `目前沒有${TRIP_LABEL[state.tripType]}促銷。`);
  }
  return h("div", {},
    h("h2", { class: "group-title" }, `${TRIP_LABEL[state.tripType]}・價格低到高，同價先看快截止的`),
    h("ol", { class: "list" }, list.map(promoCard)),
  );
}

function renderNotices() {
  const notices = [];
  if (state.loadError) notices.push(h("div", { class: "notice error", role: "alert" }, state.loadError));
  else {
    if (state.faresError && state.view === "year") notices.push(h("div", { class: "notice error" }, state.faresError));
    if (state.promosError && state.view === "promo") notices.push(h("div", { class: "notice error" }, state.promosError));
  }
  if (state.view === "promo") {
    for (const s of staleSources(state.promos)) {
      const when = s.lastSuccessAt ? `最後更新 ${fmtDay(s.lastSuccessAt)}` : "尚無成功更新";
      notices.push(h("div", { class: "notice" }, `${s.airlineZh ?? s.airline} 的促銷資料已過期（${when}），可能漏掉新促銷。`));
    }
  }
  $("notices").replaceChildren(...notices);
}

function render() {
  renderControls();
  renderNotices();
  const content = $("content");
  if (state.loadError) content.replaceChildren(emptyState("目前無法顯示資料。"));
  else content.replaceChildren(state.view === "year" ? renderYear() : renderPromos());
  const generated = state.view === "year" ? state.fares?.generatedAt : state.promos?.generatedAt;
  $("generated").textContent = generated ? `資料產生時間：${fmtDate(generated)}` : "";
  $("explore").replaceChildren(
    "想自己逛逛所有目的地？在 Google Flights 探索：",
    ...[...state.origins].sort().flatMap((o) => [
      h("a", { href: googleExploreLink(o), target: "_blank", rel: "noopener noreferrer" }, `${airportName(o)} 出發`),
      " ",
    ]),
  );
  // Keep the view in the URL so Back and refresh restore it.
  try {
    history.replaceState(null, "", `${location.pathname}${location.search}${buildHash(state)}`);
  } catch {
    // history can be unavailable in some embedded contexts; the page still works without it
  }
}

await load();
render();
