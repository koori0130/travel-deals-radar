// Display names for the configured destinations. Unknown codes fall back to the code itself.
export const AIRPORT_NAMES = {
  NRT: "東京（成田）", HND: "東京（羽田）", KIX: "大阪（關西）", NGO: "名古屋", CTS: "札幌", FUK: "福岡",
  OKA: "沖繩（那霸）", UKB: "神戶", HIJ: "廣島", SDJ: "仙台",
  ICN: "首爾（仁川）", GMP: "首爾（金浦）", PUS: "釜山", CJU: "濟州",
  BKK: "曼谷（素萬那普）", DMK: "曼谷（廊曼）", CNX: "清邁", HKT: "普吉島", SGN: "胡志明市", HAN: "河內",
  DAD: "峴港", PQC: "富國島",
  SIN: "新加坡", KUL: "吉隆坡", MNL: "馬尼拉", CEB: "宿霧", DPS: "峇里島", HKG: "香港", MFM: "澳門",
  PEK: "北京", PVG: "上海（浦東）", LAX: "洛杉磯", SFO: "舊金山", SYD: "雪梨",
  TPE: "桃園", TSA: "松山",
};

export function airportName(code) {
  return AIRPORT_NAMES[code] ? `${AIRPORT_NAMES[code]} ${code}` : code;
}
