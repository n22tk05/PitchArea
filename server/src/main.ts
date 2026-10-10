import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// Tự động nạp file .env vào process.env
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'server/.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...rest] = trimmed.split('=');
        const k = key.trim();
        const v = rest.join('=').trim().replace(/^["']|["']$/g, '');
        if (k && !process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS cho client
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`[PitchArena NestJS Server] Đang lắng nghe trên cổng: http://localhost:${port}`);
}

bootstrap();
