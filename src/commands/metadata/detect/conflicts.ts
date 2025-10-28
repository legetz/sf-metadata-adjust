import { SfCommand, Flags } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('sf-metadata-adjust', 'metadata.detect.conflicts');

export type HelloWorldResult = {
  targetDir: string;
  time: string;
};

export default class Conflicts extends SfCommand<HelloWorldResult> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  public static readonly flags = {
    targetDir: Flags.string({
      char: 'd',
      summary: messages.getMessage('flags.target-dir.summary'),
      description: messages.getMessage('flags.target-dir.description'),
      default: '.',
    }),
  };

  public async run(): Promise<HelloWorldResult> {
    const { flags } = await this.parse(Conflicts);
    const time = new Date().toDateString();
    this.log(messages.getMessage('info.hello', [flags.targetDir, time]));
    return {
      targetDir: flags.targetDir,
      time,
    };
  }
}
