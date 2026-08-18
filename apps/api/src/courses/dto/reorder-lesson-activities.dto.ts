import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ReorderLessonActivitiesDto {
  /** ĐỦ id của mọi activity trong bài, theo thứ tự mong muốn. */
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  activityIds!: string[];
}
