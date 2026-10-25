import { type ExecutionContext, Module } from '@nestjs/common';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
} from 'nestjs-i18n';
import { join } from 'path';
import { DEFAULT_LOCALE, LOCALE_HEADER, isLocale } from './locales';

/**
 * nestjs-i18n's `HeaderResolver` takes any header value as the language;
 * this one keeps only a supported locale, so `x-locale: fr` falls through
 * to `Accept-Language` instead of picking a language nobody translated.
 */
export class LocaleHeaderResolver extends HeaderResolver {
  constructor() {
    super([LOCALE_HEADER]);
  }

  override async resolve(
    context: ExecutionContext,
  ): Promise<string | undefined> {
    const value = await super.resolve(context);
    const lang = (Array.isArray(value) ? value[0] : value)
      ?.trim()
      .toLowerCase();
    return isLocale(lang) ? lang : undefined;
  }
}

/**
 * Translations (nestjs-i18n). The files are `src/i18n/<locale>/<ns>.json`,
 * read as `<ns>.<key>` (e.g. `mail.passwordReset.subject`), with `{name}`
 * placeholders. A request's language is the frontend's explicit choice
 * (`x-locale`, from web-2's `locale` cookie), else `Accept-Language`
 * (`hi-IN` → `hi`), else English: `I18nContext.current()?.lang`. Jobs have
 * no request, so code running there passes the language itself. Global, so
 * `I18nService` can be injected anywhere.
 */
@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: DEFAULT_LOCALE,
      loaderOptions: {
        // src/shared/locale → src/i18n (dist/i18n once built).
        path: join(__dirname, '..', '..', 'i18n'),
        watch: false,
      },
      resolvers: [new LocaleHeaderResolver(), AcceptLanguageResolver],
    }),
  ],
})
export class AppI18nModule {}
