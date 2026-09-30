// Генератор писем Supabase Auth: один макет → все шаблоны + templates.json для workflow.
// Запуск: node supabase/templates/build.mjs. HTML-файлы рядом — результат, правьте тексты здесь.
// Вёрстка таблицами и инлайн-стилями — так письмо одинаково выглядит в Gmail, Яндексе, Mail.ru и Outlook.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const SITE = "https://podokonnikapp.ru";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";

const button = (href, label) => `
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td align="center" style="padding:12px 0 24px;">
                            <a href="${href}" target="_blank" style="display:inline-block; background-color:#2e7d4f; color:#ffffff; font-size:17px; font-weight:600; text-decoration:none; padding:16px 36px; border-radius:14px;">
                              ${label}
                            </a>
                          </td>
                        </tr>
                      </table>`;

const box = (html) => `
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#fafaf7; border-radius:16px;">
                        <tr>
                          <td style="padding:20px; font-size:15px; line-height:1.6; color:#1c1c1e;">
                            ${html}
                          </td>
                        </tr>
                      </table>`;

const code = (token) => `
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td align="center" style="padding:8px 0 24px;">
                            <div style="display:inline-block; background-color:#fafaf7; border:1px solid #e5e5e0; border-radius:14px; padding:16px 28px; font-family:'SFMono-Regular',Menlo,Consolas,monospace; font-size:32px; font-weight:700; letter-spacing:8px; color:#1c1c1e;">
                              ${token}
                            </div>
                          </td>
                        </tr>
                      </table>`;

const fallbackLink = `
                      <p style="margin:24px 0 0; font-size:13px; line-height:1.5; color:#6e6e73;">
                        Кнопка не нажимается? Скопируйте ссылку в браузер:<br />
                        <a href="{{ .ConfirmationURL }}" style="color:#2e7d4f; word-break:break-all;">{{ .ConfirmationURL }}</a>
                      </p>`;

const para = (html) => `
                      <p style="margin:0 0 16px; font-size:17px; line-height:1.5;">
                        ${html}
                      </p>`;

const FEATURES = box(`<b>Что вас ждёт:</b><br />
                            💧 Напоминания о поливе и подкормке<br />
                            📖 Советы по уходу для 268 видов растений<br />
                            🩺 Помощь, если растение заболело<br />
                            👋 Сообщество садоводов и конкурсы`);

const NOT_YOU_SECURITY = box(
  `⚠️ Если это были не вы — сразу смените пароль: на странице входа нажмите «Забыли пароль?». Если войти не получается — напишите нам в ответ на это письмо.`,
);

