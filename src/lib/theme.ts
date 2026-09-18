// Brand-colour derivation shared by every menu template.
// Templates must never hardcode colours: they read these tokens so that any
// restaurant colour stays legible instead of producing white-on-yellow text.

export interface ThemeTokens {
  brand: string
  /** Text colour that stays readable when placed on top of `brand`. */
  brandInk: string
  /** Darker brand shade for depth, headers and gradients. */
  brandStrong: string
  /** Very light brand wash for surfaces and chips. */
  brandTint: string
  /** Secondary hue derived from the brand, for gradients and highlights. */
  accent: string
  /** True when the brand colour itself is light enough to need dark text. */
  isLight: boolean
  /** rgba() of the brand colour at an arbitrary alpha. */
  alpha: (value: number) => string
  /** rgba() of the readable ink colour at an arbitrary alpha. */
  inkAlpha: (value: number) => string
}

type Rgb = [number, number, number]

const FALLBACK: Rgb = [23, 63, 53]

function clampChannel(value: number) {
  return Math.min(255, Math.max(0, Math.round(value)))
}

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '').trim()
  const full = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean
  if (full.length < 6) return FALLBACK
  const value = Number.parseInt(full.slice(0, 6), 16)
  return Number.isNaN(value) ? FALLBACK : [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

export function rgbToHex([red, green, blue]: Rgb) {
  return `#${[red, green, blue].map((channel) => clampChannel(channel).toString(16).padStart(2, '0')).join('')}`
}

/** Blend `from` toward `to`; amount 0 keeps `from`, amount 1 returns `to`. */
function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount,
  ]
}

function rgbToHsl([red, green, blue]: Rgb) {
  const r = red / 255, g = green / 255, b = blue / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  if (max === min) return { hue: 0, saturation: 0, lightness }
  const delta = max - min
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  const hue = max === r
    ? ((g - b) / delta + (g < b ? 6 : 0))
    : max === g
      ? (b - r) / delta + 2
      : (r - g) / delta + 4
  return { hue: (hue * 60 + 360) % 360, saturation, lightness }
}

function hslToRgb(hue: number, saturation: number, lightness: number): Rgb {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const secondary = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const match = lightness - chroma / 2
  const [r, g, b] = hue < 60 ? [chroma, secondary, 0]
    : hue < 120 ? [secondary, chroma, 0]
      : hue < 180 ? [0, chroma, secondary]
        : hue < 240 ? [0, secondary, chroma]
          : hue < 300 ? [secondary, 0, chroma]
            : [chroma, 0, secondary]
  return [(r + match) * 255, (g + match) * 255, (b + match) * 255]
}

/**
 * YIQ brightness, matching the threshold the original footer palette was tuned
 * against so existing menus keep their current contrast decisions.
 */
function isLightColour([red, green, blue]: Rgb) {
  return (red * 299 + green * 587 + blue * 114) / 1000 > 165
}

export function deriveTheme(primaryColor: string): ThemeTokens {
  const rgb = hexToRgb(primaryColor)
  const light = isLightColour(rgb)
  const ink: Rgb = light ? [24, 51, 45] : [255, 255, 255]
  const { hue, saturation, lightness } = rgbToHsl(rgb)

  return {
    brand: rgbToHex(rgb),
    brandInk: rgbToHex(ink),
    brandStrong: rgbToHex(mix(rgb, [0, 0, 0], 0.34)),
    brandTint: rgbToHex(mix(rgb, [255, 255, 255], 0.88)),
    // Nudge the hue rather than inverting it, so the accent still reads as the
    // same brand family instead of fighting it.
    accent: rgbToHex(hslToRgb((hue + 38) % 360, Math.min(1, saturation + 0.12), Math.min(0.72, Math.max(0.42, lightness + 0.1)))),
    isLight: light,
    alpha: (value: number) => `rgba(${clampChannel(rgb[0])},${clampChannel(rgb[1])},${clampChannel(rgb[2])},${value})`,
    inkAlpha: (value: number) => `rgba(${clampChannel(ink[0])},${clampChannel(ink[1])},${clampChannel(ink[2])},${value})`,
  }
}
