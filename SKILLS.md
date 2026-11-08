# Claude skills for this project

Skills are instruction packs Claude Code follows for specific kinds of work. Skills in `.claude/skills/` load automatically for anyone who opens this repo in Claude Code.

The folder is excluded from the website deploy (`.vercelignore`), so none of this is served on kebs-mobile-app.vercel.app.

## In this repo (`.claude/skills/`)

### Emil Kowalski: animation and interaction craft
Source: https://github.com/emilkowalski/skills (MIT, see `LICENSE-emilkowalski-skills`). Copied at commit c8a7962. Plain Markdown, no scripts.
Update with: `npx skills@latest add emilkowalski/skills` or re-copy the folders.

| Skill | What it does |
|---|---|
| `animate` | Build an animation from scratch, making the decisions in the order that determines whether it feels right — sh |
| `animation-performance` | Keep web animations inside the frame budget — animate composite-only properties, keep motion off the main thre |
| `animation-vocabulary` | Reverse-lookup glossary that turns a vague description of a web animation or motion effect into its exact term |
| `apple-design` | Apple's approach to interface design and fluid, physical motion, translated for the web. Use when building or  |
| `break-ui` | Try to break a piece of UI by feeding it worst-case data — long names, unbreakable emails, one-letter names, m |
| `choreograph` | Coordinate several elements that animate together — decide what moves, in what order, how much they overlap, a |
| `emil-design-eng` | This skill encodes Emil Kowalski's philosophy on UI polish, component design, animation decisions, and the inv |
| `find-animation-opportunities` | Search a codebase or UI for places that don't animate but should, and reject everything that shouldn't. Read-o |
| `improve-animations` | Survey a codebase's animation and motion code as a senior motion advisor, then produce a prioritized audit and |
| `mobile-native` | Make a web app feel native on a phone — the small CSS and meta-tag fixes that separate "a website in a browser |
| `prototype` | Build multiple genuinely different versions of a UI piece you describe, rendered behind a visual picker so you |
| `remove-animations` | Find the animations an interface doesn't need and remove them — motion on keyboard actions, high-frequency sur |
| `review-animations` | Reviews animation and motion code against a high craft bar derived from Emil Kowalski's design engineering phi |

Left out on purpose: `animate-expo`, `write-swift`, `ask-sonner`, `pick-ui-library` (React Native, Swift and React-only).

### From the KEBS Claude account (MIT-licensed)

