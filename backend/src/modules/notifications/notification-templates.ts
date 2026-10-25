import type { NotificationEvent } from '~/modules/settings/settings.types';
import type { Locale } from '~/shared/locale/locales';

export type TemplateLocale = Locale;
export type TemplateChannel = 'inApp' | 'email';

export interface TemplateText {
  subject: string;
  body: string;
}

/**
 * The code defaults for each notification (PRD 6.13), in every language
 * of `LOCALES`. Variables are `{name}`; a school overrides any of them per
 * channel and language in `notification_templates`.
 */
export const DEFAULT_TEMPLATES: Record<
  NotificationEvent,
  Record<TemplateLocale, TemplateText>
> = {
  absent: {
    en: {
      subject: '{student_name} was absent today',
      body: '{student_name} ({class_name}) was marked absent on {date}.',
    },
    bn: {
      subject: '{student_name} আজ অনুপস্থিত',
      body: '{student_name} ({class_name}) {date} তারিখে অনুপস্থিত ছিল।',
    },
    hi: {
      subject: '{student_name} आज अनुपस्थित रहे',
      body: '{student_name} ({class_name}) को {date} को अनुपस्थित दर्ज किया गया।',
    },
  },
  feeDue: {
    en: {
      subject: 'Fees due for {student_name}',
      body: 'Invoice {invoice_number} for {student_name} has {amount} due since {due_date}.',
    },
    bn: {
      subject: '{student_name}-এর বকেয়া ফি',
      body: '{student_name}-এর ইনভয়েস {invoice_number}-এ {due_date} থেকে {amount} বকেয়া আছে।',
    },
    hi: {
      subject: '{student_name} की फ़ीस बकाया है',
      body: '{student_name} के इनवॉइस {invoice_number} पर {due_date} से {amount} बकाया है।',
    },
  },
  paymentReceived: {
    en: {
      subject: 'Payment received: {amount}',
      body: 'We received {amount} (receipt {receipt_number}) for {student_name}. Thank you.',
    },
    bn: {
      subject: 'পেমেন্ট পাওয়া গেছে: {amount}',
      body: '{student_name}-এর জন্য {amount} পাওয়া গেছে (রসিদ {receipt_number})। ধন্যবাদ।',
    },
    hi: {
      subject: 'भुगतान प्राप्त हुआ: {amount}',
      body: '{student_name} के लिए {amount} प्राप्त हुए (रसीद {receipt_number})। धन्यवाद।',
    },
  },
  resultPublished: {
    en: {
      subject: '{result_name} results are out',
      body: "{student_name}'s {result_name} result has been published.",
    },
    bn: {
      subject: '{result_name}-এর ফলাফল প্রকাশিত হয়েছে',
      body: '{student_name}-এর {result_name}-এর ফলাফল প্রকাশিত হয়েছে।',
    },
    hi: {
      subject: '{result_name} का परिणाम घोषित हो गया है',
      body: '{student_name} का {result_name} परिणाम प्रकाशित कर दिया गया है।',
    },
  },
  noticePublished: {
    en: { subject: 'Notice: {title}', body: '{summary}' },
    bn: { subject: 'নোটিশ: {title}', body: '{summary}' },
    hi: { subject: 'सूचना: {title}', body: '{summary}' },
  },
};

/** Replaces `{name}` with `vars.name` (unknown names stay as written). */
export function render(
  text: string,
  vars: Record<string, string | number>,
): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}
