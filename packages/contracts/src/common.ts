// Kiểu dùng chung nhiều domain.

/** Kết quả phân trang thống nhất (sk-api-response-rules). */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
