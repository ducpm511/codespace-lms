import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthPrincipal } from '../auth/auth.types';
import { NotificationsService } from './notifications.service';
import { GetNotificationsQueryDto } from './dto/get-notifications-query.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthPrincipal, @Query() query: GetNotificationsQueryDto) {
    return this.notificationsService.findForUser(user.userId, query);
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: AuthPrincipal) {
    return this.notificationsService.getUnreadCount(user.userId);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  markAsRead(@CurrentUser() user: AuthPrincipal, @Param('id') id: string) {
    return this.notificationsService.markAsRead(user.userId, id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  markAllAsRead(@CurrentUser() user: AuthPrincipal) {
    return this.notificationsService.markAllAsRead(user.userId);
  }
}
