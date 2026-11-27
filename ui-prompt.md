# UI prompt: the Northlight "Field Journal" redesign

Redesign the whole Northlight Studio site (home page plus the help desk, CRM, staff, automation, settings and troubleshooting pages) as one visual system called **Field Journal**: the pages of an expedition logbook kept by a polar team. Keep every feature working exactly as it does now.

## 1. Who and what
Northlight Studio is a 25-person design studio. The visitors are people who might hire us, and the studio's own staff using the internal tools. The site should feel like a **north pole expedition team's logbook**: calm, capable people who plan routes, explore and get things done in extreme conditions. Theme name: **Field Journal**.

## 2. Mood words and never-looks
Mood: **snowy, polar, winter, exploring, expedition**.
It must never look **city-like** (no skylines, street maps or urban grids), **political** (no banners, flags, campaign slogans or partisan red-versus-blue looks), or **anything like that**, meaning stiff, corporate or officious. Maps are of ice and routes, never streets.

## 3. Colours
- Snow paper (background): `#F4F1E8`, with faint ruled lines
- Ink (text, rules, borders): `#1B2A3A`
- Expedition red (stamps, buttons, small labels, links): `#A8322A`
- Ice blue (decoration, falling snow, map contours): `#9CC3D9`
- Tape yellow (the strips holding cards to the page): `#E0CD96`; note paper `#FBF3D0`
- White cards `#FFFFFF`; muted text `#4A5968`

## 4. Fonts
**Georgia** for headings and reading text, like a printed journal. The system sans-serif (`system-ui`, Segoe UI, Roboto) only for small uppercase labels, buttons, tables and form fields. No downloaded fonts. Body 18px with 1.65 line height, small text 15px, headings grow by a factor of 1.25 per step (about 23, 28, 35 and 44 px).

## 5. Layout: "Field Journal"
A newspaper masthead on every page: a small line (volume, "fictional expedition journal"), a large uppercase title between double rules, and a centred small-caps navigation to every page. The home page is a two-column spread: a big italic headline with a drop-cap introduction and three figures on the left, a pinned route map with a stamp on the right. Then sections, each opened by a small red uppercase kicker above a rule: services as taped "plates", the tools as a contents list with dotted leaders, the FAQ as two columns of Q and A, and the contact form as a telegram. The tool pages reuse the masthead and the ruled paper. On phones everything is one column.

**Easy to look around.** The visitor must always know where they are and be able to reach anything in one tap. A navigation bar sticks to the top of every page and always lists every page, with the current one marked in red. On phones it becomes one row that scrolls sideways, opened at the current page. On the home page a second row lists the sections (Services, Tools, FAQ, Contact) and highlights the one being read. Long tool pages start with a "Jump to" row of links to their sections. Keyboard users get a "skip to main content" link. A "Top" button appears after scrolling. Every page ends with a footer contents list linking to every page. Anchor jumps must not hide headings under the sticky bar.

## 6. Pieces
Taped white "plate" cards with a soft shadow (slightly tilted on the home page only). Round red double-ring stamps. Ledger tables with a double rule under the header and dotted row lines. Form fields with only a bottom line, and ruled-paper text areas. Red buttons, uppercase and wide-spaced, with a hard ink-coloured offset shadow that presses flat on click. Short red italic "margin notes". Note boxes in pale note paper. Simple line icons (snowflake, compass, peak) drawn inline as SVG.

## 7. Motion: reactive and slightly wild
Paper behaves like paper. Plates are "dealt" onto the page as you scroll, then straighten and lift on hover. The pinned map tilts toward the pointer, the red route on it draws itself, and the round stamp thunks onto the page. Ice-blue snow drifts slowly down the home page. Buttons press down on click. **Never** move tables, forms or text being read. Everything stops for anyone whose device asks to reduce motion.

## 8. Rules
Easy to navigate: the navigation described in section 5, with every link at least 44px tall. Readable: contrast of 4.5:1 or better everywhere, text never smaller than 15px. Works on phones: one column, tap targets at least 44px, nothing scrolls sideways. Nothing breaks: all existing tests keep passing (browser tests, accessibility check, older tests), the security policy stays (no inline scripts or styles, no outside files, no outside fonts), and the SEO rules stay (title under 60 characters, description under 155, one H1, alt text on images, FAQ data matching the page).
