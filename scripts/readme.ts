import { promises as fs } from 'node:fs';
import { MCPClient } from "mcp-client";
import type { RsbuildPlugin } from '@rsbuild/core';
import { logger } from '@rslib/core';
import { version } from '../package.json';

interface Options {
  readmePath: string;
}

const getPromptsContent = async () => {

  const client = new MCPClient({
    name: 'test-client',
    version: '0.0.0',
  });

  client.on("loggingMessage", (message) => {
    console.log(message);
  });

  await client.connect({
    type: "stdio",
    command: "node",
    args: ['.'],
  });

  const prompts = await client.getAllPrompts();
  console.log(prompts);
  await client.close();

  let result = '| Tool Name | Description |\n| --- | --- |\n';
  for (const prompt of prompts) {
    result += `| ${prompt.name} | ${prompt.description} |\n`;
  }

  return result;
};

const getUsageJSONContent = () => {
  const mcpServerConfig = {
    mcpServers: {
      'prompt-master': {
        command: 'npx',
        args: ['-y', `mcp-prompt-master@${version ?? 'latest'}`],
      },
    },
  };
  let result = '```json\n';
  result += JSON.stringify(mcpServerConfig, null, 2);
  result += '\n```';
  return result;
};

const getUsageBashContent = () => {
  let result = '```bash\n';
  result += `npx -y mcp-prompt-master@${version ?? 'latest'}`;
  result += '\n```';
  return result;
};

const createContentUpdater = (initialContent: string) => {
  let content = initialContent;

  return {
    update: async (markName: string, contentGenerator: () => string | Promise<string>): Promise<void> => {
      const markStart = `<!-- ${markName}-start -->`;
      const markEnd = `<!-- ${markName}-end -->`;
      const newContent = await contentGenerator();
      const regex = new RegExp(`(${markStart}\\n)([\\s\\S]*?)(\\n${markEnd})`, 'g');
      content = content.replace(regex, `$1${newContent}\n$3`);
    },
    getContent: () => content,
  };
};

export const readmePlugin = ({ readmePath }: Options): RsbuildPlugin => {
  return {
    name: 'readme-plugin',

    setup: (api) => {
      api.onAfterBuild(async ({ isWatch }) => {
        if (isWatch) {
          return;
        }

        try {
          logger.ready('Updating README.md file...');

          const readmeContent = await fs.readFile(readmePath, 'utf-8');

          const contentUpdater = createContentUpdater(readmeContent);

          await contentUpdater.update('prompts', getPromptsContent);
          await contentUpdater.update('usage-json', getUsageJSONContent);
          await contentUpdater.update('usage-bash', getUsageBashContent);
          await fs.writeFile(readmePath, contentUpdater.getContent());

          logger.success('README.md Updated');
        } catch (error) {
          logger.error('Fail to update README.md:', error);
        }
      });
    },
  };
};