import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { Args } from '@oclif/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf-metadata-adjust', 'metadata.detect.git.conflicts');

export type HelloWorldResult = {
  targetDir: string;
  time: string;
};

export default class DetectGitConflicts extends SfCommand<HelloWorldResult> {
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly args = {
      path: Args.string({
        description: messages.getMessage('args.path.description'),
        required: false,
      }),
    };

  public static readonly flags = {
    targetDir: Flags.string({
      char: 'd',
      description: messages.getMessage('flags.target-dir.description'),
      default: '.',
    }),
  };

  public async run(): Promise<HelloWorldResult> {
    const { args, flags } = await this.parse(DetectGitConflicts);
    
    // Priority: path argument > targetDir flag > current directory
    const targetDir = args.path || flags.targetDir || process.cwd();

    const time = new Date().toDateString();
    this.log(messages.getMessage('info.hello', [targetDir, time]));
    return {
      targetDir: targetDir,
      time,
    };
  }
}
