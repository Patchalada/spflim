const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parsePagination(query) {
  if (query.page === undefined && query.page_size === undefined) return null;

  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const requestedSize = Number.parseInt(query.page_size, 10) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requestedSize));

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize
  };
}

function respondWithPagination(req, res, rows, total, pagination) {
  if (!pagination) return res.json(rows);

  res.json({
    items: rows,
    pagination: {
      page: pagination.page,
      page_size: pagination.pageSize,
      total: Number(total),
      total_pages: Math.ceil(Number(total) / pagination.pageSize)
    }
  });
}

module.exports = { parsePagination, respondWithPagination };
