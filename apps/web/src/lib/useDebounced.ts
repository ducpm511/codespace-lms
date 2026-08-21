import { useEffect, useState } from 'react';

/**
 * Giá trị trễ lại `delay` ms sau lần đổi cuối. Dùng cho ô tìm kiếm chạy ở server:
 * gõ 10 ký tự mà không debounce là 10 truy vấn Postgres — đúng thứ VPS 2 GB không cần.
 */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
