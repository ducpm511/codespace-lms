import { Navigate } from 'react-router-dom';
import { useMe } from '../features/auth/hooks';
import { primaryArea } from '../lib/roles';

/** Điều hướng về khu vực mặc định theo vai trò cao nhất. */
export function HomeRedirect(): JSX.Element | null {
  const { data } = useMe();
  if (!data) return null;
  return <Navigate to={`/${primaryArea(data.roles)}`} replace />;
}
