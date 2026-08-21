import { Module, Global, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { STORAGE_ADAPTER, type StorageAdapter } from './storage.interface';
import { LocalStorageAdapter } from './local-storage.adapter';
import { CloudinaryStorageAdapter } from './cloudinary-storage.adapter';

/**
 * Chọn nơi chứa file theo env `STORAGE_DRIVER`:
 *   'local'      -> ./uploads (mặc định, dùng cho dev)
 *   'cloudinary' -> Cloudinary raw + authenticated (xem cloudinary-storage.adapter.ts §A)
 *
 * Credential Cloudinary đã được env schema bắt buộc khi driver = cloudinary, nên tới đây
 * chúng chắc chắn có mặt (xem config/env.validation.ts).
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    LocalStorageAdapter,
    {
      provide: STORAGE_ADAPTER,
      inject: [ConfigService, LocalStorageAdapter],
      useFactory: (config: ConfigService, local: LocalStorageAdapter): StorageAdapter => {
        const driver = (config.get<string>('STORAGE_DRIVER') ?? 'local').toLowerCase();
        if (driver !== 'cloudinary') {
          Logger.log('Storage driver: local (./uploads)', 'StorageModule');
          return local;
        }
        cloudinary.config({
          cloud_name: config.getOrThrow<string>('CLOUDINARY_CLOUD_NAME'),
          api_key: config.getOrThrow<string>('CLOUDINARY_API_KEY'),
          api_secret: config.getOrThrow<string>('CLOUDINARY_API_SECRET'),
          secure: true,
        });
        Logger.log('Storage driver: cloudinary (raw + authenticated)', 'StorageModule');
        return new CloudinaryStorageAdapter(cloudinary as never);
      },
    },
  ],
  exports: [STORAGE_ADAPTER, LocalStorageAdapter],
})
export class StorageModule {}
