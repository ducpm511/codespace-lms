import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { ScratchCollaboratorCandidateDto, ScratchCollaboratorDto } from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedRequest, AuthPrincipal } from '../auth/auth.types';
import { ScratchCollaboratorsService } from './scratch-collaborators.service';
import { AddCollaboratorDto, CollaboratorSearchDto } from './dto/collaborators.dto';

/** Đồng tác giả BlockSpace (T11.6b): tìm người, mời, gỡ / tự rời. */
@Controller('scratch/projects/:id/collaborators')
@UseGuards(JwtAuthGuard)
export class ScratchCollaboratorsController {
  constructor(private readonly collaborators: ScratchCollaboratorsService) {}

  @Get('candidates')
  candidates(
    @Param('id') id: string,
    @Query() q: CollaboratorSearchDto,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<ScratchCollaboratorCandidateDto[]> {
    return this.collaborators.candidates(id, q.q, user.userId);
  }

  @Post()
  add(
    @Param('id') id: string,
    @Body() dto: AddCollaboratorDto,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: AuthenticatedRequest,
  ): Promise<ScratchCollaboratorDto[]> {
    return this.collaborators.add(id, dto.userId, { userId: user.userId, ip: req.ip });
  }

  @Delete(':userId')
  remove(
    @Param('id') id: string,
    @Param('userId') memberId: string,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: AuthenticatedRequest,
  ): Promise<ScratchCollaboratorDto[]> {
    return this.collaborators.remove(id, memberId, { userId: user.userId, ip: req.ip });
  }
}
