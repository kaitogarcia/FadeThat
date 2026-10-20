const locale = (lang) => (lang === "ja" ? "ja-JP" : "en-US");

const SHORT_JA = {
  JPY: "円", USD: "米ドル", EUR: "ユーロ", GBP: "ポンド", CNY: "人民元", KRW: "ウォン", TWD: "台湾ドル",
  HKD: "香港ドル", SGD: "シンガポールドル", THB: "バーツ", AUD: "豪ドル", CAD: "カナダドル", CHF: "スイスフラン",
};

/** 円, 米ドル, ユーロ in Japanese; the ISO code in English. */
export const currencyShort = (code, lang) => (lang === "ja" ? SHORT_JA[code] ?? code : code);

export function formatMoney(amount, currency, lang) {
  try {
    return new Intl.NumberFormat(locale(lang), { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toLocaleString(locale(lang))} ${currency}`;
  }
}

/** Decimal places the currency uses: 0 for JPY and KRW, 2 for most others. */
export function fractionDigits(currency) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

export function roundFor(amount, currency) {
  const f = 10 ** fractionDigits(currency);
  return Math.round(amount * f) / f;
}

export const sum = (items) => items.reduce((n, e) => n + e.amount, 0);
