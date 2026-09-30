# PHOTO LASH PREVIEW v0

## Как открыть

1. Открыть приложение через HTTP.
2. Выбрать «Анализ по фото», загрузить фото с хорошо видимыми обоими глазами.
3. Дождаться анализа, нажать «Подтвердить и построить схемы».
4. В карточке лучшего рассчитанного дизайна нажать «ПОКАЗАТЬ LASH PREVIEW».
5. Под кнопкой появится полное исходное фото с Canvas-ресницами на обоих глазах.

Для другой рекомендации: открыть её Lash Map и нажать ту же кнопку.
Ручные поправки PHOTO в Lash Map обновляют preview; «СБРОСИТЬ» возвращает
исходное положение. Возврат из Lash Map в результат сохраняет существующее
поведение приложения: локальные настройки Lash Map не переносятся в Hero.

## Реализация и границы

- `index.html`: кнопка в HeroScreen и LashMapScreen, общий PhotoLashPreviewPanel,
  buildPhotoPreviewEyes, локализованные строки RU/EN/AR.
- `photo-lash-preview.js`: изолированный Canvas 2D renderer, UMD/Node module.
- Источник длин: ClientLashDesign.mapping.physicalEyes[side].derivedSectors.
- Hero использует уже рассчитанный canonical design; PHOTO runtime создаётся
  через существующий withPhotoRuntime. Lash Map передаёт свой photoClientDesign.
- Применяются существующие photoPropsFromClientDesign, getPhysicalEyeLandmarks,
  buildProfessionalEyeProjection, applyManualPhotoAdjustment.
- Пять визуальных fibers на существующий sample: положение внутри ближайшей
  ячейки t, точная длина этого sample, без новой интерполяции профессиональных длин.
- Корни следуют существующей верхней кривой века. Смещение линии подписей Lash Map
  вычитается; ручное смещение остаётся. Каждый волосок — замкнутая заострённая
  кривая Безье с небольшой детерминированной вариацией.
- Исходный nativeImage и overlay используют единую систему координат analysis
  imageWidth/imageHeight; при отсутствии nativeImage используется originalImage.
- Рендер запускается только по явному нажатию. Ошибки геометрии обоих глаз,
  renderer/Canvas и загрузки фото видны в UI; кнопка не исчезает.

Это иллюстрация v0, не точная физическая симуляция наращивания. Масштаб относительно
ширины глаза не калиброван в мм. Плотность, направление и форма изгиба — нейтральные
настройки renderer, не AI-рекомендации; fan construction, текстуры и различия curl
не симулируются. Качество посадки зависит от существующих 68-point landmarks.
Фото не ретушируется; натуральные ресницы остаются видимыми. Экспорт и сохранение
preview не добавлены. Новый renderer не использует WebGL, 3D или MediaPipe.

## Проверка

Baseline `node --test tests/*.test.js`: 1105 runner passes, 0 failures, 5 skipped.
Из этих passes 30 — файлы со своим runner: внутри них 656 проверок; итог без
двойного счёта — 1731 passed, 0 failed, 5 skipped.
Первый запуск в sandbox дал 7 ошибок запуска Chromium; повтор вне sandbox прошёл.
Baseline E2E `photo-analysis.spec.js results-hero.spec.js`: 2 passed.

После изменений полный Node-набор: 1110 runner passes, 0 failures, 5 skipped;
с учётом тех же custom runners — 1736 passed, 0 failed, 5 skipped.
Новые 5 unit/integration проверок: физические LEFT/RIGHT, детерминизм,
сохранение mapping, ручные поправки, ошибки и tapered Canvas paths.

Промежуточные 2 E2E: 2 passed (реальный happy path и отказ renderer).
Мобильный screenshot `/tmp/lash-preview-mobile.png` просмотрен вручную;
использовано существующее синтетическое лицо happy-path-face.png.

Whole-file SHA guards обновлены только для намеренно изменённого index.html в
16 тестовых файлах. Domain/catalog/professional-library hashes не изменены.
Два точечных guard изменения: разрешены подписи нового PHOTO preview и его
withPhotoRuntime, при сохранении запретов для остальных потребителей.

Новые тесты:
- tests/photo-lash-preview.test.js
- tests/e2e/photo-lash-preview.spec.js

