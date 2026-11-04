import 'reflect-metadata';
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS } from '@lms/contracts';
import { ClassesController } from '../../classes/classes.controller';
import { ClassesService } from '../../classes/classes.service';
import { GradingController } from '../../grading/grading.controller';
import type { LessonActivitiesService } from '../../courses/lesson-activities.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { realRbac, type RealRbacScenario } from '../testing/real-rbac';
import { ClassStaffGuard } from './class-staff.guard';

const USER = 'gv-dang-goi';

function contextFor(handler: object, user: { userId: string } | undefined, params: object): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => ClassesController,
    switchToHttp: () => ({ getRequest: () => ({ user, params }) }),
  } as unknown as ExecutionContext;
}

function guardFor(scenario: RealRbacScenario): ClassStaffGuard {
  return new ClassStaffGuard(new Reflector(), realRbac(scenario));
}

const manageRoute = ClassesController.prototype.assignCourse;
const recomputeRoute = GradingController.prototype.recomputeClassGradebook;

describe('ClassStaffGuard (RbacService thật)', () => {
  const allowed: Array<[string, RealRbacScenario]> = [
    ['người tạo lớp', { role: 'instructor', createdById: USER }],
    ['GV là instructor active của lớp', { role: 'instructor', member: { status: 'active', roleInClass: 'instructor' } }],
    ['GV là TA active của lớp', { role: 'instructor', member: { status: 'active', roleInClass: 'ta' } }],
    ['role instructor gán riêng cho lớp', { scoped: { c1: 'instructor' } }],
    ['admin không ở trong lớp', { role: 'admin' }],
  ];
  it.each(allowed)('cho qua: %s', async (_name, scenario) => {
    await expect(
      guardFor(scenario).canActivate(contextFor(manageRoute, { userId: USER }, { classId: 'c1' })),
    ).resolves.toBe(true);
  });

  const denied: Array<[string, RealRbacScenario]> = [
    ['GV global không phụ trách lớp (lỗi gốc của C4)', { role: 'instructor' }],
    ['GV đã bị gỡ khỏi lớp', { role: 'instructor', member: { status: 'removed', roleInClass: 'instructor' } }],
    ['GV là học viên của lớp này', { role: 'instructor', member: { status: 'active', roleInClass: 'student' } }],
    ['GV mang role student gán riêng cho lớp này', { role: 'instructor', scoped: { c1: 'student' } }],
    ['role instructor gán cho lớp KHÁC', { scoped: { c2: 'instructor' } }],
    ['TA gán riêng cho lớp không có class.manage', { scoped: { c1: 'teaching_assistant' } }],
  ];
  it.each(denied)('403: %s', async (_name, scenario) => {
    await expect(
      guardFor(scenario).canActivate(contextFor(manageRoute, { userId: USER }, { classId: 'c1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('recompute: GV lớp khác 403, TA gán riêng cho lớp qua (đổi cùng quyền grade.read)', async () => {
    const ctx = contextFor(recomputeRoute, { userId: USER }, { classId: 'c1' });
    await expect(guardFor({ role: 'instructor' }).canActivate(ctx)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guardFor({ scoped: { c1: 'teaching_assistant' } }).canActivate(ctx)).resolves.toBe(true);
  });

  it('từ chối khi route khai thiếu :classId hoặc thiếu @RequirePermission, kể cả admin', async () => {
    const guard = guardFor({ role: 'admin' });
    await expect(guard.canActivate(contextFor(manageRoute, { userId: USER }, {}))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    const undeclared = (): void => undefined;
    await expect(
      guard.canActivate(contextFor(undeclared, { userId: USER }, { classId: 'c1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('401 khi chưa xác thực', async () => {
    await expect(
      guardFor({ role: 'admin' }).canActivate(contextFor(manageRoute, undefined, { classId: 'c1' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

/** Người dùng chốt 04/11: GV đọc được mọi lớp, chỉ ghi ở lớp phụ trách. Thêm route ghi mà quên guard thì đỏ ở đây. */
describe('Khai báo guard trên route cấp lớp', () => {
  const guardsOf = (handler: object): unknown[] => Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
  const classes = ClassesController.prototype;

  it.each([
    ['PATCH :classId', classes.update],
    ['POST :classId/courses', classes.assignCourse],
    ['DELETE :classId/courses/:courseId', classes.removeCourse],
    ['POST :classId/members', classes.enrollMember],
    ['DELETE :classId/members/:userId', classes.removeMember],
    ['PUT :classId/gates', classes.setGate],
    ['POST :classId/gradebook/recompute', recomputeRoute],
  ])('route ghi %s có ClassStaffGuard và khai quyền', (_name, handler) => {
    expect(guardsOf(handler)).toContain(ClassStaffGuard);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler)).toEqual(expect.any(Array));
  });

  it.each([
    ['GET :classId', classes.findOne],
    ['GET :classId/report', classes.getReport],
    ['GET :classId/gates', classes.listGates],
    ['GET :classId/gradebook', GradingController.prototype.getClassGradebook],
  ])('route đọc %s không chặn GV lớp khác', (_name, handler) => {
    expect(guardsOf(handler)).not.toContain(ClassStaffGuard);
  });
});

describe('ClassesService.getMyAccess', () => {
  function serviceFor(scenario: RealRbacScenario): ClassesService {
    const prisma = { class: { findUnique: async () => ({ id: 'c1' }) } };
    return new ClassesService(
      prisma as unknown as PrismaService,
      {} as LessonActivitiesService,
      undefined,
      realRbac(scenario),
    );
  }

  it('GV lớp khác: mọi thao tác ghi đều false', async () => {
    await expect(serviceFor({ role: 'instructor' }).getMyAccess('c1', USER)).resolves.toEqual({
      canManage: false,
      canRecomputeGradebook: false,
      canManageCertificates: false,
    });
  });

  it('người tạo lớp: mọi thao tác ghi đều true', async () => {
    await expect(
      serviceFor({ role: 'instructor', createdById: USER }).getMyAccess('c1', USER),
    ).resolves.toEqual({ canManage: true, canRecomputeGradebook: true, canManageCertificates: true });
  });

  it('TA gán riêng cho lớp: chỉ tổng hợp được sổ điểm', async () => {
    await expect(
      serviceFor({ scoped: { c1: 'teaching_assistant' } }).getMyAccess('c1', USER),
    ).resolves.toEqual({ canManage: false, canRecomputeGradebook: true, canManageCertificates: false });
  });

  it('quyền kiểm tra khớp đúng khóa cần cho route ghi', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, ClassesController.prototype.setGate)).toEqual([
      PERMISSIONS.CLASS_MANAGE,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, ClassesController.prototype.update)).toEqual([
      PERMISSIONS.CLASS_UPDATE,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, recomputeRoute)).toEqual([PERMISSIONS.GRADE_READ]);
  });
});
