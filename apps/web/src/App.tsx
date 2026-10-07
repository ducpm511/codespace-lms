import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { RequireAuth } from './routes/RequireAuth';
import { RequireRoles } from './routes/RequireRoles';
import { HomeRedirect } from './routes/HomeRedirect';
import { LoginPage } from './pages/LoginPage';
import { AdminHome } from './pages/AdminHome';
import { TeachHome } from './pages/TeachHome';
import { LearnHome } from './pages/LearnHome';
import { StudioEditorPage } from './pages/studio/StudioEditorPage';
import { StudioHome } from './pages/studio/StudioHome';
import { StudioProjectPage } from './pages/studio/StudioProjectPage';
import { StudioModerationPage } from './pages/studio/StudioModerationPage';
import { PublicProjectPage } from './pages/studio/PublicProjectPage';
import { VerifyCertificate } from './pages/VerifyCertificate';
import { AREA_ROLES } from './lib/roles';

export function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify/:code" element={<VerifyCertificate />} />
      {/* Dự án BlockSpace công khai — KHÔNG cần đăng nhập (ADR 003 D4′). */}
      <Route path="/p/:slug" element={<PublicProjectPage />} />

      <Route element={<RequireAuth />}>
        {/* Trình soạn BlockSpace chiếm TOÀN màn hình — nằm ngoài AppLayout (khung max-w-6xl làm vùng lập
            trình quá hẹp). Danh sách + trang xem dự án nằm trong AppLayout bên dưới. */}
        <Route path="studio/:id/edit" element={<StudioEditorPage />} />
        <Route element={<AppLayout />}>
          <Route index element={<HomeRedirect />} />
          <Route
            path="admin"
            element={
              <RequireRoles roles={AREA_ROLES.admin}>
                <AdminHome />
              </RequireRoles>
            }
          />
          <Route
            path="teach"
            element={
              <RequireRoles roles={AREA_ROLES.teach}>
                <TeachHome />
              </RequireRoles>
            }
          />
          {/* Learn mở cho mọi user đã đăng nhập — nội dung chặn theo membership lớp ở backend. */}
          <Route path="learn" element={<LearnHome />} />
          {/* BlockSpace mở cho mọi user — quyền từng dự án kiểm ở backend (ScratchAccessService). */}
          <Route path="studio" element={<StudioHome />} />
          {/* Ai vào cũng được; hàng chờ chỉ có học viên mình dạy (backend lọc), HV thấy rỗng. */}
          <Route path="studio/moderation" element={<StudioModerationPage />} />
          <Route path="studio/:id" element={<StudioProjectPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
