 import { defineConfig, devices } from '@playwright/test';
    
    export default defineConfig({
      testDir: './test',
      timeout: 30000,
      fullyParallel: true,
      retries: 0,
      reporter: 'html',
      use: {
        baseURL: 'http://localhost:3000', // Địa chỉ Vite Client
        trace: 'on-first-retry',
        // Cấp quyền microphone tự động cho browser để test mic/speech
        permissions: ['microphone'],
      },
      projects: [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
      ],
      // Tự động khởi chạy web server trước khi test nếu chưa bật
        //   webServer: [
        //     {
        //       command: 'npm run dev:server',
        //       url: 'http://localhost:4000',
        //       reuseExistingServer: true,
        //     },
        //     {
        //       command: 'npm run dev:client',
        //       url: 'http://localhost:3000',
        //       reuseExistingServer: true,
        //     },
        //   ],
    });