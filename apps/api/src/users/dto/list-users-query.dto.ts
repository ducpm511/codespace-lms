import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { UserStatusValue } from '@lms/contracts';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/**
 * Query danh sách người dùng. Lọc/tìm kiếm chạy Ở SERVER: trước đây FE nạp cứng
 * `?page=1&pageSize=20` rồi lọc phía client — nghĩa là chỉ tìm được trong 20 người đầu.
 */
export class ListUsersQueryDto extends PaginationQueryDto {
  /** Khớp gần đúng, không phân biệt hoa thường, trên email HOẶC họ tên. */
  @IsOptional()
  @IsString()
  @MaxLength(320)
  search?: string;

  @IsOptional()
  @IsIn(['invited', 'active', 'suspended'])
  status?: UserStatusValue;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  roleKey?: string;
}
