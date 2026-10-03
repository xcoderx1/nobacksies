/**
 * Generates every Jarold asset from one shared drawing: stickers, comic panels,
 * cast portraits, the logo and the banner.
 *
 * Render to PNG with tools/render.sh (headless Chrome, so the webfont bakes in).
 */
import { writeFileSync, mkdirSync } from 'node:fs'
const ROOT = new URL('../docs/assets/', import.meta.url)
for (const d of ['stickers/', 'comic/', 'cast/', '']) mkdirSync(new URL(d, ROOT), { recursive: true })

const INK = '#13243B', SUN = '#FFD43B', RED = '#FF5A5F', GLASS = '#E8F6FF',
      PAPER = '#fff', SKIN = '#FFC9A3', GRASS = '#5BD17A', SKY = '#7CC6FF'

/** A mitten hand, so an arm end reads as a hand and not a stub. */
const mitten = (x, y, rot = 0, s = 1) => `<g transform="translate(${x},${y}) rotate(${rot}) scale(${s})">
  <ellipse cx="0" cy="0" rx="21" ry="18" fill="${SKIN}" stroke="${INK}" stroke-width="6"/>
  <ellipse cx="-3" cy="-15" rx="9" ry="11" fill="${SKIN}" stroke="${INK}" stroke-width="5"/></g>`

