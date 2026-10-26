# Stitch для макетів Pro League

## Що налаштовано

- Погоджений бриф: [головна сторінка](../research/proleague-homepage-design-brief.md).
- Чотири проєктні skills із `google-labs-code/stitch-skills`, коміт
  `0337446dadde6f8c94210444e2aa9d546126480f`; джерела й хеші — у `skills-lock.json`.
- Проєктна MCP-конфігурація — `.codex/config.toml`, для довіреного проєкту.
  Не змінює глобальні MCP-сервери або конфігурацію Render/GitHub Environments.
- Endpoint: `https://stitch.googleapis.com/mcp`.
- Авторизація: `X-Goog-Api-Key` зі змінної `STITCH_API_KEY`, не Bearer.

Каталог `.agents` уже виключений із Git. Skills встановлені локально;
для відтворення використовувати джерела й коміт із lock-файлу.
Файли skills не змінювались; інсталятор використав назви каталогів без
`stitch::`, тоді як namespaced імена з оригінального frontmatter збережено.

## Що потрібно зробити власнику

1. Відкрити свій акаунт [Stitch](https://stitch.withgoogle.com/) і
   [офіційні інструкції MCP](https://stitch.withgoogle.com/docs/mcp/setup/).
   Знайти створення API key у доступному інтерфейсі акаунта. Сторінка
   інструкцій не віддала текст автоматичному читачеві; точні назви кнопок
   тут навмисно не припускаємо.
2. Передати ключ як `STITCH_API_KEY` процесу Codex. Не вводити його у файл
   конфігурації, аргументи команд, `.env` застосунку або чат.
3. Повністю перезапустити Codex із середовища, де змінна доступна.
   Змінна, задана в окремому PowerShell, не потрапляє до вже відкритої програми.
4. У новому ході попросити перевірити read-only `list_projects` Stitch.
   Саме успішний виклик підтверджує доступ, а не лише запис у налаштуваннях.

Для введення в поточний PowerShell без показу ключа та без значення в історії:

```powershell
$env:STITCH_API_KEY = [System.Net.NetworkCredential]::new('', (Read-Host 'Stitch API key' -AsSecureString)).Password
```

Безпечна перевірка наявності (лише `True` / `False`):

```powershell
(-not [string]::IsNullOrWhiteSpace($env:STITCH_API_KEY))
```

Ключ існує у відкритому вигляді в середовищі процесу після введення;
`Read-Host -AsSecureString` захищає введення, а не подальше зберігання.
Запускати новий процес Codex потрібно саме з цього PowerShell після виходу
з попереднього екземпляра. Якщо використовуєте GUI користувацьких змінних
Windows для постійного зберігання, врахуйте: це не сховище секретів,
ключ зберігається як звичайна користувацька змінна. Автоматично її не створювали.

## Після успішного підключення

1. Перевірити підтримувані MCP-інструменти та список проєктів без генерації.
2. Підготувати демонстраційний контент і погоджений візуальний напрям.
3. Погодити палітру, шрифти й геометрію перед завантаженням дизайн-системи.
4. Створити екрани відповідно до брифу. Токени передавати через дизайн-систему,
   а не дублювати в generation prompt.
5. Якщо прямого MCP upload немає або він не працює, окремо оцінити потребу в
   `upload-to-stitch`. Цей додатковий skill зараз не встановлений; скриптовий
   upload не запускати та не передавати ключ в аргументах без окремої перевірки.

Не передавати Stitch персональні дані, закриті документи, provider credentials
або production-дампи. Початкові макети використовують лише демонстраційний
чи дозволений публічний контент.

Джерела: [Stitch SDK](https://github.com/google-labs-code/stitch-sdk),
[Stitch Skills](https://github.com/google-labs-code/stitch-skills),
[Codex MCP](https://developers.openai.com/codex/mcp/),
[Codex configuration](https://developers.openai.com/codex/config-reference/).

## Поточний стан і GitHub

MCP підключено, макет головної створено; актуальні матеріали описані в
[артдирекції](../research/proleague-homepage-art-direction.md).
Комітити цю інструкцію й `skills-lock.json`. Каталог `.codex/` лишається
локальним та ігнорується Git; конфігурацію без ключа можна відтворити так:

```toml
[mcp_servers.stitch]
url = "https://stitch.googleapis.com/mcp"
tool_timeout_sec = 300

[mcp_servers.stitch.env_http_headers]
X-Goog-Api-Key = "STITCH_API_KEY"
```

`.agents/`, `.stitch/designs/`, `.env*`, залежності й build/test-артефакти
не публікувати. Для `.env.example` діє чинний виняток без реальних секретів.
