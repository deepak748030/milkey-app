// Ponytail reusable pagination helper - single source for all routes
function parsePaging(query, defaults = { page: 1, limit: 10, maxLimit: 50 }) {
  let page = Math.max(1, parseInt(query.page, 10) || defaults.page);
  let limit = Math.min(defaults.maxLimit, Math.max(1, parseInt(query.limit, 10) || defaults.limit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
function pagingResult({ items, total, page, limit }) {
  return { items, total, page, limit, pages: Math.ceil(total / limit), hasMore: page * limit < total };
}
module.exports = { parsePaging, pagingResult };