/** Jarold. eyes: angry|closed|side|flat. arms: cross|hug|shrug|stamp|point */
export function jarold({ x = 0, y = 0, s = 1, eyes = 'angry', arms = 'cross', coins = 7 } = {}) {
  const coinRows = []
  for (let i = 0; i < coins; i++) {
    const cy = 330 - i * 20, n = i % 2 ? 3 : 4, off = i % 2 ? 26 : 0
    for (let j = 0; j < n; j++) coinRows.push(`<ellipse cx="${132 + off + j * 52 + ((i * 7 + j * 11) % 11) - 5}" cy="${cy}" rx="25" ry="10" fill="${SUN}" stroke="${INK}" stroke-width="4"/>`)
  }
  const eye = {
    angry: `<ellipse cx="168" cy="196" rx="26" ry="29" fill="${PAPER}" stroke="${INK}" stroke-width="6"/><ellipse cx="256" cy="196" rx="26" ry="29" fill="${PAPER}" stroke="${INK}" stroke-width="6"/>
            <circle cx="175" cy="205" r="11" fill="${INK}"/><circle cx="249" cy="205" r="11" fill="${INK}"/>
            <path d="M132 160 L200 177" stroke="${INK}" stroke-width="11" stroke-linecap="round"/><path d="M292 160 L224 177" stroke="${INK}" stroke-width="11" stroke-linecap="round"/>
            <path d="M184 246 Q212 236 240 248" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`,
    closed: `<path d="M142 198 Q168 176 194 198" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M230 198 Q256 176 282 198" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
             <path d="M184 240 Q212 262 240 240" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>`,
    side:   `<ellipse cx="168" cy="196" rx="26" ry="29" fill="${PAPER}" stroke="${INK}" stroke-width="6"/><ellipse cx="256" cy="196" rx="26" ry="29" fill="${PAPER}" stroke="${INK}" stroke-width="6"/>
             <circle cx="186" cy="200" r="11" fill="${INK}"/><circle cx="268" cy="200" r="11" fill="${INK}"/>
             <path d="M132 162 L200 174" stroke="${INK}" stroke-width="11" stroke-linecap="round"/><path d="M292 162 L224 174" stroke="${INK}" stroke-width="11" stroke-linecap="round"/>
             <path d="M182 248 L242 244" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`,
    flat:   `<ellipse cx="168" cy="196" rx="26" ry="29" fill="${PAPER}" stroke="${INK}" stroke-width="6"/><ellipse cx="256" cy="196" rx="26" ry="29" fill="${PAPER}" stroke="${INK}" stroke-width="6"/>
             <circle cx="170" cy="200" r="11" fill="${INK}"/><circle cx="254" cy="200" r="11" fill="${INK}"/>
             <path d="M136 166 L198 166" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M288 166 L226 166" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
             <path d="M184 246 L240 246" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`,
  }[eyes]

  const sleeve = (d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="20" stroke-linecap="round"/>
                         <path d="${d}" fill="none" stroke="${SKIN}" stroke-width="10" stroke-linecap="round"/>`
  const arm = {
    // folded: each forearm ends in a mitten resting on the opposite arm
    // forearms reach ACROSS so each mitten rests near the opposite shoulder --
    // hands at the outer thirds is what reads as folded arms
    cross: sleeve('M80 306 Q170 262 300 282') + sleeve('M344 306 Q254 262 124 282')
         + mitten(124, 284, -18) + mitten(300, 284, 18),
    hug:   sleeve('M78 290 Q150 350 212 330') + sleeve('M346 290 Q274 350 212 330')
         + mitten(206, 332, -8) + mitten(236, 326, 10),
    shrug: sleeve('M78 268 Q50 320 86 346') + sleeve('M346 268 Q374 320 338 346')
         + mitten(84, 352, 18) + mitten(340, 352, -18),
    stamp: sleeve('M78 300 Q140 280 196 300') + sleeve('M346 290 Q392 232 372 170')
         + mitten(196, 302, 10) + mitten(372, 164, -8),
    point: sleeve('M78 300 Q140 282 196 300') + sleeve('M346 292 Q408 282 452 262')
         + mitten(196, 302, 10),
  }[arms]

  return `<g transform="translate(${x},${y}) scale(${s})">
    <ellipse cx="212" cy="396" rx="140" ry="16" fill="${INK}" opacity=".16"/>
    <rect x="96" y="120" width="232" height="256" rx="40" fill="${GLASS}" stroke="${INK}" stroke-width="8"/>
    <g clip-path="url(#jarclip)">${coinRows.join('')}</g>
    <rect x="96" y="120" width="232" height="256" rx="40" fill="none" stroke="${INK}" stroke-width="8"/>
    <path d="M122 150 Q114 230 122 300" stroke="#fff" stroke-width="12" stroke-linecap="round" fill="none" opacity=".85"/>
    <rect x="110" y="78" width="204" height="48" rx="12" fill="${RED}" stroke="${INK}" stroke-width="8"/>
    <path d="M190 72 V48 a22 22 0 0 1 44 0 V72" fill="none" stroke="${INK}" stroke-width="10"/>
    <rect x="180" y="66" width="64" height="50" rx="9" fill="${SUN}" stroke="${INK}" stroke-width="6"/>
    <circle cx="212" cy="88" r="7" fill="${INK}"/><rect x="209" y="90" width="7" height="15" fill="${INK}"/>
    <rect x="122" y="146" width="180" height="118" rx="20" fill="#fff" stroke="${INK}" stroke-width="6" transform="rotate(-3 212 205)"/>
    ${eye}${arm}
  </g>`
}

export function kid({ x, y, s = 1, mood = 'happy', colour = GRASS, arms = 'reach' }) {
  const face = mood === 'cry'
    ? `<circle cx="84" cy="70" r="8" fill="${INK}"/><circle cx="140" cy="70" r="8" fill="${INK}"/>
       <path d="M84 84 Q80 118 74 136" stroke="${SKY}" stroke-width="11" stroke-linecap="round" fill="none"/>
       <path d="M140 84 Q144 118 150 136" stroke="${SKY}" stroke-width="11" stroke-linecap="round" fill="none"/>
       <path d="M92 112 Q112 94 132 112" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
       <path d="M64 44 L100 54" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
       <path d="M160 44 L124 54" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>`
    : `<circle cx="84" cy="70" r="9" fill="${INK}"/><circle cx="140" cy="70" r="9" fill="${INK}"/>
       <path d="M88 108 Q112 130 136 108" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>`
  const limb = arms === 'reach'
    ? `<path d="M48 222 Q4 200 10 160" fill="none" stroke="${INK}" stroke-width="22" stroke-linecap="round"/>
       <path d="M176 222 Q220 200 214 160" fill="none" stroke="${INK}" stroke-width="22" stroke-linecap="round"/>
       <path d="M48 222 Q4 200 10 160" fill="none" stroke="${SKIN}" stroke-width="12" stroke-linecap="round"/>
       <path d="M176 222 Q220 200 214 160" fill="none" stroke="${SKIN}" stroke-width="12" stroke-linecap="round"/>
       ${mitten(10, 150, -20, .85)}${mitten(214, 150, 20, .85)}`
    : arms === 'droop'
    ? `<path d="M48 214 Q12 250 22 288" fill="none" stroke="${INK}" stroke-width="22" stroke-linecap="round"/>
       <path d="M176 214 Q212 250 202 288" fill="none" stroke="${INK}" stroke-width="22" stroke-linecap="round"/>
       <path d="M48 214 Q12 250 22 288" fill="none" stroke="${SKIN}" stroke-width="12" stroke-linecap="round"/>
       <path d="M176 214 Q212 250 202 288" fill="none" stroke="${SKIN}" stroke-width="12" stroke-linecap="round"/>
       ${mitten(22, 296, 8, .85)}${mitten(202, 296, -8, .85)}`
    : ''
  return `<g transform="translate(${x},${y}) scale(${s})">
    <ellipse cx="112" cy="306" rx="86" ry="14" fill="${INK}" opacity=".16"/>
    ${limb}
    <rect x="46" y="166" width="132" height="124" rx="26" fill="${colour}" stroke="${INK}" stroke-width="9"/>
    <circle cx="112" cy="76" r="68" fill="${SKIN}" stroke="${INK}" stroke-width="9"/>
    <path d="M52 44 Q112 -2 172 44" fill="#8B5A3C" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/>
    ${face}</g>`
}

export const DEFS = `<defs><clipPath id="jarclip"><rect x="96" y="120" width="232" height="256" rx="40"/></clipPath></defs>`
export const svg = (w, h, inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${DEFS}${inner}</svg>`
export const label = (t, y, size = 54, cx = 256) => `<text x="${cx}" y="${y}" text-anchor="middle" font-family="Lilita One" font-size="${size}" fill="${PAPER}" stroke="${INK}" stroke-width="9" paint-order="stroke" letter-spacing="1">${t}</text>`
export { INK, SUN, RED, GLASS, PAPER, SKIN, GRASS, SKY, mitten }
