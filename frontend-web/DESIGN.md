# Kampasy design system

The design language of Kampasy, school management for Bangladesh. It was taken from the landing page and is implemented as shadcn/ui (`base-nova`, Base UI) theme tokens in `src/app/globals.css` and the component variants in `src/components/ui/`. You can see it at `/design-system`.

## Personality

A school register, done properly. It should feel calm, trustworthy and quick on a slow phone. Use paper surfaces on a canvas desk, forest green ink, and one warm marigold mark for the action that matters. Copy is plain and specific, with real names, taka amounts and times instead of filler. Bangla and English sit side by side in the same typeface.

## Colors

Components use **role tokens** (`bg-primary`, `text-muted-foreground`, …), never the raw palette.

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` | canvas `#f4f5f1` | navy `oklch(0.16 0.025 255)` | Page floor |
| `foreground` | ink `#12271e` | warm off-white `oklch(0.95 0.01 85)` | Headlines, body |
| `card` / `popover` | paper `#ffffff` | `oklch(0.2 0.03 255)` | Cards, menus, dialogs |
| `primary` | forest-2 `#1d5a43` | green `oklch(0.7 0.13 160)` (navy text) | The main action |
| `primary-hover` | forest-hover `#174a37` | `oklch(0.76 0.12 160)` | Primary hover |
| `secondary`, `muted`, `accent` | mint `#e5eee8` | `oklch(0.25 0.03 255)`; accent `oklch(0.28 0.035 255)` with off-white text | Tinted fills, ghost hover, soft bands |
| `muted-foreground` | ink-2 `#46564e` | `oklch(0.7 0.03 255)` | Descriptions |
| `subtle-foreground` | ink-3 `#6b7a72` | `oklch(0.62 0.03 255)` | Captions, meta (large or non-essential text) |
| `highlight` | marigold `#f0b24a` | green, like primary (no gold fills in dark) | The one key action on a forest surface |
| `success` / `success-tint` | forest-2 / mint | `oklch(0.62 0.14 155)` / accent 60% | Present, paid |
| `warning` / `warning-tint` | `#7a4d07` / `#fcefd6` | `oklch(0.84 0.13 80)` / marigold 14% | Late, due soon |
| `destructive` / `destructive-tint` | red `#c2412d` / `#fbe8e4` | `oklch(0.7 0.17 27)` / 14% | Absent, overdue, errors |
| `band` | forest `#143f30` | deep navy `oklch(0.11 0.02 255)` (scoped bands in light keep forest) | Dark marketing bands, featured cards |
| `border` / `input` | line `#dfe5e0` / `#c9d3cc` | white 10% / 12% | Hairlines, field borders |
| `ring` | forest-2 | primary green | Focus |

The dark theme uses deep navy surfaces with warm off-white text, the calm, low-chroma base of study and classroom tools. Brand green is the primary action, and marigold stays a small accent, never a button fill. Every text pair passes WCAG AA. The theme toggle in the header (`components/theme-toggle.tsx`) sets `.dark` on `<html>` and saves the choice in `localStorage` (`kampasy-theme`). When nothing is saved, the system preference applies. An inline script in `app/layout.tsx` (`lib/theme.ts`) applies it before first paint. `.dark` also remaps the raw surface, ink and line palette, so landing classes like `bg-paper` follow it. Whole-page dark mode (`:root.dark`) also turns `forest` bands into deep navy. Put `className="dark"` on a forest band or a featured card to render the components inside it with the dark tokens in either theme.

## Typography

There is one family, **Anek Bangla** (variable, `wdth` axis), for both Bangla and English. Display sizes use it at width 75 and weight 800.

