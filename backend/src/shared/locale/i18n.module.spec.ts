import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { I18nContext } from 'nestjs-i18n';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppI18nModule } from './i18n.module';

@Controller('lang')
class LangController {
  @Get()
  lang() {
    return { lang: I18nContext.current()?.lang ?? null };
  }
}

describe('AppI18nModule', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppI18nModule],
      controllers: [LangController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  const langOf = async (headers: Record<string, string>) =>
    (await request(app.getHttpServer()).get('/lang').set(headers)).body as {
      lang: string | null;
    };

  it("prefers the frontend's x-locale over Accept-Language", async () => {
    await expect(
      langOf({ 'x-locale': 'hi', 'accept-language': 'bn-BD,bn;q=0.9' }),
    ).resolves.toEqual({ lang: 'hi' });
  });

  it('maps a regional Accept-Language to a supported language', async () => {
    await expect(
      langOf({ 'accept-language': 'fr-FR,hi-IN;q=0.8' }),
    ).resolves.toEqual({ lang: 'hi' });
  });

  it('skips an unsupported x-locale for Accept-Language', async () => {
    await expect(
      langOf({ 'x-locale': 'fr', 'accept-language': 'bn' }),
    ).resolves.toEqual({ lang: 'bn' });
  });

  it('falls back to English', async () => {
    await expect(langOf({ 'x-locale': 'fr' })).resolves.toEqual({
      lang: 'en',
    });
  });
});
