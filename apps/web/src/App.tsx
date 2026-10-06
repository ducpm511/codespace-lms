import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { RequireAuth } from './routes/RequireAuth';
import { RequireRoles } from './routes/RequireRoles';
import { HomeRedirect } from './routes/HomeRedirect';
import { LoginPage } from './pages/LoginPage';
import { AdminHome } from './pages/AdminHome';
import { TeachHome } from './pages/TeachHome';
import { LearnHome } from './pages/LearnHome';
import { StudioPage } from './pages/StudioPage';
import { VerifyCertificate } from './pages/VerifyCertificate';
import { AREA_ROLES } from './lib/roles';

export function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify/:code" element={<VerifyCertificate />} />

      <Route element={<RequireAuth />}>
        {/* BlockSpace chiếm TOÀN màn hình — nằm ngoài AppLayout (khung max-w-6xl làm vùng lập trình quá hẹp).
            SPIKE T11.1, chưa gắn vào menu. */}
        <Route path="studio" element={<StudioPage />} />
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
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
