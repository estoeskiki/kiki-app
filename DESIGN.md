# KIKI — Color Palette

## Primary
| Name        | Hex       | Usage                                      |
|-------------|-----------|--------------------------------------------|
| Primary     | `#ccff00` | Lime green — CTAs, headlines accent, glows |
| On Primary  | `#000000` | Text on top of primary color               |

## Accent Colors
| Name      | Hex       | Usage                                         |
|-----------|-----------|-----------------------------------------------|
| Secondary | `#ff6b98` | Hot pink — emotional highlights, final CTA    |
| Tertiary  | `#00f0ff` | Cyan — tech features, third accent            |

## Surfaces (Dark Theme)
| Name                  | Hex       | Usage                                      |
|-----------------------|-----------|--------------------------------------------|
| Surface / Background  | `#060e1d` | Main page background                       |
| Surface Container     | `#0f192c` | Cards, bento tiles, elevated surfaces      |
| Surface Container Low | `#0a1324` | Subtle depth layer between surfaces        |

## Text
| Name               | Hex       | Usage                          |
|--------------------|-----------|--------------------------------|
| On Surface         | `#dde5fb` | Primary text on dark bg        |
| On Surface Variant | `#a3abc0` | Secondary / muted text         |
| Outline Variant    | `#40485a` | Borders, dividers              |

## Special
| Name                | Hex       | Usage                                        |
|---------------------|-----------|----------------------------------------------|
| Secondary Container | `#bb0058` | Deep magenta — bento card bg (staffing card) |
| Footer BG           | `#ccff00` | Same as primary — full lime green footer     |
| Footer Text         | `#060d1c` | Near-black on lime footer background         |

---

## Typography

### Fonts
| Role             | Tailwind class   | Font          | Weights used |
|------------------|------------------|---------------|--------------|
| Headlines (`h1`–`h4`) | `font-headline` | Space Grotesk | 900 (`font-black`) primarily; range 300–900 |
| Body / UI        | `font-body`      | Syne          | 400 (`font-normal`), 600 (`font-semibold`), 700 (`font-bold`) |
| Labels / Eyebrows | `font-label`    | Syne          | 700 (`font-bold`) |

### Letter Spacing
| Usage                                  | Tailwind class         | Value (~CSS)          |
|----------------------------------------|------------------------|-----------------------|
| Big display headlines                  | `tracking-tighter`     | `-0.05em`             |
| Section headlines                      | `tracking-tight`       | `-0.025em`            |
| Nav links, body text                   | *(default)*            | `0`                   |
| CTA buttons, eyebrow labels            | `tracking-widest`      | `0.1em`               |
| Special label (social proof belt)      | `tracking-[0.5em]`     | `0.5em`               |
| Final CTA button                       | `tracking-[0.15em]`    | `0.15em`              |

### Line Height
| Usage                            | Tailwind class      | Value       |
|----------------------------------|---------------------|-------------|
| Display / hero headlines         | `leading-[0.86]` / `leading-[0.85]` | 0.85–0.86 (tight display) |
| Scroll-phrase big type           | `leading-none`      | `1`         |
| Bento card headlines             | `leading-none`      | `1`         |
| Body paragraphs                  | `leading-relaxed`   | `1.625`     |

### Text Transform
| Usage                                     | Class        |
|-------------------------------------------|--------------|
| Nav links, CTA buttons, eyebrow labels    | `uppercase`  |
| Bento card headlines, scroll phrases      | `uppercase`  |
| Body copy                                 | *(none)*     |

### Type Scale (key sizes)
| Role                        | Mobile          | Desktop           |
|-----------------------------|-----------------|-------------------|
| Hero headline               | `text-5xl` (3rem) | `text-7xl` (4.5rem) |
| Section headline            | `text-5xl` (3rem) | `text-7xl`–`text-8xl` |
| Final CTA headline          | `text-5xl` (3rem) | `text-8xl` (6rem) |
| Stat numbers (−70%, etc.)   | `text-6xl` (3.75rem) | `text-6xl`      |
| Bento card title            | `text-2xl`–`text-4xl` | same          |
| Body / paragraph            | `text-base`–`text-xl` | same          |
| Eyebrow / label             | `text-xs` (0.75rem) | same            |
| Nav logo wordmark           | `text-2xl`      | `text-2xl`        |

---

## Glow Effects
| Name              | Value                                               |
|-------------------|-----------------------------------------------------|
| Primary text glow | `text-shadow: 0 0 18px rgba(204,255,0,0.4), 0 0 48px rgba(204,255,0,0.12)` |
| Secondary text glow | `text-shadow: 0 0 14px rgba(255,107,152,0.4), 0 0 40px rgba(255,107,152,0.12)` |
| Primary button glow | `box-shadow: 0 0 14px rgba(204,255,0,0.22), 0 0 36px rgba(204,255,0,0.08)` |
