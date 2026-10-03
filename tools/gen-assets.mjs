import { writeFileSync } from 'node:fs'
import { jarold, kid, svg, label, INK, SUN, RED, PAPER, SKIN, GRASS, SKY } from './gen-art.mjs'
const OUT = new URL('../docs/assets/', import.meta.url)
const w = (p, s) => { writeFileSync(new URL(p, OUT), s); console.log('  ', p) }

/* ---------------- stickers (512) ---------------- */
const S = {}
S['01-no-backsies'] = svg(512,512,`${jarold({x:24,y:54,s:.86,eyes:'angry',arms:'stamp'})}
  <g transform="rotate(-12 378 128)"><rect x="306" y="86" width="150" height="80" rx="12" fill="${RED}" stroke="${INK}" stroke-width="8"/>
  <text x="381" y="140" text-anchor="middle" font-family="Lilita One" font-size="38" fill="#fff">NOPE</text></g>
  ${label('NO BACKSIES',480,56)}`)
S['02-lives-here-now'] = svg(512,512,`${jarold({x:24,y:48,s:.86,eyes:'closed',arms:'hug'})}${label('it lives here now',482,44)}`)
S['03-refund-no'] = svg(512,512,`${jarold({x:-6,y:60,s:.76,eyes:'flat',arms:'cross'})}
  <g transform="translate(286,88)">
    <g transform="rotate(-11 70 150)"><path d="M0 0 h72 v212 h-72 z" fill="#fff" stroke="${INK}" stroke-width="7"/>
      <text x="36" y="40" text-anchor="middle" font-family="Lilita One" font-size="19" fill="${INK}">RE</text>
      <path d="M12 72 h48 M12 98 h48 M12 124 h30" stroke="${INK}" stroke-width="6" stroke-linecap="round"/></g>
    <g transform="rotate(14 150 150) translate(88,0)"><path d="M0 0 h72 v212 h-72 z" fill="#fff" stroke="${INK}" stroke-width="7"/>
      <text x="36" y="40" text-anchor="middle" font-family="Lilita One" font-size="19" fill="${INK}">FUND</text>
      <path d="M12 72 h48 M12 98 h48 M12 124 h44" stroke="${INK}" stroke-width="6" stroke-linecap="round"/></g>
  </g>${label('no.',486,72)}`)
S['04-can-i-have-it-back'] = svg(512,512,`${kid({x:142,y:96,s:1.05,mood:'cry',colour:'#FF9AA2',arms:'reach'})}${label('can i have it back',488,42)}`)
S['05-locked-forever'] = svg(512,512,`${jarold({x:24,y:40,s:.84,eyes:'flat',arms:'cross'})}
  <g transform="translate(330,250) scale(1.5)"><path d="M14 26 V14 a16 16 0 0 1 32 0 V26" fill="none" stroke="${INK}" stroke-width="9"/>
   <rect x="2" y="24" width="56" height="44" rx="9" fill="${SUN}" stroke="${INK}" stroke-width="7"/>
   <circle cx="30" cy="42" r="6" fill="${INK}"/><rect x="27" y="44" width="6" height="13" fill="${INK}"/></g>
  ${label("it's locked. forever.",486,38)}`)