| Utility | Spec | Use |
| --- | --- | --- |
| `type-display-xl` | 57.6 → 89.6px / 0.98 / 800 / -0.015em | Hero headline |
| `type-display-lg` | 41.6 → 60px / 0.98 / 800 / -0.015em | Section heads |
| `type-display-md` | 44px / 1 / 800 | Prices, key figures |
| `type-title-lg` | 24px / 1.2 / 700 | Page titles in the app |
| `type-title` | 20px / 1.3 / 600 | Card and plan names |
| `type-lead` | 18 → 20px / 1.65 | Intro paragraphs |
| `type-body` | 15px / 1.6 | Running text, lists |
| `type-eyebrow` | 15px / 600 | Labels above section heads (`text-primary`) |
| `type-label` | 14px / 500 | Field labels, table heads |
| `type-caption` | 12px / 1.45 | Meta, timestamps |
| `type-numeral` | tabular, 600 | Money, roll numbers, counts |

Use `type-*` utilities, not `text-[size]` theme keys, because `cn()` treats unknown `text-*` classes as colors.

## Shape

| Class | Value | Used by |
| --- | --- | --- |
| `rounded-sm` | 4px | Checkboxes, small accents |
| `rounded-md` | 6px | Menu, select and command items |
| `rounded-lg` | 10px | Inputs, selects, tabs, popovers, menus |
| `rounded-xl` | 12px | Icon tiles, dialogs, command |
| `rounded-2xl` | 16px | Cards, pricing tiers, toasts |
| `rounded-3xl` | 24px | Product mockups, hero containers |
| `rounded-full` / `rounded-4xl` | pill | Buttons, badges, avatars |

## Elevation

Surfaces sit on hairline rings (`ring-1 ring-border`), not shadows. Shadows are only for things that float:

- Flat: canvas, bands.
- Hairline: cards and fields (`shadow-xs` is none).
- `shadow-md`: popovers, menus.
- `shadow-lg` / `shadow-xl`: dialogs, floating notes.
- `shadow-feature`: the featured pricing tier only.

## Controls

- Button heights are 28 (`xs`), 32 (`sm`), **40 (default)** and 48px (`lg`). They are pills with semibold 15px labels. Field controls (Input, Select, NativeSelect, InputGroup, Toggle, Tabs, InputOTP, Menubar) match the 40px default.
- Button variants:
  - `default`: forest primary.
  - `highlight`: marigold, for the key action on forest.
  - `outline`: paper with a strong hairline, for secondary actions.
  - `secondary`: mint.
  - `ghost`.
  - `destructive`: red tint.
  - `link`.
- Badge variants are `default`, `secondary`, `outline`, `highlight`, `success`, `warning`, `destructive`, `ghost` and `link`.
- Focus is a 2px `ring` outline with a 3px offset on actions. Fields keep a 3px `ring/50` halo.

## Motion

| Token | Value | Use |
| --- | --- | --- |
| `animate-rise` | 600ms, `cubic-bezier(0.2,0.7,0.2,1)`, 12px up | Hero and section entrances |
| `animate-fade` | 200ms ease-out | Value changes in mockups |
| Hover | 150–200ms colors, arrow nudges 2px | CTAs |

All motion is disabled under `prefers-reduced-motion`.

## Do's and Don'ts

- **Do** use one primary action per group, with `outline` for the rest.
- **Do** keep marigold for the single most important action on a forest surface. **Don't** use it on canvas or paper, and don't use it for decoration.
- **Do** keep red for absences, dues and errors. **Don't** use it for emphasis.
- **Do** use real content: student names, taka amounts and times, in Bangla where the user would read Bangla. **Don't** use lorem ipsum.
- **Don't** add shadows to cards. Use the hairline ring.
- **Don't** use radii outside the scale, or square buttons outside a `ButtonGroup`.
- **Don't** write `dark:` color overrides. Use role tokens and scope dark bands with `.dark`.

## Known gaps

- `subtle-foreground` on `muted` is about 4:1. Keep it for captions and large text.
- The landing page sections still use some raw palette classes (`bg-forest`, `text-ink-2`). They will move to role tokens as those sections are next touched.