Изменённые guards:
- tests/photo-canonical.test.js
- tests/release-1-no-tryon.test.js
- tests/angel-professional-definition.test.js
- tests/anime-professional-definition.test.js
- tests/cat-fox-direction-strategy.test.js
- tests/cat-professional-definition.test.js
- tests/classic-professional-technique.test.js
- tests/doll-professional-definition.test.js
- tests/eyeliner-professional-definition.test.js
- tests/fox-professional-definition.test.js
- tests/jellyfish-professional-definition.test.js
- tests/kim-k-professional-definition.test.js
- tests/natural-professional-definition.test.js
- tests/professional-lash-library.test.js
- tests/ray-primitive-professional-definition.test.js
- tests/squirrel-professional-definition.test.js
- tests/wet-professional-definition.test.js
- tests/wispy-professional-definition.test.js

Профессиональные исходники lash-design-domain.js, professional-lash-library.js
и существующие функции анализа/проекции не редактировались.
Commit и deploy не выполнялись. Изменения, присутствовавшие до задачи (включая
 tests/e2e/lashmap-back-navigation.spec.js, backend/ и локальные фото), не затронуты.

## git diff --stat

Вывод для tracked-файлов; включает существовавшие до задачи +25 строк в
`tests/e2e/lashmap-back-navigation.spec.js`. Новые untracked-файлы Git сюда не включает.

```text
 index.html                                         | 85 ++++++++++++++++++++++
 tests/angel-professional-definition.test.js        |  2 +-
 tests/anime-professional-definition.test.js        |  2 +-
 tests/cat-fox-direction-strategy.test.js           |  2 +-
 tests/cat-professional-definition.test.js          |  2 +-
 tests/classic-professional-technique.test.js       |  2 +-
 tests/doll-professional-definition.test.js         |  2 +-
 tests/e2e/lashmap-back-navigation.spec.js          | 25 +++++++
 tests/eyeliner-professional-definition.test.js     |  2 +-
 tests/fox-professional-definition.test.js          |  2 +-
 tests/jellyfish-professional-definition.test.js    |  2 +-
 tests/kim-k-professional-definition.test.js        |  2 +-
 tests/natural-professional-definition.test.js      |  2 +-
 tests/photo-canonical.test.js                      |  7 +-
 tests/professional-lash-library.test.js            |  2 +-
 .../ray-primitive-professional-definition.test.js  |  2 +-
 tests/release-1-no-tryon.test.js                   |  5 +-
 tests/squirrel-professional-definition.test.js     |  2 +-
 tests/wet-professional-definition.test.js          |  2 +-
 tests/wispy-professional-definition.test.js        |  2 +-
 20 files changed, 135 insertions(+), 19 deletions(-)
```

Новые файлы этой задачи: `photo-lash-preview.js`,
`tests/photo-lash-preview.test.js`, `tests/e2e/photo-lash-preview.spec.js`,
`PHOTO-LASH-PREVIEW.md`.

## Финальная E2E-проверка

Команда из `tests/e2e`:

```sh
npm run e2e -- photo-lash-preview.spec.js photo-analysis.spec.js results-hero.spec.js photo-lash-map-mirror.spec.js live-scan-camera-retry.spec.js live-scan-video-presentation.spec.js
```

Результат: **13 passed (5.4m), 0 failed, retries: 0**.

- PHOTO preview: 3 passed — реальный upload/face-api/расчёт без моков; пиксели
  на обоих глазах; повторное открытие; совпадение Hero/Lash Map; настоящее
  перетаскивание ручной точки, неизменность длин и побитовый сброс Canvas;
  ошибки renderer; английский интерфейс и недоступное фото.
- PHOTO Analysis: 1 passed.
- Results Hero и сохранение правильного design ID: 1 passed.
- PHOTO Lash Map LEFT/RIGHT Fox/Cat: 2 passed.
- LIVE camera retry: 5 passed.
- LIVE video presentation/mirroring: 1 passed.

Только сценарии отказа используют fault injection, после реального анализа.
LIVE-тесты используют существующий synthetic camera stream; физический телефон
в этой сессии не проверялся. E2E viewport: 390×844, deviceScaleFactor: 3, Chromium.
`git diff --check`: passed.