function layout({ title, preheader, emoji, heading, body, footer }) {
  return `<!doctype html>
<!--
  Письмо «${title}» для Supabase Auth. Сгенерировано supabase/templates/build.mjs — правьте там.
  Ставится в Supabase автоматически (.github/workflows/supabase-email-templates.yml).
-->
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${title} — Подоконник</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f1f1ec;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
      ${preheader}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f1ec;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
            <tr>
              <td align="center" style="padding-bottom:20px;">
                <img src="${SITE}/icon-192.png" width="64" height="64" alt="Подоконник" style="display:block; border:0; border-radius:16px;" />
              </td>
            </tr>
            <tr>
              <td style="background-color:#ffffff; border-radius:24px; overflow:hidden;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="background-color:#2e7d4f; background-image:linear-gradient(135deg,#2e7d4f,#12a3a3); padding:36px 32px; text-align:center; border-radius:24px 24px 0 0;">
                      <div style="font-size:44px; line-height:1;">${emoji}</div>
                      <h1 style="margin:16px 0 0; font-family:${FONT}; font-size:26px; line-height:1.25; font-weight:700; color:#ffffff;">
                        ${heading}
                      </h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:32px; font-family:${FONT}; color:#1c1c1e;">${body}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 16px 0; font-family:${FONT}; font-size:13px; line-height:1.5; color:#6e6e73;">
                ${footer}<br /><br />
                <a href="${SITE}" style="color:#2e7d4f; text-decoration:none;">podokonnikapp.ru</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

/**
 * key — имя шаблона в Supabase: mailer_subjects_<key> и mailer_templates_<key>_content.
 * group: "core" — основные письма; "notify" — уведомления безопасности (их включают в
 * Authentication → Emails → Security, здесь меняется только текст).
 */
const TEMPLATES = [
  {
    key: "confirmation",
    file: "confirm-signup.html",
    group: "core",
    subject: "Подтвердите почту — Подоконник",
    title: "Подтвердите почту",
    preheader: "Остался один шаг — подтвердите почту, и ваш сад на подоконнике готов.",
    emoji: "🌱",
    heading: "Добро пожаловать в&nbsp;«Подоконник»!",
    body:
      para("Остался один шаг — подтвердите, что это ваша почта. После этого вы сразу окажетесь в&nbsp;своём саду.") +
      button("{{ .ConfirmationURL }}", "Подтвердить почту") +
      FEATURES +
      fallbackLink,
    footer:
      "Вы получили это письмо, потому что кто-то указал {{ .Email }} при регистрации в&nbsp;«Подоконнике».<br />\n                Если это были не вы — просто удалите письмо.",
  },
  {
    key: "recovery",
    file: "reset-password.html",
    group: "core",
    subject: "Восстановление пароля — Подоконник",
    title: "Восстановление пароля",
    preheader: "Ссылка для нового пароля — ваш сад ждёт вас.",
    emoji: "🔑",
    heading: "Восстановление пароля",
    body:
      para(
        "Мы получили просьбу сбросить пароль к&nbsp;вашему аккаунту в&nbsp;«Подоконнике». Нажмите на кнопку — и задайте новый пароль. Все ваши растения, записи и подписки останутся на месте.",
      ) +
      button("{{ .ConfirmationURL }}", "Задать новый пароль") +
      box("🔒 Ссылка одноразовая и&nbsp;действует ограниченное время. Если она устарела — запросите новую на&nbsp;странице входа: «Забыли пароль?».") +
      fallbackLink,
    footer:
      "Вы получили это письмо, потому что для {{ .Email }} запросили сброс пароля в&nbsp;«Подоконнике».<br />\n                Если это были не вы — просто удалите письмо, пароль останется прежним.",
  },
  {
    key: "magic_link",
    file: "magic-link.html",
    group: "core",
    subject: "Вход в «Подоконник»",
    title: "Вход по ссылке",
    preheader: "Ссылка для входа — пароль не нужен.",
    emoji: "🔗",
    heading: "Вход в&nbsp;«Подоконник»",
    body:
      para("Нажмите на кнопку — и вы войдёте в&nbsp;свой аккаунт без пароля.") +
      button("{{ .ConfirmationURL }}", "Войти") +
      box("🔒 Ссылка одноразовая и&nbsp;действует ограниченное время. Никому её не пересылайте.") +
      fallbackLink,
    footer:
      "Вы получили это письмо, потому что для {{ .Email }} запросили вход в&nbsp;«Подоконник».<br />\n                Если это были не вы — просто удалите письмо, без ссылки в&nbsp;аккаунт никто не войдёт.",
  },
  {
    key: "invite",
    file: "invite.html",
    group: "core",
    subject: "Вас пригласили в «Подоконник»",
    title: "Приглашение",
    preheader: "Вас ждут в «Подоконнике» — дневнике комнатных растений.",
    emoji: "🌿",
    heading: "Вас пригласили в&nbsp;«Подоконник»",
    body:
      para(
        "«Подоконник» — дневник комнатных растений: напоминает о поливе, подсказывает, как ухаживать, и помогает, если растение заболело. Примите приглашение — и задайте пароль.",
      ) +
      button("{{ .ConfirmationURL }}", "Принять приглашение") +
      FEATURES +
      fallbackLink,
    footer:
      "Приглашение отправлено на {{ .Email }}.<br />\n                Если вы не ждали его — просто удалите письмо.",
  },
  {
    key: "email_change",
    file: "change-email.html",
    group: "core",
    subject: "Подтвердите новую почту — Подоконник",
    title: "Смена почты",
    preheader: "Подтвердите смену почты в аккаунте «Подоконника».",
    emoji: "✉️",
    heading: "Подтвердите смену почты",
    body:
      para("Вы попросили сменить почту аккаунта:<br /><b>{{ .Email }}</b> → <b>{{ .NewEmail }}</b>") +
      para("Нажмите на кнопку, чтобы подтвердить. Растения, записи и подписки останутся на месте.") +
      button("{{ .ConfirmationURL }}", "Подтвердить смену почты") +
      NOT_YOU_SECURITY +
      fallbackLink,
    footer: "Это письмо о безопасности вашего аккаунта в&nbsp;«Подоконнике».",
  },
  {
    key: "reauthentication",
    file: "reauthentication.html",
    group: "core",
    subject: "Код подтверждения — Подоконник",
    title: "Код подтверждения",
    preheader: "Код для подтверждения действия в «Подоконнике».",
    emoji: "🔐",
    heading: "Код подтверждения",
    body:
      para("Введите этот код в&nbsp;«Подоконнике», чтобы подтвердить действие:") +
      code("{{ .Token }}") +
      box("🔒 Код одноразовый и&nbsp;действует ограниченное время. Никому его не сообщайте — сотрудники «Подоконника» никогда его не спрашивают."),
    footer:
      "Код запрошен для {{ .Email }}.<br />\n                Если это были не вы — смените пароль: «Забыли пароль?» на&nbsp;странице входа.",
  },
  {
    key: "password_changed_notification",
    file: "notify-password-changed.html",
    group: "notify",
    subject: "Пароль изменён — Подоконник",
    title: "Пароль изменён",
    preheader: "Пароль к вашему аккаунту изменён.",
    emoji: "🔑",
    heading: "Пароль изменён",
    body:
      para("Пароль к&nbsp;аккаунту <b>{{ .Email }}</b> в&nbsp;«Подоконнике» только что изменён.") +
      para("Если это сделали вы — всё в&nbsp;порядке, ничего делать не нужно.") +
      NOT_YOU_SECURITY,
    footer: "Это письмо о безопасности вашего аккаунта в&nbsp;«Подоконнике».",
  },
  {
    key: "email_changed_notification",
    file: "notify-email-changed.html",
    group: "notify",
    subject: "Почта аккаунта изменена — Подоконник",
    title: "Почта изменена",
    preheader: "Почта вашего аккаунта изменена.",
    emoji: "✉️",
    heading: "Почта аккаунта изменена",
    body:
      para("Почта аккаунта в&nbsp;«Подоконнике» изменена:<br /><b>{{ .OldEmail }}</b> → <b>{{ .Email }}</b>") +
      para("Если это сделали вы — всё в&nbsp;порядке.") +
      NOT_YOU_SECURITY,
    footer: "Это письмо о безопасности вашего аккаунта в&nbsp;«Подоконнике».",
  },
  {
    key: "phone_changed_notification",
    file: "notify-phone-changed.html",
    group: "notify",
    subject: "Телефон аккаунта изменён — Подоконник",
    title: "Телефон изменён",
    preheader: "Номер телефона в вашем аккаунте изменён.",
    emoji: "📱",
    heading: "Телефон аккаунта изменён",
    body:
      para("В&nbsp;аккаунте <b>{{ .Email }}</b> в&nbsp;«Подоконнике» изменён номер телефона.") +
      para("Если это сделали вы — всё в&nbsp;порядке.") +
      NOT_YOU_SECURITY,
    footer: "Это письмо о безопасности вашего аккаунта в&nbsp;«Подоконнике».",
  },
  {
    key: "identity_linked_notification",
    file: "notify-identity-linked.html",
    group: "notify",
    subject: "Добавлен новый способ входа — Подоконник",
    title: "Новый способ входа",
    preheader: "К вашему аккаунту привязан новый способ входа.",
    emoji: "🔗",
    heading: "Добавлен новый способ входа",
    body:
      para("К&nbsp;аккаунту <b>{{ .Email }}</b> в&nbsp;«Подоконнике» привязан новый способ входа (например, через другой сервис).") +
      para("Если это сделали вы — всё в&nbsp;порядке.") +
      NOT_YOU_SECURITY,
    footer: "Это письмо о безопасности вашего аккаунта в&nbsp;«Подоконнике».",
  },
  {
    key: "identity_unlinked_notification",
    file: "notify-identity-unlinked.html",
    group: "notify",
    subject: "Способ входа отключён — Подоконник",
    title: "Способ входа отключён",
    preheader: "От вашего аккаунта отвязан один из способов входа.",
    emoji: "✂️",
    heading: "Способ входа отключён",
    body:
      para("От&nbsp;аккаунта <b>{{ .Email }}</b> в&nbsp;«Подоконнике» отвязан один из способов входа.") +
      para("Если это сделали вы — всё в&nbsp;порядке.") +
      NOT_YOU_SECURITY,
    footer: "Это письмо о безопасности вашего аккаунта в&nbsp;«Подоконнике».",
  },
  {
    key: "mfa_factor_enrolled_notification",
    file: "notify-mfa-enrolled.html",
    group: "notify",
    subject: "Включена двухэтапная проверка — Подоконник",
    title: "Двухэтапная проверка включена",
    preheader: "В вашем аккаунте включена двухэтапная проверка.",
    emoji: "🛡️",
    heading: "Двухэтапная проверка включена",
    body:
      para("В&nbsp;аккаунте <b>{{ .Email }}</b> в&nbsp;«Подоконнике» добавлен второй шаг входа. Теперь аккаунт защищён надёжнее.") +
      para("Если это сделали вы — всё в&nbsp;порядке.") +
      NOT_YOU_SECURITY,
    footer: "Это письмо о безопасности вашего аккаунта в&nbsp;«Подоконнике».",
  },
  {
    key: "mfa_factor_unenrolled_notification",
    file: "notify-mfa-unenrolled.html",
    group: "notify",
    subject: "Двухэтапная проверка отключена — Подоконник",
    title: "Двухэтапная проверка отключена",
    preheader: "В вашем аккаунте отключена двухэтапная проверка.",
    emoji: "⚠️",
    heading: "Двухэтапная проверка отключена",
    body:
      para("В&nbsp;аккаунте <b>{{ .Email }}</b> в&nbsp;«Подоконнике» отключён второй шаг входа.") +
      para("Если это сделали вы — всё в&nbsp;порядке.") +
      NOT_YOU_SECURITY,
    footer: "Это письмо о безопасности вашего аккаунта в&nbsp;«Подоконнике».",
  },
];

for (const t of TEMPLATES) writeFileSync(join(dir, t.file), layout(t));
writeFileSync(
  join(dir, "templates.json"),
  JSON.stringify(
    TEMPLATES.map(({ key, file, group, subject }) => ({ key, file, group, subject })),
    null,
    2,
  ) + "\n",
);
console.log(`${TEMPLATES.length} писем`);