S['06-pinky-swear'] = svg(512,512,`<g transform="translate(0,20)">
    <g transform="translate(52,0) rotate(-14 130 220)">
      <path d="M46 176 q0 -34 40 -34 h58 q34 0 34 38 v62 q0 38 -34 38 h-58 q-40 0 -40 -34 z" fill="${SKIN}" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/>
      <path d="M86 142 q18 -16 34 0 q18 -16 34 0" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
      <path d="M96 196 h74 M96 228 h74" stroke="${INK}" stroke-width="7" opacity=".4" stroke-linecap="round"/>
      <path d="M178 182 q46 -6 54 24 q8 30 -16 42" fill="none" stroke="${INK}" stroke-width="42" stroke-linecap="round"/>
      <path d="M178 182 q46 -6 54 24 q8 30 -16 42" fill="none" stroke="${SKIN}" stroke-width="27" stroke-linecap="round"/></g>
    <g transform="translate(-52,0) rotate(14 382 220)">
      <path d="M466 176 q0 -34 -40 -34 h-58 q-34 0 -34 38 v62 q0 38 34 38 h58 q40 0 40 -34 z" fill="#EFAE85" stroke="${INK}" stroke-width="9" stroke-linejoin="round"/>
      <path d="M426 142 q-18 -16 -34 0 q-18 -16 -34 0" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
      <path d="M342 196 h74 M342 228 h74" stroke="${INK}" stroke-width="7" opacity=".4" stroke-linecap="round"/>
      <path d="M334 258 q-46 6 -54 -24 q-8 -30 16 -42" fill="none" stroke="${INK}" stroke-width="42" stroke-linecap="round"/>
      <path d="M334 258 q-46 6 -54 -24 q-8 -30 16 -42" fill="none" stroke="#EFAE85" stroke-width="27" stroke-linecap="round"/></g>
    <g transform="translate(52,0) rotate(-14 130 220)">
      <path d="M216 190 q22 8 16 32 q-6 26 -28 26" fill="none" stroke="${INK}" stroke-width="42" stroke-linecap="round"/>
      <path d="M216 190 q22 8 16 32 q-6 26 -28 26" fill="none" stroke="${SKIN}" stroke-width="27" stroke-linecap="round"/></g>
  </g>${label('pinky swear.',432,46)}${label('no backsies.',486,46)}`)
S['07-wait-your-turn'] = svg(512,512,`${jarold({x:-34,y:70,s:.74,eyes:'side',arms:'cross'})}
  <g transform="translate(306,176)">
    <rect x="0" y="40" width="130" height="112" rx="16" fill="#9AA6B5" stroke="${INK}" stroke-width="8"/>
    <rect x="22" y="66" width="86" height="42" rx="8" fill="${INK}"/>
    <circle cx="46" cy="87" r="9" fill="${RED}"/><circle cx="84" cy="87" r="9" fill="${RED}"/>
    <path d="M30 40 V16 M100 40 V16" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>
    <circle cx="30" cy="10" r="9" fill="${SUN}" stroke="${INK}" stroke-width="6"/><circle cx="100" cy="10" r="9" fill="${SUN}" stroke="${INK}" stroke-width="6"/>
    <path d="M24 128 h82" stroke="#fff" stroke-width="7" stroke-linecap="round"/></g>
  ${label('wait your turn',480,46)}`)
S['08-you-put-it-in'] = svg(512,512,`${jarold({x:24,y:42,s:.84,eyes:'flat',arms:'shrug'})}${label('you put it in.',428,44)}${label('it stays in.',480,44)}`)
for (const [n,s] of Object.entries(S)) w(`stickers/${n}.svg`, s)

/* ---------------- comic (420x500) ---------------- */
const PANEL = (inner, cap) => svg(420,500,`
<rect x="4" y="4" width="412" height="492" rx="26" fill="#EAF6FF" stroke="${INK}" stroke-width="8"/>${inner}
<rect x="22" y="404" width="376" height="72" rx="16" fill="#fff" stroke="${INK}" stroke-width="7"/>
<text x="210" y="450" text-anchor="middle" font-family="Lilita One" font-size="${cap.length>24?25:31}" fill="${INK}">${cap}</text>`)
w('comic/comic-1.svg', PANEL(`${jarold({x:96,y:20,s:.64,eyes:'flat',arms:'cross',coins:3})}
  ${kid({x:16,y:118,s:.56,mood:'happy',colour:'#FF9AA2',arms:'reach'})}
  <circle cx="168" cy="76" r="20" fill="${SUN}" stroke="${INK}" stroke-width="7"/>
  <path d="M176 96 q28 22 36 48" fill="none" stroke="${INK}" stroke-width="6" stroke-dasharray="7 9" stroke-linecap="round"/>`, 'here you go!'))
