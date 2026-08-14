import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RunnerService } from './runner.types';
import { PistonRunnerAdapter } from './piston-runner.adapter';
import { StubRunnerAdapter } from './stub-runner.adapter';

/**
 * Binds RunnerService to the adapter chosen by env CODE_RUNNER_PROVIDER:
 *   'piston' -> PistonRunnerAdapter (self-hosted isolated runner; requires CODE_RUNNER_URL)
 *   'stub'   -> StubRunnerAdapter   (dev/smoke only; does NOT execute code) [default]
 *
 * Default is 'stub' so a missing/misconfigured runner never silently runs code in-process.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: RunnerService,
      inject: [ConfigService],
      useFactory: (config: ConfigService): RunnerService => {
        const provider = (config.get<string>('CODE_RUNNER_PROVIDER') ?? 'stub').toLowerCase();
        if (provider === 'piston') {
          Logger.log('Runner provider: piston', 'RunnerModule');
          return new PistonRunnerAdapter(config);
        }
        Logger.warn(`Runner provider: stub (CODE_RUNNER_PROVIDER=${provider})`, 'RunnerModule');
        return new StubRunnerAdapter();
      },
    },
  ],
  exports: [RunnerService],
})
export class RunnerModule {}
