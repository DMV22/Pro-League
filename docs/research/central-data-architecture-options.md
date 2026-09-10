# Варіанти архітектури центрального модуля даних ProLeague

Дата дослідження: 2026-09-10

> **Статус рішення:** дослідження збережене як історія розглянутих варіантів. Первинну рекомендацію окремого REST API замінено рішенням про один Next.js modular monolith у [ADR-0011](../adr/0011-use-a-single-nextjs-modular-monolith.md).

## Мета й вихідні умови

Потрібно визначити, де зберігати та через який серверний шар змінювати **Official information** порталу ProLeague. Архітектура має підтримувати:

- кілька **Competitions** і кілька **Seasons**;
- ручне внесення календаря та **Match Results** одним уповноваженим **Admin**;
- **News Articles** зі станами **Draft** і **Published**;
- публічне читання опублікованих даних;
- завантаження зображень;
- подальше розширення бізнес-правил змагань без розподіленої системи на старті.

Поточний застосунок — client-only Vite/React 19 SPA з Redux Toolkit і `redux-persist`; весь `league` state зараз потрапляє в `localStorage`. Це корисний навчальний стан, але не може бути спільним джерелом Official information.

Нижче факти про продукти спираються на офіційну документацію. Оцінки придатності, складності та portfolio value є архітектурними висновками для цього конкретного проєкту, а не твердженнями постачальників.

## Спільний принцип для всіх придатних варіантів

Незалежно від обраного фреймворку, **PostgreSQL має бути центральним persistent source of truth** для Competition, Season, Team, Match, Match Result, News Article та Admin identity/permissions (або посилання на зовнішню identity). Клієнтський Redux store може містити UI state і тимчасовий кеш, але не канонічні дані.