w('comic/comic-2.svg', PANEL(`${jarold({x:96,y:20,s:.64,eyes:'side',arms:'cross',coins:4})}
  ${kid({x:16,y:118,s:.56,mood:'happy',colour:'#FF9AA2',arms:'reach'})}
  <path d="M138 190 q40 -30 78 -12" fill="none" stroke="${INK}" stroke-width="7" stroke-dasharray="9 10" stroke-linecap="round"/>
  <path d="M216 178 l-18 -7 m18 7 l-14 14" stroke="${INK}" stroke-width="7" stroke-linecap="round" fill="none"/>`, 'actually… can i have that back'))
// panel 3: Jarold immovable, Tim crushed in the corner
w('comic/comic-3.svg', PANEL(`${jarold({x:118,y:12,s:.68,eyes:'angry',arms:'cross',coins:5})}
  ${kid({x:-6,y:150,s:.62,mood:'cry',colour:'#FF9AA2',arms:'droop'})}
  <path d="M86 92 l14 26 M342 92 l-14 26 M214 48 v24" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>`, 'NO BACKSIES.'))

/* ---------------- cast (420) ---------------- */
const P = (inner) => svg(420,420,inner)
w('cast/cast-jarold.svg', P(jarold({x:4,y:6,s:.95,eyes:'angry',arms:'cross'})))
w('cast/cast-tim.svg',    P(kid({x:92,y:36,s:1.08,mood:'cry',colour:'#FF9AA2',arms:'reach'})))
w('cast/cast-lenny.svg',  P(`<ellipse cx="210" cy="372" rx="110" ry="16" fill="${INK}" opacity=".16"/>
  <rect x="96" y="150" width="228" height="196" rx="26" fill="#9AA6B5" stroke="${INK}" stroke-width="9"/>
  <rect x="134" y="192" width="152" height="76" rx="12" fill="${INK}"/>
  <circle cx="176" cy="230" r="17" fill="${RED}"/><circle cx="244" cy="230" r="17" fill="${RED}"/>
  <path d="M140 150 V104 M280 150 V104" stroke="${INK}" stroke-width="10" stroke-linecap="round"/>
  <circle cx="140" cy="92" r="16" fill="${SUN}" stroke="${INK}" stroke-width="8"/><circle cx="280" cy="92" r="16" fill="${SUN}" stroke="${INK}" stroke-width="8"/>
  <path d="M138 302 h144" stroke="#fff" stroke-width="10" stroke-linecap="round"/>
  <path d="M70 250 q-26 26 0 52" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>
  <path d="M350 250 q26 26 0 52" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>`))
w('cast/cast-tilda.svg', P(`<ellipse cx="210" cy="376" rx="120" ry="16" fill="${INK}" opacity=".16"/>
  <rect x="112" y="150" width="196" height="212" rx="18" fill="${PAPER}" stroke="${INK}" stroke-width="9"/>
  <rect x="112" y="150" width="196" height="46" rx="12" fill="${GRASS}" stroke="${INK}" stroke-width="9"/>
  <text x="210" y="184" text-anchor="middle" font-family="Lilita One" font-size="30" fill="${INK}">TOLL</text>
  <rect x="142" y="222" width="136" height="74" rx="10" fill="${SUN}" stroke="${INK}" stroke-width="7"/>
  <text x="210" y="252" text-anchor="middle" font-family="Lilita One" font-size="25" fill="${INK}">10%</text>
  <text x="210" y="284" text-anchor="middle" font-family="Lilita One" font-size="21" fill="${INK}">then 1%</text>
  <circle cx="210" cy="104" r="40" fill="${SKIN}" stroke="${INK}" stroke-width="9"/>
  <circle cx="196" cy="100" r="6" fill="${INK}"/><circle cx="224" cy="100" r="6" fill="${INK}"/>
  <path d="M196 120 q14 12 28 0" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
  <path d="M172 76 q38 -26 76 0" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
  <path d="M40 318 h72" stroke="${RED}" stroke-width="14" stroke-linecap="round"/>
  <path d="M308 318 h72" stroke="${RED}" stroke-width="14" stroke-linecap="round"/>`))

/* ---------------- logo + banner ----------------
   NOT generated. docs/assets/logo.png and banner.png are the original supplied
   brand art and are the source of truth. An earlier version of this file
   regenerated them from jarold(), which overwrote them; restored from fc581d2
   and deliberately left out. Do not add them back here -- re-running this
   script must never touch them. */
