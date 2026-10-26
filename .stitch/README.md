# Pro League — макет головної

Початковий погоджений напрям: **Футбол наших громад**.
[Stitch](https://stitch.withgoogle.com/projects/9855422714832969954).

- `homepage/DESIGN.md` — погоджені токени та композиційні правила.
- `homepage/metadata.json` — поточний екран, джерела й межі перевірки.
- `homepage/generation-request.json` — нормалізований вхідний запит.
- `homepage/image-provenance.json` — походження демонстраційних медіа.
- `designs/homepage.png` та `designs/homepage.html` — актуальний експорт.

[Бриф](../docs/research/proleague-homepage-design-brief.md) ·
[Артдирекція](../docs/research/proleague-homepage-art-direction.md).

Desktop-напрям, tablet/mobile та аркуш станів погоджені власником.
[Специфікація адаптивності та станів](../docs/research/proleague-homepage-responsive-states.md).
Експорти: `designs/homepage-mobile.png/html`, `homepage-tablet.png/html`,
`homepage-states.png/html`. Метадані містять ідентифікатори поточних екранів.
Додаткові `*-request.json` — нормалізовані запити для цих макетів.
Браузерні CLI-артефакти `.playwright-cli/` залишаються локальними.
PNG/HTML — експорти Stitch без ручної зміни дизайну. HTML не переносити
буквально в застосунок: він використовує зовнішні CDN й демонстраційні посилання.
Права на фото та видиму символіку ще потрібно перевірити або замінити медіа.

## GitHub

Комітити `homepage/`, цей README та кореневі metadata разом із брифом,
артдирекцією, демоданими, інструкціями MCP й `skills-lock.json`.
Експорти `designs/` залишаємо локально (ігноруються Git): це великі похідні
матеріали, а не код застосунку. За потреби погоджений PNG можна додати до PR
як вкладення. Локальний `.codex/` не публікуємо; інструкція відтворення MCP
є в `docs/operations/stitch-design-setup.md`. Секрети не комітити.
