# KEBS Mobile App

A mobile-first employee workspace for **KEBS**, covering attendance, timesheets, leave, requests, approvals, expenses and an AI assistant, **Kais**. It is built as a single-page web app with no build step. On a desktop it shows inside an iPhone frame, and on a phone it runs full screen.

## Run it

```bash
node server.mjs 5270
```

Then open <http://localhost:5270>. It needs Node 18 or newer and has no dependencies.

Sign in with any email or with the Office 365 button (simulated). All data is demo data saved in your browser's localStorage. **Side menu → Reset demo data** restores the sample workspace.

## Features

| Area | What you can do |
|---|---|
| **Home** | Coral hero with an "Ask Kais" bar that collapses on scroll; Quick access in the Microsoft 365 icon style, customisable up to 7 actions; one "Today" attendance card; off this week; announcements |
| **Attendance** | Clock in and out with location confirmation, live timer, today's logs, a month of time logs, late and on-time status |
| **Raise request** | Work from home, partial day, on duty (with attachments) and attendance regularisation; request detail with activity timeline, comments and withdraw |
| **Leave** | Apply leave (today, tomorrow or a date range, half day), balances with a donut and per-type rings, comp-off credit, holiday calendar |
| **Timesheet** | Daily entries, add tasks by project, copy last week's tasks, hour/minute wheel picker, run a timer, billable or non-billable, weekly submit (attachment required), unsubmit, history by year |
| **Priority Inbox** | AI-sorted notifications in Urgent, Important and Others groups, with anchor tabs and counts, Priority or Newest sort, swipe right to archive, swipe left to mark read, move between groups, 3-step onboarding |
| **Inbox (approvals)** | Expense, timesheet and leave approvals; Kais bulk-approve for routine items; approve, or reject with a reason |
| **Kais AI** | Chat-style assistant with suggested prompts and streamed answers; leave rings and weekly hours charts; action cards (clock in/out, apply leave, WFH, log time, approve); follow-ups; copy, regenerate and feedback; chat history; attachments; voice input |
| **Profile & people** | Summary, timeline, personal and job tabs; edit profile; colleague profiles; give praise with badges |
| **Expenses** | Claims, saved bills (with 3D file-type icons) and insights; new claim with a scanned bill |
| **Announcements** | Emoji reactions on posts and comments, comments, acknowledge, share |
| **Settings** | Language (7 Indian languages for the app's navigation and greetings), theme (auto, light or dark), device lock, feedback |

## Design

- Layout comes from the KEBS Figma file; the visual system draws on the *stash.* (inspo-vault) app.
- Apple HIG: SF Pro on Apple devices (Inter elsewhere), 44pt touch targets, an iOS navigation bar, sheets with grab handles, a liquid-glass tab bar, and respect for reduced motion.
- Brand: the KEBS 3D logo and orange (`#FF4013` light / `#E8562A` dark).
- Icons: Microsoft 365-style quick actions, Tesla CRM-style bordered icon chips and 3D file-type icons, and duotone icons on the app tiles.

## Project structure

```
index.html          shell, iPhone frame, script order
styles.css          base design tokens + components
extra.css           liquid glass, hero, Kais chat, Priority Inbox
tesla.css           icon system, nav bar, HIG fixes, latest refinements
js/core.js          DOM, date and i18n helpers
js/store.js         seeded demo data + localStorage persistence
js/ui.js            router registry, sheets, pickers, toasts, file icons
js/views-*.js       one file per area (home, time, timesheet, leave, people, misc, notifs, kais)
js/icons*.js        outline, duotone and Microsoft 365-style icon sets
server.mjs          tiny static server
```

## Credits

- 3D icons in `assets/3d/`: [Microsoft Fluent Emoji](https://github.com/microsoft/fluentui-emoji), MIT License.
- Emoji artwork for reactions: [emoji-datasource-apple](https://github.com/iamcal/emoji-data), loaded from the jsDelivr CDN.
- Fonts: Inter and Lilita One (Google Fonts).
