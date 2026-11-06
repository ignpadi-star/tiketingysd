import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { gateway } from 'ai';

export default {
  // The Vercel AI Gateway serves the model id and reads AI_GATEWAY_API_KEY, or the OIDC token of a linked Vercel project.
  agents: {
    default: {
      model: gateway('openai/gpt-6-luna-fast'),
      system: 'You are a thorough QA agent. Verify every outcome.',
    },
  },
  targets: [{
    engine: web({
      // macOS 13 tidak didukung Playwright 1.64, jadi pakai Chrome sistem via CDP.
      // Jalankan Chrome dengan: --headless=new --remote-debugging-port=9222
      connect: {
        cdpEndpoint: () => process.env.CHROME_CDP ?? 'http://127.0.0.1:9222',
      },
    }),
    app: {
      url: process.env.APP_URL ?? 'http://localhost:8500',
      // Or let the runner start the dev server:
      // command: { executable: 'python3', args: ['dev_server.py'] },
    },
  }],
} satisfies E2EConfig;
