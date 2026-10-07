import { Module } from '@nestjs/common';
import { ScratchAccessService } from './scratch-access.service';
import { ScratchAssetsController } from './scratch-assets.controller';
import { ScratchAssetsService } from './scratch-assets.service';
import { ScratchProjectsController } from './scratch-projects.controller';
import { ScratchProjectsService } from './scratch-projects.service';
import { ScratchSharingController } from './scratch-sharing.controller';
import { ScratchSharingService } from './scratch-sharing.service';
import { ScratchModeratorsService } from './scratch-moderators.service';
import { ScratchModerationService } from './scratch-moderation.service';
import { ScratchPublishingService } from './scratch-publishing.service';
import {
  ScratchModerationController,
  ScratchPublicController,
  ScratchPublishingController,
} from './scratch-publishing.controller';

/** BlockSpace (P11) — dự án Scratch, phiên bản, asset, chia sẻ, công khai. docs/adr/003-scratch-studio.md. */
@Module({
  controllers: [
    ScratchProjectsController,
    ScratchAssetsController,
    ScratchSharingController,
    ScratchPublishingController,
    ScratchPublicController,
    ScratchModerationController,
  ],
  providers: [
    ScratchAccessService,
    ScratchProjectsService,
    ScratchAssetsService,
    ScratchSharingService,
    ScratchModeratorsService,
    ScratchPublishingService,
    ScratchModerationService,
  ],
  exports: [ScratchAccessService],
})
export class ScratchModule {}
