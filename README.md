# Token Pulse

[Русская версия](README.ru.md)

Token Pulse is a local Electron dashboard for **Codex completed-response output speed**. It shows recent sessions, the selected model and reasoning effort, a speedometer, and a live turn timer. The interface supports English and Russian; Russian is the default.

## Download and run

The [latest release](https://github.com/d-ridelman/token-pulse/releases/latest) contains a portable Windows x64 EXE. Download it and run it without an installer or Node.js. The EXE is currently unsigned.

To run the source on Windows, macOS, or Linux, install Node.js and npm, then:

```sh
npm ci
npm start
```

On Windows, `start.cmd` also launches a locally installed Electron binary. Run `npm test` for the monitor tests. Run `npm run build:portable` on Windows to build the portable EXE in `release/`.

## Show one project only

By default the app reads local Codex sessions from `CODEX_HOME/sessions`, or from `~/.codex/sessions` when `CODEX_HOME` is unset. To show only sessions started in one folder (including its subfolders), set `TOKEN_PULSE_PROJECT_DIR` to an absolute path before launching. Set `TOKEN_PULSE_LANG=en` or `ru` to choose the startup language:

```powershell
$env:TOKEN_PULSE_PROJECT_DIR = 'C:\work\my-project'
$env:TOKEN_PULSE_LANG = 'en'
npm start
```

The project filter uses the working directory in each session's metadata. Other projects' session cards do not enter the filtered view.

## What the number means

Token Pulse primarily reads Codex `token_usage_record` events. It divides the reported output tokens for a **completed model response** by the time from the nearest available pre-request event (turn start or last tool output) to the usage record. Older logs fall back to the difference between cumulative `token_count` events. Each card names the method used.

The output-token count includes reasoning and other non-visible output. The measured time can include request latency. Codex's local log does not give the exact first-token time or a token-by-token stream, so this is **effective completed-response throughput**, not instantaneous decoding speed. Do not compare raw tokens/second across different tokenizers as if each token represented the same amount of text.

The app checks known active files every 100 ms and uses filesystem notifications when available. The number changes only when Codex writes another usage event. A measurement is considered recent for 75 seconds; a session card remains visible for 20 minutes.

The speedometer can show the sum of recent measurements or one selected session. Its needle eases to each new value, while the digital number immediately shows the recorded result. Intermediate needle positions are animation, not new measurements. The scale is 0–240 tokens/s for the total and 0–120 tokens/s for one session; the exact number remains visible above the scale.

During an active turn, a separate indicator shows elapsed time, the latest observed Codex activity type, and a count of selected activity signals. The timer moves between speed measurements. These signals do **not** estimate tokens that Codex has not reported. The model badge comes from the latest `turn_context.model` and `effort`; a backend model reroute is not independently verified.

## Sharing and privacy

**Copy result** creates a short text summary with model, output tokens, duration, rate, and measurement method. It omits prompts, project paths, session IDs, and input counters. Nothing is published automatically.

The app reads session logs locally and makes no account connection or telemetry request. Regular ChatGPT web chats are outside this local data source. Never upload raw Codex session logs to share a benchmark; use the copied summary or your own screenshot.

This project is available under the [MIT License](LICENSE).
