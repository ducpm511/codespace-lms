// Hợp đồng Notification dùng chung FE <-> BE. Nguồn: docs/DESIGN.md §4.8.

export interface NotificationDto {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  payloadJson?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt: string;
}

export interface UnreadNotificationCountDto {
  unreadCount: number;
}

export interface MarkNotificationReadRequest {
  notificationIds?: string[];
}