| Skill | What it does |
|---|---|
| `banner-design` | Design banners for social media, ads, website heroes, creative assets, and print. Multiple art direction optio |
| `design` | Comprehensive design skill: brand identity, design tokens, UI styling, logo generation (55 styles, Gemini or A |
| `ui-styling` | Create beautiful, accessible user interfaces with shadcn/ui components (built on Radix UI + Tailwind), Tailwin |
| `vercel-composition-patterns` | React composition patterns that scale. Use when refactoring components with |
| `vercel-react-best-practices` | React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be used when  |
| `vercel-react-native-skills` | React Native and Expo best practices for building performant mobile apps. Use |

## On the Claude account only (not copied here)

These come with the claude.ai account and sync automatically to any machine where it is signed in. They are not copied into this public repo because their licenses are proprietary or not stated.

| Skill | License | What it does |
|---|---|---|
| `accessibility-audit` | not stated | Whole site or product — a full web accessibility (a11y) audit against WCAG 2.2, following the WCAG-EM methodol |
| `accessibility-fix` | not stated | Remediation only — repair web accessibility (a11y) violations against WCAG 2.2 with a baseline, edit, and veri |
| `accessibility-inspect` | not stated | One page, hands-on manual tier — drive a live page through the web accessibility (a11y) checks a rule engine c |
| `accessibility-scan` | not stated | One page, automated tier — run the web accessibility (a11y) rule engine against a live page and locate every v |
| `adaptive-communication` | not stated | Use when detecting ambiguous user intent, hedging language, open-ended framing, personal context before reques |
| `agentic-ux-design-relationship-centric-interfaces` | not stated | Design AI-first interfaces that build ongoing relationships through memory, trust evolution, and collaborative |
| `algorithmic-art` | Complete terms in LICENSE.txt | Creating algorithmic art using p5.js with seeded randomness and interactive parameter exploration. Use this wh |
| `bencium-aeo` | not stated | Generate AEO-optimized content (Answer Engine Optimization) for AI search visibility - ChatGPT, Claude, Gemini |
| `bencium-code-conventions` | not stated | Bence's code style, tech stack, and workflow conventions |
| `bencium-controlled-ux-designer` | not stated | Expert UI/UX design guidance for unique, accessible interfaces. Use for visual decisions, colors, typography,  |
| `bencium-impact-designer` | not stated | Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the use |
| `bencium-innovative-ux-designer` | not stated | Develop an independent visual language and turn the human-chosen direction into a production-ready graphic, br |
| `brand` | not stated | Brand voice, visual identity, messaging frameworks, asset management, brand consistency. Activate for branded  |
| `brand-guidelines` | Complete terms in LICENSE.txt | Applies Anthropic's official brand colors and typography to any sort of artifact that may benefit from having  |
| `brandkit` | not stated | Premium brand-kit image generation skill for creating high-end brand-guidelines boards, logo systems, identity |
| `canvas-design` | Complete terms in LICENSE.txt | Create beautiful visual art in .png and .pdf documents using design philosophy. You should use this skill when |
| `deploy-to-vercel` | not stated | Deploy applications and websites to Vercel. Use when the user requests deployment actions like "deploy my app" |
| `design-audit` | not stated | > |
| `design-md` | not stated | Analyze Stitch projects and synthesize a semantic design system into DESIGN.md files |
| `design-taste-frontend` | not stated | Anti-slop frontend skill for landing pages, portfolios, and redesigns. The agent reads the brief, infers the r |
| `design-taste-frontend-v1` | not stated | The original v1 taste-skill, preserved for projects depending on its exact behavior. The current default is `d |
| `doc-coauthoring` | not stated | Guide users through a structured workflow for co-authoring documentation. Use when user wants to write documen |
| `docs` | not stated | docs (editable docs people share and comment on; the default for any document, named as a doc or not: a docume |
| `docx` | Proprietary. LICENSE.txt has complete terms | Use this skill whenever the user wants to create, read, edit, or manipulate Word documents (.docx) or Word tem |
| `email` | not stated | Draft emails in the user's voice — direct, human, not generic — based on a voice profile and real samples they |
| `enhance-prompt` | not stated | Transforms vague UI ideas into polished, Stitch-optimized prompts. Enhances specificity, adds UI/UX keywords,  |
| `eu-ai-act-reviewer` | not stated | Review user journeys, public content, and codebases for potentially relevant EU AI Act provisions, with exact  |
| `find-skills` | not stated | Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for  |
| `frontend-design` | Complete terms in LICENSE.txt | Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the use |
| `full-output-enforcement` | not stated | Overrides default LLM truncation behavior. Enforces complete code generation, bans placeholder patterns, and h |
| `google-workspace` | not stated | Read this before the first Google Drive, Docs, Sheets or Slides connector call whenever the task creates or ch |
| `gpt-taste` | not stated | Elite UX/UI & Advanced GSAP Motion Engineer. Enforces Python-driven true randomization for layout variance, st |
| `high-end-visual-design` | not stated | Teaches the AI to design like a high-end agency. Defines the exact fonts, spacing, shadows, card structures, a |
| `human-architect-mindset` | not stated | Systematic architectural thinking for irreplaceable human capabilities - domain modeling, systems thinking, co |
| `hungarian-humanizer` | not stated | Detect and remove AI-generated markers from Hungarian text, making it sound like a native Hungarian speaker wr |
| `image-to-code` | not stated | Elite website image-to-code skill for Codex. For visually important web tasks, it must first generate the desi |
| `imagegen-frontend-mobile` | not stated | Elite mobile app image-generation skill for creating premium, app-native screen concepts and flows. Designed f |
| `imagegen-frontend-web` | not stated | Elite frontend image-direction skill for generating premium, conversion-aware website design references. CRITI |
| `import-memory` | not stated | Import a memory export from another AI assistant into Claude's memory — conversationally, additively, and with |
| `industrial-brutalist-ui` | not stated | Raw mechanical interfaces fusing Swiss typographic print with military terminal aesthetics. Rigid grids, extre |
| `insurgent-campaign` | not stated | > |
| `internal-comms` | Complete terms in LICENSE.txt | A set of resources to help me write all kinds of internal communications, using the formats that my company li |
| `mcp-builder` | Complete terms in LICENSE.txt | Guide for creating high-quality MCP (Model Context Protocol) servers that enable LLMs to interact with externa |
| `minimalist-ui` | not stated | Clean editorial-style interfaces. Warm monochrome palette, typographic contrast, flat bento grids, muted paste |
| `morning` | not stated | Render the user's morning brief as a styled HTML artifact, or set it up as a recurring weekday task. Use only  |
| `negentropy-lens` | not stated | > |
| `pdf` | Proprietary. LICENSE.txt has complete terms | Use this skill whenever the user wants to do anything with PDF files. This includes reading or extracting text |
| `pptx` | Proprietary. LICENSE.txt has complete terms | Use this skill any time a .pptx or .potx file is involved in any way — as input, output, or both. This include |
| `react-vite-dashboard` | not stated | Convert Stitch designs into production React + Vite dashboards with TanStack Query, accessible tokens from DES |
| `redesign-existing-projects` | not stated | Upgrades existing websites and apps to premium quality. Audits current design, identifies generic AI patterns, |
| `remotion` | not stated | Generate walkthrough videos from Stitch projects using Remotion with smooth transitions, zooming, and text ove |
| `renaissance-architecture` | not stated | Software architecture and UI/UX principles for building genuinely new solutions, not derivative work. Use when |
| `shadcn-ui` | not stated | Expert guidance for integrating and building applications with shadcn/ui components, including component disco |
| `site-md` | not stated | Analyze a project description or site requirements and synthesize a project constitution into SITE.md for the  |
| `skill-creator` | not stated | Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to c |
| `slack-gif-creator` | Complete terms in LICENSE.txt | Knowledge and utilities for creating animated GIFs optimized for Slack. Provides constraints, validation tools |
| `slides` | not stated | Create strategic HTML presentations with Chart.js, design tokens, responsive layouts, copywriting formulas, an |
| `stitch-design` | not stated | Unified entry point for Stitch design work. Handles prompt enhancement (UI/UX keywords, atmosphere), design sy |
| `stitch-design-taste` | not stated | Semantic Design System Skill for Google Stitch. Generates agent-friendly DESIGN.md files that enforce premium, |
| `stitch-loop` | not stated | Teaches agents to iteratively build websites using Stitch with an autonomous baton-passing loop pattern |
| `stitchcode-to-design` | not stated | >- |
| `stitchextract-design-md` | not stated | >- |
| `stitchextract-static-html` | not stated | >- |
| `stitchgenerate-design` | not stated | >- |
| `stitchmanage-design-system` | not stated | >- |
| `stitchreact-components` | not stated | >- |
| `stitchreact-native` | not stated | >- |
| `stitchupload-to-stitch` | not stated | >- |
| `taste-design` | not stated | Semantic Design System Skill for Google Stitch. Generates agent-friendly DESIGN.md files that enforce premium, |
| `theme-factory` | Complete terms in LICENSE.txt | Toolkit for styling artifacts with a theme. These artifacts can be slides, docs, reportings, HTML landing page |
| `ui-typography` | not stated | > |
| `ui-ux-pro-max` | not stated | UI/UX design intelligence for web and mobile. Includes 50+ styles, 161 color palettes, 57 font pairings, 161 p |
| `vanity-engineering-review` | not stated | > |
| `vercel-cli-with-tokens` | not stated | Deploy and manage projects on Vercel using token-based authentication. Use when working with Vercel CLI using  |
| `vercel-optimize` | not stated | Use for Vercel cost and performance optimization on deployed projects, especially Next.js, SvelteKit, Nuxt, an |
| `web-artifacts-builder` | Complete terms in LICENSE.txt | Suite of tools for creating elaborate, multi-component claude.ai HTML artifacts using modern frontend web tech |
| `web-design-guidelines` | not stated | Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility |
| `writing-guidelines` | not stated | Review docs/prose for Writing Guidelines compliance. Use when asked to "review my docs", "check writing style" |
| `xlsx` | Proprietary. LICENSE.txt has complete terms | Use this skill any time a spreadsheet file is the primary input or output. This means any task where the user  |

## Looked at and not installed (Nov 2026)

| Repo | Why not |
|---|---|
| pbakaus/impeccable | Plugin hooks download and run a native binary on every edit and session, plus telemetry; overlaps the Taste skills |
| nutlope/hallmark | Landing-page oriented, runs Node scripts, overlaps Taste |
| nexu-io/open-design | A separate app (~14k files), not a skill |
| VoltAgent/awesome-design-md, google-labs-code/design.md | Other brands' DESIGN.md files / the format spec; covered by `design-md` |
| greensock/gsap-skills, DavidHDev/react-bits, DavidHDev/canvas-ui | GSAP / React / WebGL, not used by this app |
| oso95/scroll-world | Paid video-generation APIs, landing pages only |
