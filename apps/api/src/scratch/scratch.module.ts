import { Module } from '@nestjs/common';
import { ScratchAccessService } from './scratch-access.service';
import { ScratchAssetsController } from './scratch-assets.controller';
import { ScratchAssetsService } from './scratch-assets.service';
import { ScratchProjectsController } from './scratch-projects.controller';
import { ScratchProjectsService } from './scratch-projects.service';

/** BlockSpace (P11) — dự án Scratch, phiên bản, asset. docs/adr/003-scratch-studio.md. */
@Module({
  controllers: [ScratchProjectsController, ScratchAssetsController],
  providers: [ScratchAccessService, ScratchProjectsService, ScratchAssetsService],
  exports: [ScratchAccessService],
})
export class ScratchModule {}
