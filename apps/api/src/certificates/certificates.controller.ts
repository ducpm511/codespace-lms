import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { PERMISSIONS, type CertificateDto, type CertificateTemplateDto } from '@lms/contracts';
import { contentDisposition } from '../common/http/content-disposition';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
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
    @CurrentUser() currentUser: AuthPrincipal,
  ): Promise<CertificateDto> {
    return this.certificatesService.issue(dto, currentUser);
  }

  @Post(':id/revoke')
  @UseGuards(JwtAuthGuard)
  revoke(
    @Param('id') id: string,
    @Body() dto: RevokeCertificateDto,
    @CurrentUser() currentUser: AuthPrincipal,
  ): Promise<CertificateDto> {
    return this.certificatesService.revoke(id, dto, currentUser);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() currentUser: AuthPrincipal): Promise<CertificateDto[]> {
    return this.certificatesService.listMine(currentUser);
  }

  @Get('class/:classId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.CERTIFICATE_READ)
  listForClass(
    @Param('classId') classId: string,
    @CurrentUser() currentUser: AuthPrincipal,
  ): Promise<CertificateDto[]> {
    return this.certificatesService.listForClass(classId, currentUser);
  }

  @Get('templates')
  @UseGuards(JwtAuthGuard)
  listTemplates(): Promise<CertificateTemplateDto[]> {
    return this.certificatesService.listTemplates();
  }

  @Get(':id/pdf')
  @UseGuards(JwtAuthGuard)
  async downloadPdf(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthPrincipal,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, fileName } = await this.certificatesService.getPdfBuffer(id, currentUser);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', contentDisposition('attachment', fileName));
    res.send(buffer);
  }

  @Post('templates')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission(PERMISSIONS.CERTIFICATE_TEMPLATE_MANAGE)
  createTemplate(@Body() dto: CreateCertificateTemplateDto): Promise<CertificateTemplateDto> {
    return this.certificatesService.createTemplate(dto);
  }
}
