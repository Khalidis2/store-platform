export const STOREFRONT_PAGE_SIZE = 24;

export type StorefrontSort = "newest" | "price-asc" | "price-desc";

export function parseStorefrontSort(value: string | undefined): StorefrontSort {
  if (value === "price-asc" || value === "price-desc") return value;
  return "newest";
}

export function parseStorefrontPage(value: string | undefined) {
  const page = Number.parseInt(value ?? "", 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function getStorefrontSortSql(sort: StorefrontSort) {
  if (sort === "price-asc") return "price_cents asc, created_at desc";
  if (sort === "price-desc") return "price_cents desc, created_at desc";
  return "created_at desc";
}

export function storefrontPageHref(options: {
  q: string;
  category: string;
  sort: StorefrontSort;
  page: number;
}) {
  const params = new URLSearchParams();
  if (options.q) params.set("q", options.q);
  if (options.category) params.set("category", options.category);
  if (options.sort !== "newest") params.set("sort", options.sort);
  if (options.page > 1) params.set("page", String(options.page));

  const query = params.toString();
  return query ? `/?${query}` : "/";
}
