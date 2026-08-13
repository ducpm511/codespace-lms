import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import type { RbacService, EffectivePermissions } from '../rbac.service';

function ctxWith(request: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function makeGuard(required: string[] | undefined, eff: EffectivePermissions) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(required) } as unknown as Reflector;
  const rbac = {
    getEffectivePermissions: jest.fn().mockResolvedValue(eff),
    hasPermission: (e: EffectivePermissions, key: string, classId?: string) =>
      e.global.has(key) || (classId ? (e.byClass.get(classId)?.has(key) ?? false) : false),
  } as unknown as RbacService;
  return new PermissionsGuard(reflector, rbac);
}

const emptyEff: EffectivePermissions = { global: new Set(), byClass: new Map() };

describe('PermissionsGuard', () => {
  it('cho qua khi route không yêu cầu permission', async () => {
    const guard = makeGuard(undefined, emptyEff);
    await expect(guard.canActivate(ctxWith({ user: { userId: 'u1' } }))).resolves.toBe(true);
  });

  it('401 khi chưa xác thực (không có req.user)', async () => {
    const guard = makeGuard(['course.create'], emptyEff);
    await expect(guard.canActivate(ctxWith({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('cho qua khi có quyền global', async () => {
    const eff: EffectivePermissions = { global: new Set(['course.create']), byClass: new Map() };
    const guard = makeGuard(['course.create'], eff);
    await expect(guard.canActivate(ctxWith({ user: { userId: 'u1' }, params: {} }))).resolves.toBe(true);
  });

  it('cho qua khi có quyền theo lớp và classId khớp (từ params)', async () => {
    const eff: EffectivePermissions = { global: new Set(), byClass: new Map([['c1', new Set(['grade.write'])]]) };
    const guard = makeGuard(['grade.write'], eff);
    const req = { user: { userId: 'u1' }, params: { classId: 'c1' } };
    await expect(guard.canActivate(ctxWith(req))).resolves.toBe(true);
  });

  it('403 khi có quyền theo lớp nhưng classId không khớp', async () => {
    const eff: EffectivePermissions = { global: new Set(), byClass: new Map([['c1', new Set(['grade.write'])]]) };
    const guard = makeGuard(['grade.write'], eff);
    const req = { user: { userId: 'u1' }, params: { classId: 'c2' } };
    await expect(guard.canActivate(ctxWith(req))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('403 khi thiếu quyền', async () => {
    const guard = makeGuard(['user.delete'], emptyEff);
    await expect(
      guard.canActivate(ctxWith({ user: { userId: 'u1' }, params: {} })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
