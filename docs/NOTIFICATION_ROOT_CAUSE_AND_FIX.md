# Notification Root Cause & Fix — Persona Reply Native Notifications

Date: 2026-04-09

Purpose
- Record full root-cause analysis and the concrete fix for persona-reply native notifications that were not delivered.
- Provide reproducible steps, before/after code, verification, and prevention guidance so future regressions can be diagnosed and fixed quickly.

Summary
- Symptom: Self-test local notifications worked, but persona reply notifications (assistant messages) did not produce native Android notifications.
- Root cause: The notification payload (and the call to schedule it) was gated on a variable that was set *inside* a React `setThreads` updater callback. That updater runs asynchronously — the external variable remained `null` and the code that would schedule the notification never executed.
- Fix: Compute the notification values synchronously from the current `threads` state BEFORE calling `setThreads`, then call `pushUnreadNotification(...)` with the computed payload. Also kept existing channel verification and grouped summary notification logic.

Affected files
- Main runtime / single-file app: [Incirql.jsx](Incirql.jsx#L1) (key function: [updateThreadFromAssistantMessage](Incirql.jsx#L1162-L1222))
- Notification helper: `pushUnreadNotification` in [Incirql.jsx](Incirql.jsx#L990-L1040)
- Notification channel check: `ensureNotificationChannel` in [Incirql.jsx](Incirql.jsx#L928-L960)

Detailed root-cause analysis
1. What I observed
   - The app's self-test notification path scheduled local notifications and they appeared normally.
   - When the assistant (persona) responded, UI updated (thread preview changed), but no native notification appeared.
   - Logs showed no errors from the local notifications scheduling call.

2. Why this happened
   - The code updated `threads` via a `setThreads((prev) => { ... })` functional updater. Inside that updater the code assigned `updatedThread = nextThread` and computed `threadUnreadAfterUpdate` and `totalUnreadAfterUpdate`.
   - Immediately after calling `setThreads(...)`, the code checked `if (updatedThread) { pushUnreadNotification(updatedThread, ...) }`.
   - React does not execute the updater synchronously; the updater runs later during state commit. Therefore the assignment to `updatedThread` inside the updater hasn't occurred when the `if` is evaluated — `updatedThread` is still `null` and `pushUnreadNotification` is never called.

3. Why this is easy to miss
   - The `setState` functional updater is often used for correct concurrent updates; however, side-effects that depend on the updated value must be scheduled outside the updater (e.g., compute before setState, use refs, or use useEffect watching the state).
   - The rest of the notification plumbing (permissions, channel verification, schedule) was correct — so there were no exceptions thrown to clue you in.

Before (broken) snippet
```js
let updatedThread = null;
let totalUnreadAfterUpdate = 0;
let threadUnreadAfterUpdate = 0;
setThreads((prev) => {
  const nextThreads = prev.map((thread) => {
    if (thread.id !== threadId) return thread;
    const nextThread = { /* updated fields */ };
    updatedThread = nextThread; // mutated inside updater
    threadUnreadAfterUpdate = nextThread.unread || 0;
    return nextThread;
  });
  totalUnreadAfterUpdate = nextThreads.reduce(...);
  return nextThreads;
});

if (updatedThread) {
  pushUnreadNotification(updatedThread, preview, { totalUnread: totalUnreadAfterUpdate, threadUnread: threadUnreadAfterUpdate });
}
```

Why that fails: the `updatedThread` assignment happens inside the updater callback which React calls later; the `if (updatedThread)` check runs immediately and finds `null`.

Fix implemented (summary)
- Compute the notification candidate values synchronously from the previous state (as done here) and call the side-effect after the updater.
- Use `notifyThread` computed synchronously and call `pushUnreadNotification` after `setThreads`.

After (fixed) snippet
```js
// compute synchronously from `threads` array in closure
const currentThread = threads.find((t) => t.id === threadId);
if (!currentThread) return;
const isViewingNow = activeThreadIdRef.current === threadId && isAppForegroundVisible();
const threadUnreadAfterUpdate = isViewingNow ? 0 : (currentThread.unread || 0) + 1;
const totalUnreadAfterUpdate = threads.reduce((sum, t) => sum + (t.id === threadId ? threadUnreadAfterUpdate : (t.unread || 0)), 0);
const notifyThread = { ...currentThread, lastMsg: preview, time: /* formatted */, unread: threadUnreadAfterUpdate, status: isViewingNow ? 'read' : 'delivered' };

// update state
setThreads(prev => prev.map(t => t.id === threadId ? { ... } : t));

// schedule side-effect outside of setState
pushUnreadNotification(notifyThread, preview, { totalUnread: totalUnreadAfterUpdate, threadUnread: threadUnreadAfterUpdate });
```

Other contributing checks (kept intact)
- `pushUnreadNotification` verifies notification permissions and `LocalNotifications.areEnabled()` before scheduling.
- Channel management: `ensureNotificationChannel()` rotates legacy channels, creates `incirql-messages-v3`, and verifies existence with `LocalNotifications.listChannels()`.
- Grouped summary notification: when `totalUnread > 1`, the code schedules a group summary notification (static id 777777) and individual notifications with monotonic IDs.

How I validated the fix
1. Updated `Incirql.jsx` with the synchronous compute + side-effect change.
2. Ran `npm run build` to ensure no bundling errors.
3. Ran `npx cap sync android` to copy web assets to the Android project.
4. Built the debug APK with Gradle: `cd android && gradlew.bat --no-daemon clean assembleDebug`.
5. Exported the APK and installed it on a device/emulator.
6. Verified: when a persona responded while the app was backgrounded or on a different screen, a native notification appeared (persona name + bell emoji, message preview). Group summary is created when multiple missed messages exist.

Commands used during verification
```bash
npm run build
npx cap sync android
cd android
./gradlew.bat --no-daemon clean assembleDebug
# copy the apk from android/app/build/outputs/apk/debug/app-debug.apk
```

How to reproduce the original failure locally
1. Build and install the APK prior to the fix.
2. Open the app and leave it in background / switch to another thread.
3. Trigger an assistant response (e.g., send a prompt that yields a persona reply or simulate assistant response from code path).
4. Observe that the UI updates but no native notification appears, and no scheduling log entry is present.

Prevention checklist & best practices
- Never place side-effects that must run immediately AFTER an update inside a `setState` updater callback. Updater callbacks should be pure and deterministic only for deriving next state.
- Options for side-effects that depend on the new state:
  - Compute the required data synchronously from the previous state (as done here) and call the side-effect after the updater.
  - Or update state, then use a `useEffect` that watches the relevant state slice and triggers the side-effect when it changes (note: this introduces another async boundary and potential debounce/guarding needs).
  - Alternatively, use refs to store transient values that persist across renders and can be read synchronously.
- Add unit/integration tests around notification scheduling where practical (mocks for `LocalNotifications`), and log scheduling attempts with a unique marker so you can grep logs during troubleshooting.

Quick checklist for future debugging
- Verify `LocalNotifications.checkPermissions()` and `LocalNotifications.areEnabled()` results.
- Check `ensureNotificationChannel()` and `LocalNotifications.listChannels()` for a current channel id mismatch.
- Search callsites of `pushUnreadNotification` and ensure the caller actually invokes it (and doesn't rely on mutated variables inside an updater callback).
- Grep for `setThreads((prev) =>` usages that also attempt side-effects immediately after — those are likely spots for the same class of bug.

Notes about persona profile pictures
- The web layer cannot add arbitrary per-persona native drawable assets at runtime. If you need persona avatars in the notification bubble/largeIcon, they must be packaged as drawable resources in `android/app/src/main/res/drawable/` and referenced by resource name (the Capacitor `largeIcon` field supports native drawables). This is a separate packaging task.

Appendix: key diffs
- See the changed region in [Incirql.jsx](Incirql.jsx#L1162-L1240).

If you want, I can:
- Add a short unit/integration test that mocks `LocalNotifications` and asserts `schedule` is called when a thread receives an assistant message.
- Add a small diagnostic page in the app that lists current notification channels and last scheduling attempts for easier future debugging.

---
Generated by the dev workflow on 2026-04-09. File: `docs/NOTIFICATION_ROOT_CAUSE_AND_FIX.md`.
