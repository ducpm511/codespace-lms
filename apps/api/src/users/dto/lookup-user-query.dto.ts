import { IsEmail, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class LookupUserQueryDto {
  /** Khớp CHÍNH XÁC (không tìm gần đúng) — hạn chế dò danh sách người dùng. */
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(320)
  email!: string;
}
