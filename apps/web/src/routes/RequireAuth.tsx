import { Navigate, Outlet } from 'react-router-dom';
import { useMe } from '../features/auth/hooks';
import { FullscreenSpinner } from '../components/Spinner';

/** Chặn route cần đăng nhập. Chưa auth (hoặc refresh thất bại) → về /login. */
export function RequireAuth(): JSX.Element {
  const { data, isLoading, isError } = useMe();
  if (isLoading) return <FullscreenSpinner />;
  if (isError || !data) return <Navigate to="/login" replace />;
  return <Outlet />;
}
