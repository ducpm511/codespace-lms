// Ánh xạ vai trò → khu vực UI. Nguồn vai trò: docs/DESIGN.md §2.
export type Area = 'admin' | 'teach' | 'learn';

export const AREA_ROLES: Record<Area, string[]> = {
  admin: ['super_admin', 'admin'],
  teach: ['instructor', 'teaching_assistant'],
  learn: ['student', 'instructor', 'teaching_assistant', 'admin', 'super_admin'],
};

/** Khu vực mặc định khi đăng nhập, theo vai trò cao nhất. */
export function primaryArea(roles: string[]): Area {
  if (roles.some((r) => AREA_ROLES.admin.includes(r))) return 'admin';
  if (roles.some((r) => AREA_ROLES.teach.includes(r))) return 'teach';
  return 'learn';
}

/**
 * Các khu vực user được phép vào (để dựng nav).
 * `learn` luôn khả dụng cho mọi user đã đăng nhập: nội dung Learn chặn theo membership lớp ở backend,
 * nên học viên được enroll mà chưa có global role `student` vẫn vào học được.
 */
export function allowedAreas(roles: string[]): Area[] {
  const areas = (Object.keys(AREA_ROLES) as Area[]).filter((area) =>
    roles.some((r) => AREA_ROLES[area].includes(r)),
  );
  if (!areas.includes('learn')) {
    areas.push('learn');
  }
  return areas;
}
