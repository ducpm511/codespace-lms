import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { PERMISSIONS, type AuthUser, type CertificateDto, type CertificateTemplateDto } from '@lms/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { CertificatesService } from './certificates.service';
import { IssueCertificateDto } from './dto/issue-certificate.dto';
import { RevokeCertificateDto } from './dto/revoke-certificate.dto';
import { CreateCertificateTemplateDto } from './dto/create-template.dto';

@Controller('certificates')
export class CertificatesController {
  constructor(private readonly certificatesService: CertificatesService) {}

  @Post('issue')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.CERTIFICATE_ISSUE)
  issue(
    @Body() dto: IssueCertificateDto,
    @CurrentUser() currentUser: AuthUser,
  ): Promise<CertificateDto> {
    return this.certificatesService.issue(dto, currentUser);
  }

  @Post(':id/revoke')
  @UseGuards(JwtAuthGuard)
  revoke(
    @Param('id') id: string,
    @Body() dto: RevokeCertificateDto,
    @CurrentUser() currentUser: AuthUser,
  ): Promise<CertificateDto> {
    return this.certificatesService.revoke(id, dto, currentUser);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() currentUser: AuthUser): Promise<CertificateDto[]> {
    return this.certificatesService.listMine(currentUser);
  }

  @Get('class/:classId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.CERTIFICATE_READ)
  listForClass(
    @Param('classId') classId: string,
    @CurrentUser() currentUser: AuthUser,
  ): Promise<CertificateDto[]> {
    return this.certificatesService.listForClass(classId, currentUser);
  }

  @Get('templates')
  @UseGuards(JwtAuthGuard)
  listTemplates(): Promise<CertificateTemplateDto[]> {
    return this.certificatesService.listTemplates();
  }

  @Post('templates')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.CERTIFICATE_ISSUE)
  createTemplate(@Body() dto: CreateCertificateTemplateDto): Promise<CertificateTemplateDto> {
    return this.certificatesService.createTemplate(dto);
  }
}
