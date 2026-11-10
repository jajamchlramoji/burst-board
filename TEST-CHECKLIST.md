# Burst Board — click-through test checklist

Takes about 10 minutes. Tick each box. If something fails, the line says what you should
have seen.

Open the app first: **Applications → Burst Board**.

---

## 1. Inbox — quick capture

- [ ] The app opens on the **Inbox** tab, dark, with a big **Capture idea** button.
- [ ] Type an idea, leave the tag on **My own idea**, click **Capture idea**.
      → A toast says *"Captured. Back to what you were doing."* and the idea appears under
      **Unshrunk ideas** with a green **OWN IDEA** pill.
- [ ] Type a second idea and click **FOMO (saw it online)** before saving.
      → A green banner appears: *"This will be shrunk as: **My tiny take on \[your idea]**"*.
- [ ] Save it. → It appears in the list with a blue **FOMO** pill.
- [ ] Paste a link into **Source link**, capture, then click **source** on that row.
      → The link opens in your normal browser, not inside the app.
- [ ] Click the **✕** on an idea. → It disappears, toast says *"Deleted. No guilt."*
- [ ] Type something and press **⌘Return**. → It saves without clicking the button.

## 2. Global hotkey and menu bar

- [ ] Click on another app (Safari, Notes — anything), then press **⌘⇧B**.
      → A small **Quick capture** window appears on top and the cursor is already in the
      idea field.
- [ ] Type an idea and press **Return**. → *"Captured. Carry on. ⚡"*, then the window closes.
- [ ] Press **⌘⇧B** again and press **Esc**. → The window closes, nothing saved.
- [ ] Look at the **⚡ icon in the menu bar** (top right of your screen). Click it.
      → A menu with **Capture idea**, **Start burst**, **Open Burst Board**, **Ship log**,
      **Quit Burst Board**, and a line showing how many active ships you have.
- [ ] Choose **Capture idea** from that menu. → Same quick capture window.
- [ ] Open the app, go to **Inbox**. → Everything you captured by hotkey is in the list.

## 3. Shrink

- [ ] Click **Shrink** on the FOMO idea in the Inbox.
      → The Shrink tab opens with **Ship title** already filled in as
      *"My tiny take on …"*.
- [ ] Leave **What will be live in 2 hours?** empty and click **Add one-burst ship**.
      → A toast refuses it: *"What will be live in 2 hours?" is required.*
- [ ] Fill it in, pick a **Where will I ship it?**, write an **Ugly v1**, click
      **Add one-burst ship**.
      → Toast *"One-burst ship added."*, the ship shows under **Active ships**, and the
      header counts *"1 of 5 active slots used"*.
- [ ] Choose **Other** in the where dropdown. → A second box appears asking where exactly.
- [ ] Add ships until you have **5**. Then try to add a sixth.
      → A red banner: *"You have 5 active ships. That is the ceiling. Park one below and the
      form opens back up."* Every field in the form is greyed out.
- [ ] Click **Park** on one ship. → It moves to a **Parked** section and the form works again.
- [ ] Click **Unpark** while 5 are already active.
      → Toast: *"5 active ships already. Park one to bring this back."*

## 4. Spin

- [ ] Go to **Spin**. → It says how many ships are on the wheel.
- [ ] Click the big **⚡ Spin** button.
      → Titles flicker for about a second and a half, then one is picked and its
      *"what will be live"* sentence appears below it.
- [ ] Click **Re-spin (1 left)**. → It rolls again.
- [ ] After that second spin → The button is gone, the box has an orange glow, and a line
      says *"No more re-spins. Go build it."*

## 5. Burst mode

- [ ] Click **Start the burst**.
      → The app jumps to the **Burst** tab: **SCOPE**, a big **0:00:00** clock, and your
      one sentence in a card.
- [ ] Watch for a few seconds. → The clock counts up.
- [ ] Look at the **menu bar**. → The ⚡ icon now shows the time left in the burst (e.g. `3:58`).
- [ ] Click **Pause**. → The clock greys out and stops; the line says *"Paused. The clock
      waits for you."* The menu bar shows `paused`.
- [ ] Click **Resume**. → It carries on from where it stopped, not from zero.
- [ ] Click **Mini timer on top**.
      → A small window appears top-right showing the phase, the clock, the ship title and a
      progress bar. It **stays on top of other apps** — click Safari and check.
- [ ] Drag the mini timer somewhere else. → It moves.
- [ ] Click **Hide mini timer**. → It disappears.
- [ ] **Quit the app entirely (⌘Q) and reopen it.**
      → The burst is still running with the correct elapsed time. Nothing was lost.

