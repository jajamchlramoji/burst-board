# Burst Board

Turn ideas into **one-burst ships**: small things that can be live within two hours.

A real macOS desktop app (Electron). No accounts, no cloud, no backend. Everything you type
lives in one JSON file on your laptop, and the app works with the Wi-Fi off.

**Inbox → Shrink → Spin → Burst → Ship → Log**

---

## 1. Install it (the quick way)

If you just want to use the app:

1. Open `release/Burst-Board-1.0.0-arm64.dmg` (double-click it).
2. Drag **Burst Board** onto the **Applications** folder in the window that appears.
3. Open **Applications** and double-click **Burst Board**.

### "Apple could not verify Burst Board is free of malware"

That message is expected. The app is not signed with a paid Apple Developer certificate,
so macOS asks before running it the first time. It only appears once.

Pick **one** of these:

**Option A — right-click**
1. In Applications, **right-click** (or Control-click) **Burst Board**.
2. Choose **Open**.
3. Click **Open** in the dialog.

**Option B — System Settings**
1. Try to open the app normally. Let it be blocked.
2. Open **System Settings → Privacy & Security**.
3. Scroll down to the message about Burst Board and click **Open Anyway**.

**Option C — Terminal**, if the first two do not work:

```bash
xattr -dr com.apple.quarantine /Applications/Burst\ Board.app
```

After that it opens like any other app, forever.

---

## 2. Run it in dev mode (to change the code)

You need **Node.js 20 or newer**. Check what you have:

```bash
node -v
```

If that prints an error or a number below 20, install Node from <https://nodejs.org> (the "LTS"
download) and try again.

Then, step by step:

```bash
cd burst-board
```

```bash
npm install
```

```bash
npm run dev
```

The app window opens by itself. Editing anything in `src/` updates the window instantly.
Editing anything in `electron/` needs a restart: press `Ctrl+C` in the terminal and run
`npm run dev` again.

To stop it, press `Ctrl+C` in the terminal.

---

## 3. Build the installer yourself

```bash
npm run dist:mac
```

That one command generates the app icon, compiles everything, and writes the installer to:

```
release/Burst-Board-1.0.0-arm64.dmg
```

It takes a couple of minutes the first time. The `release/` folder also holds
`mac-arm64/Burst Board.app`, which you can run directly without the installer.

Other commands, if you want them:

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev mode with live reload |
| `npm run build` | Compile only, no installer |
| `npm start` | Compile, then run the production build |
| `npm run typecheck` | Check TypeScript for mistakes |
| `npm run icon` | Regenerate the app icon |

---

## 4. Where your data lives

One file:

```
~/Library/Application Support/Burst Board/burst-board-data.json
```

Plain JSON. Back it up by copying it. Delete it to start over. The app shows this path under
**Settings → Your data**.

---

## 5. How the app works

### Inbox — quick capture
Dump ideas without thinking about them. Each one has the idea text (required), an optional
source link, and a tag: **own idea** or **FOMO** (something you saw online).

A FOMO idea is shrunk under the title template **"My tiny take on \[X\]"**, so copying somebody
else turns into making your own small version.

Press **⌘⇧B** anywhere on your Mac for a tiny capture window — you never have to leave what
you are doing. The **⚡ menu bar icon** has **Capture idea** and **Start burst** too.

### Shrink — make it two-hour sized
Turn an inbox idea into a one-burst ship:

- **What will be live in 2 hours?** (one sentence, required)
- **Where will I ship it?** (GitHub, deployed URL, X, LinkedIn, other)
- **Ugly v1 is…** (one sentence)

**Maximum 5 active ships.** The form locks at five and asks you to park one. Parking is free
and reversible.

### Spin — stop choosing
A big **Spin** button picks a random active ship. You get **one re-spin**, then it locks in.

### Burst — the four-hour timer

| Time | What happens |
| --- | --- |
| 0:00–0:15 | **Scope.** Your "what will be live" sentence, large, and nothing else to do. |
| 0:15–2:00 | **Build.** Timer visible. Optional always-on-top mini timer. |
| **2:00** | **SHIP CHECKPOINT.** Notification + modal: *"Ship it now, ugly is fine."* Needs a public URL to continue. |
| 2:00–3:50 | **Improve & reship.** Bonus time. Add more URLs. |
| 3:50–4:00 | **Log prompt.** Write the one-line win and the possible v2. |

Pause or end at any point. Ending without shipping is **parked** — not failed. The app never
says anything about it.

The timer survives quitting the app: it runs on wall-clock time, so closing the laptop or
restarting does not lose your burst.

### Ship log
Every entry holds the title, date, public URL(s), a one-line win, and a one-line "possible v2".
At the top: **total ships**, **ships this month**, and your **ship streak**.

The streak is counted in **burst days**. Days where you did not burst are skipped entirely —
they never break it. Only a burst day that shipped nothing ends the streak. Days off are normal.

**Export log as Markdown** writes a file you can paste anywhere public.

### Weekly shrink reminder
A notification saying *"15 min: turn 5 inbox ideas into one-burst ships."* Sunday by default;
the day and time are in **Settings**.

---

## 6. Project layout

```
burst-board/
├── electron/          Main process (windows, tray, hotkey, notifications, JSON storage)
│   ├── main.ts        App lifecycle and all windows
│   ├── ipc.ts         Every action the UI can take
│   ├── store.ts       The JSON file
│   ├── export.ts      Markdown export
│   ├── tray.ts        Menu bar icon
│   ├── notify.ts      Notifications + the weekly reminder
│   └── preload.ts     The safe bridge between the UI and the main process
├── shared/            Types and burst timing shared by both sides
├── src/               React UI
│   ├── App.tsx        Tabs and shell
│   └── views/         Inbox, Shrink, Spin, Burst, ShipLog, Settings, Capture, Mini
├── scripts/           Icon generator
└── release/           Built installer lands here
```

Security: the renderer runs with `contextIsolation` on and `nodeIntegration` off, so the UI
cannot touch your filesystem directly — it goes through a narrow, explicit API.

---

## 7. Tone

Encouraging, short, never guilt-tripping. Days without a burst are normal. The app has no
badges, no "you missed a day", and no red numbers.
