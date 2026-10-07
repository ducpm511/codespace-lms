import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ScratchAccessService } from './scratch-access.service';
import type { PrismaService } from '../prisma/prisma.service';

type Row = {
  id: string;
  ownerId: string;
  visibility: 'private' | 'class' | 'school' | 'public';
  classId: string | null;
  deletedAt: Date | null;
  collaborators: { userId: string }[];
};

describe('ScratchAccessService', () => {
  let project: Row | null;
  let member: { status: string } | null;
  let service: ScratchAccessService;

  beforeEach(() => {
    project = { id: 'p1', ownerId: 'owner', visibility: 'private', classId: null, deletedAt: null, collaborators: [] };
    member = null;
    const prisma = {
      scratchProject: {
        // Mô phỏng `collaborators: { where: { userId } }` của query thật.
        findUnique: jest.fn().mockImplementation(({ select }) =>
          Promise.resolve(
            project && {
              ...project,
              collaborators: project.collaborators.filter((c) => c.userId === select.collaborators.where.userId),
            },
          ),
        ),
      },
      class: {
        findUnique: jest
          .fn()
          .mockImplementation(() => Promise.resolve({ createdById: 'teacher', members: member ? [member] : [] })),
      },
    };
    service = new ScratchAccessService(prisma as unknown as PrismaService);
  });

  it('chủ dự án đọc + sửa + là chủ', async () => {
    await expect(service.owned('p1', 'owner')).resolves.toMatchObject({ isOwner: true, canEdit: true });
  });

  it('không tồn tại → 404', async () => {
    project = null;
    await expect(service.readable('p1', 'owner')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('đã xóa mềm → 404 kể cả với chủ', async () => {
    project!.deletedAt = new Date();
    await expect(service.readable('p1', 'owner')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('private, người khác → 404 (không lộ là có tồn tại)', async () => {
    await expect(service.readable('p1', 'stranger')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('đồng tác giả sửa được nhưng không phải chủ → owned 403', async () => {
    project!.collaborators = [{ userId: 'collab' }];
    await expect(service.editable('p1', 'collab')).resolves.toMatchObject({ canEdit: true, isOwner: false });
    await expect(service.owned('p1', 'collab')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('class: thành viên đang học đọc được, sửa → 403', async () => {
    project!.visibility = 'class';
    project!.classId = 'c1';
    member = { status: 'active' };
    await expect(service.readable('p1', 'classmate')).resolves.toMatchObject({ canEdit: false });
    await expect(service.editable('p1', 'classmate')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('class: không thuộc lớp / thành viên đã rời → 404', async () => {
    project!.visibility = 'class';
    project!.classId = 'c1';
    await expect(service.readable('p1', 'outsider')).rejects.toBeInstanceOf(NotFoundException);
    member = { status: 'removed' };
    await expect(service.readable('p1', 'outsider')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('class: GV tạo lớp (không là thành viên) đọc được, không sửa được', async () => {
    project!.visibility = 'class';
    project!.classId = 'c1';
    await expect(service.readable('p1', 'teacher')).resolves.toMatchObject({ canEdit: false });
    await expect(service.editable('p1', 'teacher')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('class nhưng lớp đã bị xóa (classId NULL) → như private', async () => {
    project!.visibility = 'class';
    member = { status: 'active' };
    await expect(service.readable('p1', 'classmate')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('school: mọi tài khoản đọc được, không sửa được', async () => {
    project!.visibility = 'school';
    await expect(service.readable('p1', 'anyone')).resolves.toMatchObject({ canEdit: false });
    await expect(service.editable('p1', 'anyone')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