RTK Query спеціально призначений для завантаження, оновлення та кешування server state, входить до Redux Toolkit і генерує React hooks; його кеш дедуплікує однакові запити та живе за правилами активних підписок ([RTK Query overview](https://redux-toolkit.js.org/rtk-query/overview), [cache behavior](https://redux-toolkit.js.org/rtk-query/usage/cache-behavior)). Отже, для поточного SPA природна межа така:

- PostgreSQL + серверний шар — authoritative state;
- RTK Query — client cache server state;
- звичайні Redux slices — лише UI state, наприклад фільтри, відкриті панелі та незбережені локальні дії;
- `localStorage` — максимум нешкідливі користувацькі налаштування, не Official information і не Admin session secrets.

## Варіант 1. Власний REST API: modular monolith + PostgreSQL

### Як виглядає

Окремий TypeScript backend, наприклад NestJS із Fastify adapter, одна PostgreSQL database та object storage для медіа. Всередині одного deployable backend процесу — модулі `auth`, `news`, `competitions`, `seasons`, `teams`, `matches`, `media`.

Nest рекомендує feature modules як спосіб групувати пов'язані можливості; providers інкапсулюються модулем і експортуються як його публічний інтерфейс ([Nest modules](https://docs.nestjs.com/modules)). Nest також має офіційні patterns для JWT authentication і guards ([Nest authentication](https://docs.nestjs.com/security/authentication)) та може працювати через вбудований Fastify adapter ([Nest Fastify adapter](https://docs.nestjs.com/techniques/performance)).

### Переваги для ProLeague

- **Найчіткіша доменна межа.** Усі зміни проходять через application services, тому правила на кшталт «Match Result можна підтвердити лише для Match відповідного Competition Season» живуть у TypeScript, а не розсіюються між React, SQL policies і CMS hooks.
- **Добра модель для складних спортивних правил.** Табличні формати, кубкові стадії, технічні результати, перенесення та перерахунок standings легше еволюціонувати в окремих domain/application modules.
- **Контроль API contract.** REST endpoints і validation DTO можна спроєктувати навколо мови `CONTEXT.md`, а OpenAPI використовувати як контракт для frontend.
- **Найвища portfolio value для full-stack позиціонування.** Проєкт демонструє API design, authorization, relational modeling, migrations, тестування бізнес-правил і deployment, а не лише інтеграцію готового backend.
- **Помірний vendor lock-in.** PostgreSQL і REST переносимі; hosting, object storage й email можна міняти через adapters.
- **Добре стикується з поточним frontend.** Vite/React компоненти можна залишити та поступово перевести з persisted reducers на RTK Query без одночасної перебудови всього UI.

### Недоліки й ризики

- **Найбільше власної роботи.** Потрібно реалізувати Admin UI, authentication/session lifecycle, password reset або provisioning, authorization, upload pipeline, audit logging, validation, backups і monitoring.
- **Більше deployable ресурсів.** Зазвичай окремо розгортаються frontend, API, database та object storage/CDN.
- **Безпека повністю на команді.** Офіційний Nest приклад показує JWT flow, але прямо зазначає, що конкретний підхід залежить від вимог застосунку; production session strategy, rotation/revocation, CSRF/CORS/rate limiting все одно треба спроєктувати й протестувати ([Nest authentication](https://docs.nestjs.com/security/authentication)).
- **Fastify має інтеграційні нюанси.** Наприклад, стандартний Nest upload recipe базується на Multer і не сумісний з Fastify adapter, тому для Fastify upload layer слід обирати Fastify-native plugin або прямий presigned upload до object storage ([Nest file upload](https://docs.nestjs.com/techniques/file-upload)).

### Hosting, media, SEO та вартість

- Backend можна розгорнути як один web service, PostgreSQL — як managed database, медіа — в S3-compatible storage.
- Вартість складається щонайменше з API compute, database та storage/egress; зате кожен компонент можна оптимізувати або замінити окремо.
- Сам API не вирішує SEO поточного SPA. Для News Article pages потрібен SSR/prerender-capable public frontend або коректне статичне генерування.

### Міграція з поточного стану

Найменш руйнівний шлях: додати backend поруч із наявним frontend, спочатку перенести Competition/Season/Team/Match, потім News Article, після цього вимкнути persistence доменних slices. RTK Query може залишити Redux Toolkit як видиму частину досвіду, але використовувати його за правильним призначенням.

## Варіант 2. PostgreSQL Backend-as-a-Service: Supabase

### Як виглядає

Vite/React frontend звертається через Supabase client до generated Data API, Auth і Storage. Core Supabase — повний PostgreSQL, а не proprietary database abstraction; навколо нього працюють PostgREST, Auth, Storage, Realtime та Edge Functions ([Supabase architecture](https://supabase.com/docs/guides/getting-started/architecture), [database overview](https://supabase.com/docs/guides/database/overview)).

### Переваги для ProLeague

- **Найшвидший шлях до робочого MVP.** Database, Auth, REST API, Storage dashboard і backups у managed плані доступні в одному продукті.
- **Мінімум backend boilerplate.** Для одного Admin прості CRUD операції можна реалізувати напряму з frontend; складніші mutation flows винести в database functions або Edge Functions.
- **Сильна медіа-історія для малого проєкту.** Storage зберігає metadata у PostgreSQL, використовує object provider і підтримує RLS-based access control ([Supabase Storage schema](https://supabase.com/docs/guides/storage/schema/design)).
- **Добра сумісність із поточним Vite/React.** Не потрібен великий framework migration; RTK Query може обгорнути Supabase calls або для простих screens можна використовувати Supabase client без дублювання кешів.
- **PostgreSQL знижує lock-in даних.** Є SQL migrations, стандартні таблиці та можливість прямого database connection; офіційний CLI зберігає зміни schema як migration files ([Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations)).

### Недоліки й ризики

- **Authorization стає частиною database design.** Data API використовує одночасно grants і Row Level Security. Supabase наголошує, що exposed tables потребують RLS і least-privilege grants; service role key обходить RLS і ніколи не має опинятися у frontend ([securing the Data API](https://supabase.com/docs/guides/api/securing-your-api), [secure frontend access](https://supabase.com/docs/guides/database/secure-data)). Помилка policy для офіційного порталу є критичною.
- **Бізнес-логіка може розпорошитися.** Частина правил опиниться у SQL constraints/triggers/functions, частина в Edge Functions, частина у frontend. Для складних форматів Competition це гірше читається й тестується, ніж один application layer.
- **Dashboard не є предметною Admin panel.** Він добрий для розробника, але федерації все одно потрібен власний зручний UI для News Articles, Match Results і media.
- **Portfolio signal зміщений.** Сильний приклад швидкої product delivery, database/RLS і cloud integration, але слабший доказ власного backend/API design, якщо весь CRUD генерується автоматично.
- **Managed platform lock-in вищий за lock-in PostgreSQL.** Дані переносимі, але Auth identities, Storage policies, Edge Functions, Realtime і operational workflow треба мігрувати окремо. Self-hosting офіційно можливий, однак тоді власник відповідає за provisioning, hardening, updates, Postgres, HA, backups, monitoring та uptime, а частина managed features відсутня ([Supabase self-hosting](https://supabase.com/docs/guides/self-hosting)).

### Hosting, media, SEO та вартість

- Найменша operational complexity серед чотирьох варіантів у managed режимі.
- Станом на дату дослідження Free план має обмежені database/storage ресурси та pause after inactivity, а production-oriented Pro починається від $25/month і включає daily backups; точні ліміти треба повторно перевіряти перед запуском ([Supabase pricing](https://supabase.com/pricing)).
- BaaS не вирішує SEO: Vite SPA залишається client-rendered. Потрібно окремо додати SSR/prerender frontend.

### Коли це найкращий вибір

Коли головний пріоритет — запустити реальний portal однією людиною максимально швидко, а глибокий власний backend не є ключовою навчальною ціллю. Також хороший проміжний вибір: використовувати Supabase лише як managed PostgreSQL/Storage, але поставити перед ним власний API; тоді Data API можна не експонувати.

## Варіант 3. Full-stack React framework server layer + PostgreSQL

### Як виглядає

Перевести frontend у React Router Framework Mode (або аналогічний full-stack React framework), де route loaders читають PostgreSQL через server-only layer, actions виконують Admin mutations, а ті самі routes рендерять HTML. React Router Framework Mode працює через Vite plugin і підтримує SPA, SSR та static rendering; loaders у SSR викликаються на сервері, а prerender генерує HTML і route data під час build ([React Router modes](https://reactrouter.com/start/modes), [rendering strategies](https://reactrouter.com/start/framework/rendering), [route modules](https://reactrouter.com/start/framework/route-module)).

### Переваги для ProLeague

- **Найменше концептуальних шарів.** Public UI, Admin UI і server data access живуть в одному TypeScript deployable застосунку.
- **SEO є частиною тієї самої архітектури.** News Article pages, Competition/Season pages і Match pages можна server-render; окремі стабільні сторінки можна prerender.
- **Добрий компроміс для solo developer.** Не потрібно підтримувати окремі frontend і API releases, CORS та незалежні DTO/client packages.
- **Сумісність із Vite/React вища, ніж при переході на Next.js.** Framework Mode використовує Vite plugin, тому React-компоненти й значна частина стилів можуть бути перенесені поступово.
- **Низький platform lock-in на рівні даних.** PostgreSQL залишається звичайним; server adapters залежать від обраного runtime, але не від BaaS data model.

### Недоліки й ризики

- **Frontend і backend життєві цикли зв'язані.** Зміна server domain logic та UI розгортається одним application unit. Це нормально для modular monolith, але менш зручно, якщо згодом з'являться mobile app або зовнішні consumers API.
- **Межі легко розмити.** Без дисципліни domain services потрапляють прямо у loaders/actions, що ускладнює повторне використання й testing. Потрібен внутрішній modular monolith навіть без окремого HTTP API.
- **Перехід зачіпає routing і data loading.** Поточний застосунок не має router; міграція буде ширшою, ніж просто додати RTK Query.
- **Redux server-state роль зменшується.** Route loaders/actions уже керують значною частиною data lifecycle. Redux Toolkit можна залишити для складного Admin UI state, але RTK Query може стати зайвим дублюючим кешем для loader-owned data.
- **Auth/media все одно треба вибрати й реалізувати.** Full-stack framework не надає автоматично готового federation-specific Admin, media library чи повного auth product.

### Hosting, media, SEO та вартість

- Один app service + managed PostgreSQL + object storage. Це простіше за окремі public frontend і API, але складніше за повністю managed BaaS.
- SSR потребує deployment target із server runtime; React Router прямо зазначає, що server rendering вимагає відповідного deployment ([rendering strategies](https://reactrouter.com/start/framework/rendering)).
- Це найсильніший варіант, якщо SEO і швидкий solo-development важливіші за публічний standalone API.

### Міграція з поточного стану

Спочатку додати route tree у Framework Mode, перенести публічні сторінки в SSR loaders, потім створити server-only repositories/services для PostgreSQL і Admin actions. Існуючі presentational components можна повторно використати; persisted domain state видаляється після підключення відповідних routes.

## Варіант 4. Headless CMS-first: Payload + PostgreSQL

### Як виглядає

Payload виступає content/data backend, згенерованою Admin panel, authentication, access control, REST/GraphQL/Local APIs, drafts/versions і media library. Він працює всередині Next.js; офіційний PostgreSQL adapter використовує Drizzle і `node-postgres` ([Payload concepts](https://payloadcms.com/docs/getting-started/concepts), [PostgreSQL adapter](https://payloadcms.com/docs/database/postgres)). Public frontend може бути інтегрованим Next.js застосунком або залишитися окремим Vite/React consumer REST API.

### Переваги для ProLeague

- **Найкраща editorial experience без розробки з нуля.** Payload автоматично генерує type-safe Admin Panel із schema config ([Admin Panel](https://payloadcms.com/docs/admin/overview)).
- **Draft/Published вже є.** Drafts підтримують незавершені версії, publish action і preview; Versions дають change history, diff і restore ([Payload drafts](https://payloadcms.com/docs/versions/drafts), [Payload versions](https://payloadcms.com/docs/versions/overview)). Це прямо відповідає погодженому lifecycle News Article.
- **Auth і access control вбудовані.** Можна дозволити public read лише Published documents, а create/update/delete — лише Admin ([Payload access control](https://payloadcms.com/docs/access-control/overview), [authentication](https://payloadcms.com/docs/authentication/overview)).
- **Media library готова.** Upload collection додає file metadata, thumbnail/edit UI, image sizes та upload CRUD ([Payload uploads](https://payloadcms.com/docs/upload/overview)).
- **Sports data технічно моделюються.** Collections автоматично отримують APIs, а relationship fields зв'язують Competition, Season, Team і Match ([collections](https://payloadcms.com/docs/configuration/collections), [relationships](https://payloadcms.com/docs/fields/relationship)).
- **Open source/self-hostable.** Payload можна розгорнути всюди, де запускається Next.js, із власним PostgreSQL та external object storage ([production deployment](https://payloadcms.com/docs/production/deployment)).

### Недоліки й ризики

- **CMS-centric model не ідеальний для спортивного engine.** Простий CRUD календаря і Match Results зручний, але складні invariants, автоматичний standings calculation, кубкові brackets і format-specific workflows доведеться реалізувати hooks/custom endpoints/custom components. У результаті частина важливої логіки житиме в CMS lifecycle.
- **Велика зміна frontend stack, якщо інтегрувати повністю.** Payload HTTP/Admin layer працює в Next.js; для одного застосунку поточний Vite setup фактично мігрує на Next.js. Якщо Vite залишити окремо, знову з'являються два deployables і SEO треба вирішувати окремо.
- **Schema/API coupling до Payload вище, ніж у custom REST.** PostgreSQL переносимий, але drafts, versions, generated relationships, hooks, Admin UI і Local API — framework-specific.
- **Portfolio value сильна для CMS/product integration, але слабша для чистого API/domain design.** Її можна підсилити custom domain services і тестами, але тоді зменшується перевага швидкого CMS-first старту.
- **Infrastructure не дорівнює «одна коробка».** Офіційна deployment guide нагадує, що production зазвичай потребує database, permanent file storage, email provider і CDN; на ephemeral filesystem uploads слід винести до cloud storage adapter ([Payload production deployment](https://payloadcms.com/docs/production/deployment)).

### Коли це найкращий вибір

Коли найбільша частина цінності — професійна редакторська робота з News Articles, а sports module на старті є переважно ручним relational CRUD без складного competition engine.

## Порівняльна матриця

Оцінки: 1 — слабко/дорого для цього проєкту, 5 — сильно/вигідно. `Hosting simplicity` оцінює managed MVP, не self-hosting.

| Критерій | Custom REST modular monolith | Supabase BaaS | Full-stack React + PostgreSQL | Payload CMS-first |
|---|---:|---:|---:|---:|
| Збереження поточного Vite/React UI | 5 | 5 | 3 | 2–4 |
| Швидкість першого MVP | 2 | 5 | 3 | 4 |
| Контроль складних Competition rules | 5 | 3 | 5 | 3 |
| Готовий Admin/editorial workflow | 1 | 2 | 1 | 5 |
| Draft/Published і version history | 2 | 2 | 2 | 5 |
| Auth/authorization із коробки | 2 | 5 | 2 | 5 |
| Media із коробки | 2 | 5 | 2 | 5 |
| SEO в основній архітектурі | 2 | 2 | 5 | 5 integrated / 2 separate Vite |
| Hosting simplicity | 2 | 5 | 4 | 3 |
| Низький vendor/framework lock-in | 5 | 3 | 4 | 3 |
| Full-stack portfolio signal | 5 | 3 | 5 | 4 |
| Простота додавання інших API consumers | 5 | 4 | 3 | 4 |

## Рекомендація

### Цільовий вибір

Для ProLeague рекомендований **варіант 1: custom TypeScript REST API modular monolith + PostgreSQL**, а SEO вирішувати окремим SSR-capable public frontend. Причини:

1. У домені вже відомо, що буде кілька типів Competition і Seasons, але їхні формати та спортивні правила ще не узгоджені. Значить, головний ризик — не CRUD, а еволюція domain logic.
2. Official information потребує одного контрольованого write path. Серверний application layer простіше audit/test, ніж direct browser-to-database mutations.
3. Поточний Vite/React/Redux код можна мігрувати по feature, а RTK Query дає природний клієнт до REST API.
4. Для pet-project, який має репрезентувати професійний досвід, це найповніше демонструє backend design, PostgreSQL, security boundaries, tests і operations.

Рекомендована форма, не microservices:

```text
Public/Admin React frontend
        |
        | HTTPS REST
        v
TypeScript modular monolith API
  - Auth
  - News
  - Competitions / Seasons
  - Teams
  - Matches / Match Results
  - Media metadata
        |                 |
        v                 v
   PostgreSQL       Object storage
```

### Практичний компроміс

Managed Supabase можна використати **лише як PostgreSQL + object storage provider за власним API**, не як direct-to-browser authoritative mutation layer. Це зменшує operational burden, але зберігає один application write path і дозволяє згодом перенести database через звичайні PostgreSQL migrations. Supabase Auth можна оцінити окремо; для одного Admin це не повинно визначати всю data architecture.

### Чому не обирати інші варіанти зараз

- **Не pure Supabase BaaS:** швидше, але RLS/SQL/Edge Functions стають розподіленим application layer саме тоді, коли competition rules ще не визначені.
- **Не full-stack React як єдиний server boundary:** чудовий варіант для SSR і solo delivery, але до опису майбутніх consumers та Admin flows передчасно зв'язує domain API з route framework. Його варто розглянути як rendering/frontend рішення поверх REST API.
- **Не CMS-first як system of record для всього:** Payload дуже сильний для News Articles, але центр домену включає Matches, Match Results, standings і різні формати Competition. Додавання окремого sports backend поруч із CMS створить два джерела даних і synchronization problem. Payload має сенс, лише якщо після деталізації бізнес-логіки sports module виявиться простим ручним CRUD.

## Пропонований поетапний шлях

1. **Завершити domain modeling до вибору ORM/schema.** Узгодити формати Competition, Season lifecycle, статуси Match, підтвердження/виправлення Match Result, standings tie-breakers, postponed/cancelled/technical result cases.
2. **Зафіксувати architecture ADR.** Один modular monolith API, одна PostgreSQL database як source of truth, object storage окремо; no microservices.
3. **Визначити auth/session ADR.** Один Admin на старті, але provisioning, recovery, session revocation, cookie/token transport і audit trail мають бути явними.
4. **Створити database model і migrations.** Спочатку Competition, Season, Team, участь Team у Season, Match і Match Result; News Article/Media — окремий модуль у тій самій database.
5. **Підняти read-only REST endpoints.** Публічні списки й detail pages; додати OpenAPI contract.
6. **Перевести frontend на RTK Query.** Не видаляти старий slice одним кроком: мігрувати feature-by-feature, після parity прибрати `redux-persist` для доменних даних.
7. **Додати Admin write flows.** Auth, Draft/Published, manual Match Result confirmation, validation, optimistic concurrency/version field і audit log.
8. **Додати object storage.** Backend видає presigned upload або сам приймає validated files; database зберігає media metadata/ownership/alt text.
9. **Перевести public frontend на SSR/prerender.** React Router Framework Mode є природним Vite-adjacent кандидатом і підтримує SSR та prerender офіційно ([rendering strategies](https://reactrouter.com/start/framework/rendering)).
10. **Production readiness.** Backups із перевіреним restore, monitoring, rate limiting, secure headers, secrets management, database least privilege, media limits і end-to-end tests критичних publication flows.

## Питання, які слід узгодити до фінального ADR

Архітектурний напрям можна обрати вже зараз, але реалізацію schema/API не варто фіксувати до відповідей на ці питання:

1. Які саме формати Competition потрібні в перші два релізи: круговий чемпіонат, групи, плей-оф, двоматчеві кубкові пари?
2. Чи Match Result після публікації можна редагувати тим самим Admin, і чи має публічно показуватися історія виправлень?
3. Чи standings обчислюються на запит із Match Results, матеріалізуються після кожної зміни, чи можуть містити ручні federation adjustments/penalties?
4. Чи News Article може стосуватися кількох Competitions/Seasons одночасно?
5. Чи потрібні запланована публікація, preview і revision restore в MVP, чи достатньо тільки Draft/Published?
6. Чи передбачаються зовнішні consumers API (мобільний застосунок, віджети для клубів, партнерські сайти)?
7. Який hosting budget і хто буде відповідати за backups/restore та incident response після передачі порталу федерації?

Відповіді можуть змінити вибір між standalone REST API і full-stack React server layer, але не змінюють базове рішення: Official information не може бути authoritative у Redux або `localStorage`; вона має зберігатися централізовано в PostgreSQL і змінюватися лише через авторизований server-side write path.