### The 2:00 ship checkpoint

Rather than waiting two hours, you can fast-forward once:

1. Quit Burst Board.
2. Open the data file at
   `~/Library/Application Support/Burst Board/burst-board-data.json` in TextEdit.
3. Find `"startedAt"` inside `"burst"` and change the **hour** to two hours earlier.
4. Save, reopen the app.

- [ ] → A macOS notification appears: **"Ship it now, ugly is fine."**
- [ ] → A modal covers the app with the same title and a **Public URL** field.
- [ ] Type `localhost:3000` and click **It is live**.
      → Refused: *"Paste a public http(s) link - that is what makes it shipped."*
- [ ] Type a real link like `github.com/yourname/thing` and click **It is live**.
      → Toast *"Shipped. That counts, however ugly."*, the modal closes, a **Shipped links**
      section appears with the link turned into `https://…`.
- [ ] Click **5 more minutes** (reopen the checkpoint first if you already shipped).
      → The modal goes away and comes back about five minutes later.
- [ ] In **Shipped links**, paste another URL and click **Add**. → It joins the list.
- [ ] Phase line now reads **IMPROVE & RESHIP** with *"Bonus time…"*.

### Ending a burst

- [ ] Click **End burst** after shipping.
      → *"End the burst? It is already shipped, so this goes in the log as a ship."*
- [ ] Click **End and log the ship**. → Toast *"Burst logged. Go rest."*
- [ ] Start another burst and click **End burst** without shipping.
      → *"End without shipping? This goes down as parked. Not failed, not a streak break -
      just parked."* No guilt language anywhere.

## 6. Ship log

- [ ] Go to **Ship log**. → Three numbers at the top: **ship streak (burst days)**,
      **total ships**, **shipped this month**.
- [ ] → Your shipped entry is listed with its date, where, and clickable URL.
- [ ] Click the URL. → It opens in your browser.
- [ ] Click **Edit** on the entry, fill in **One-line win** and **Possible v2**, click **Save**.
      → They show under the entry as **WIN** and **V2**.
- [ ] → Below, **Burst history** lists every burst with a `shipped` or `parked` pill and how
      many minutes it ran.
- [ ] Click **Export log as Markdown**, save it to your Desktop, open the file.
      → A readable Markdown ship log with your counts, each ship, its links, win, and v2.

### Streak behaviour (the important one)

- [ ] Do a burst that ships today. → Streak is at least **1**.
- [ ] Skip a day or three with no bursts at all, then ship again.
      → The streak **went up, not back to 1**. Missed days do not break it.
- [ ] Do a burst and end it **without** shipping.
      → The streak resets, and the app says nothing about it. The explanation line under the
      numbers states the rule plainly.

## 7. Settings

- [ ] Open the **⚙** button at the top right.
- [ ] Change the reminder **Day** and **Time**. → The line underneath updates to match.
- [ ] Turn **Global capture hotkey** **Off**, then press ⌘⇧B from another app.
      → Nothing happens. Turn it back **On** → ⌘⇧B works again.
- [ ] Turn **System notifications** off and on. → No error.
- [ ] Under **Your data**, you can see the full path to your JSON file.

### The Sunday reminder

To test it without waiting for Sunday:

- [ ] In Settings, set the **Day** to today and the **Time** to one minute from now.
      Leave the app open.
      → Within about a minute a notification appears:
      **"15 min: turn 5 inbox ideas into one-burst ships."**
- [ ] → It does **not** fire a second time the same day.
- [ ] Set the day and time back to Sunday 10:00 when you are done.

## 8. Offline and data

- [ ] Turn **Wi-Fi off** and use the whole app: capture, shrink, spin, burst, log, export.
      → Everything works exactly the same.
- [ ] Open `~/Library/Application Support/Burst Board/burst-board-data.json`.
      → Readable JSON containing your ideas, ships, history and settings.
- [ ] Quit and reopen the app. → Everything is still there.

---

## If something goes wrong

| What you see | What to do |
| --- | --- |
| "Apple could not verify…" on first open | Right-click the app → **Open** → **Open**. See README §1. |
| ⌘⇧B does nothing | Another app has that shortcut. Turn the hotkey off and on in Settings; if it still fails, quit the other app. |
| No notifications | **System Settings → Notifications → Burst Board** and allow them. |
| No ⚡ in the menu bar | Your menu bar may be full — hide another icon, or widen the bar. |
| Want a clean slate | Quit the app, delete the JSON data file, reopen. |
