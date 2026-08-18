import { Module, Global } from '@nestjs/common';
import { STORAGE_ADAPTER } from './storage.interface';
import { LocalStorageAdapter } from './local-storage.adapter';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_ADAPTER,
      useClass: LocalStorageAdapter,
    },
    LocalStorageAdapter,
  ],
  exports: [STORAGE_ADAPTER, LocalStorageAdapter],
})
export class StorageModule {}
