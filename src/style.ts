/** 播放器样式。全部限定在 Shadow DOM 内，不与宿主博客的 CSS 冲突。 */
export const STYLE = /* css */ `
:host {
  --ink: #e8ecf2;
  --ink-dim: #9aa6b8;
  --bg: #07090d;
  --accent: #d8b26a;
  --serif: "Source Han Serif SC", "Noto Serif SC", "Songti SC", "SimSun", serif;
  --sans: "Inter", "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif;
  display: block;
  width: 100%;
  font-family: var(--sans);
  -webkit-font-smoothing: antialiased;
}

* { box-sizing: border-box; }

.frame {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: var(--bg);
  border-radius: 10px;
  box-shadow: 0 0 0 1px rgba(255,255,255,.07), 0 30px 80px rgba(0,0,0,.55);
  isolation: isolate;
  user-select: none;
}

.stage {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 1280px;
  height: 720px;
  transform: translate(-50%, -50%) scale(var(--scale, 1));
  transform-origin: center center;
  overflow: hidden;
}

/* ---------------------------------------------------------------- 背景 */
.bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  transition: opacity 900ms ease, filter 900ms ease;
  will-change: opacity;
}
.bg.bg-next { opacity: 0; }
.bg.bg-next.in { opacity: 1; }

.grain {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: .16;
  mix-blend-mode: overlay;
  background-image:
    radial-gradient(circle at 20% 30%, rgba(255,255,255,.10) 0 1px, transparent 1px),
    radial-gradient(circle at 70% 70%, rgba(255,255,255,.08) 0 1px, transparent 1px);
  background-size: 3px 3px, 5px 5px;
}

.vignette {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 50% 45%, transparent 38%, rgba(4,6,9,.72) 100%),
    linear-gradient(to bottom, rgba(4,6,9,.55) 0%, transparent 22%, transparent 62%, rgba(4,6,9,.88) 100%);
}

/* ---------------------------------------------------------------- 立绘 */
.cast { position: absolute; inset: 0; pointer-events: none; }

.char {
  position: absolute;
  bottom: 0;
  width: 560px;
  height: 660px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  opacity: 0;
  transform: translateY(14px) scale(.99);
  transition: opacity 420ms ease, transform 420ms ease, filter 420ms ease;
  filter: saturate(.85) brightness(.82);
}
.char.show { opacity: 1; transform: translateY(0) scale(1); }
.char.active { filter: saturate(1) brightness(1); }
.char[data-slot="left"]   { left: -30px; }
.char[data-slot="right"]  { right: -30px; }
.char[data-slot="center"] { left: 50%; transform: translateX(-50%) translateY(14px); }
.char[data-slot="center"].show { transform: translateX(-50%) translateY(0); }

.char img { max-height: 100%; max-width: 100%; object-fit: contain; }

.char .ph {
  width: 320px;
  height: 440px;
  padding-top: 96px;
  border-radius: 160px 160px 24px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  border: 1px solid rgba(255,255,255,.14);
  background: linear-gradient(160deg, var(--c1, #2a3140), var(--c2, #11151c));
  box-shadow: 0 30px 80px rgba(0,0,0,.55), inset 0 0 60px rgba(255,255,255,.05);
}
.char .ph b {
  font-family: var(--serif);
  font-size: 88px;
  font-weight: 500;
  color: rgba(255,255,255,.86);
  letter-spacing: 2px;
}
.char .ph span { font-size: 13px; color: rgba(255,255,255,.42); letter-spacing: .28em; }

/* ---------------------------------------------------------------- HUD */
.hud {
  position: absolute;
  left: 34px;
  top: 26px;
  right: 34px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  pointer-events: none;
  opacity: 0;
  transition: opacity 500ms ease;
}
.hud.show { opacity: 1; }

.title {
  font-family: var(--serif);
  font-size: 17px;
  color: rgba(232,236,242,.62);
  letter-spacing: .34em;
}
.title::after {
  content: "";
  display: block;
  width: 44px;
  height: 1px;
  margin-top: 9px;
  background: linear-gradient(to right, var(--accent), transparent);
}

.san { display: flex; flex-direction: column; gap: 7px; align-items: flex-end; }
.san-row { display: flex; align-items: center; gap: 9px; opacity: .95; }
.san-name { font-size: 11px; color: rgba(232,236,242,.5); letter-spacing: .12em; }
.san-bar {
  width: 108px; height: 4px; border-radius: 2px;
  background: rgba(255,255,255,.13); overflow: hidden;
}
.san-fill {
  height: 100%; width: 100%;
  background: linear-gradient(to right, #7fb3d5, #cfe3f3);
  transition: width 900ms cubic-bezier(.2,.8,.2,1), background 900ms ease;
}
.san-fill.low { background: linear-gradient(to right, #c05a5a, #e08b8b); }
.san-val { font-size: 11px; color: rgba(232,236,242,.62); width: 22px; text-align: right; font-variant-numeric: tabular-nums; }

/* ---------------------------------------------------------------- 文本层 */
.body {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  pointer-events: none;
}

/* 旁白 */
.narration {
  align-self: center;
  max-width: 880px;
  margin-bottom: 168px;
  padding: 0 40px;
  font-family: var(--serif);
  font-size: 29px;
  line-height: 1.95;
  color: var(--ink);
  text-align: center;
  text-shadow: 0 2px 24px rgba(0,0,0,.85), 0 0 60px rgba(0,0,0,.6);
  letter-spacing: .02em;
  animation: rise 620ms cubic-bezier(.2,.8,.2,1) both;
}
.narration .seg { display: block; margin: 4px 0; }
.narration .seg i {
  font-style: normal;
  color: var(--accent);
  margin-right: 10px;
  font-size: .82em;
  letter-spacing: .1em;
  opacity: .9;
}

/* 行动描写 */
.action {
  align-self: center;
  max-width: 820px;
  margin-bottom: 172px;
  padding: 0 40px;
  font-family: var(--serif);
  font-size: 23px;
  line-height: 1.85;
  color: #c3cddb;
  text-align: center;
  font-style: italic;
  text-shadow: 0 2px 20px rgba(0,0,0,.9);
  animation: rise 520ms cubic-bezier(.2,.8,.2,1) both;
}

/* 对话 / 心声 */
.bubble {
  position: relative;
  margin: 0 74px 66px;
  padding: 22px 34px 26px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(14,18,25,.90), rgba(9,12,17,.95));
  border: 1px solid rgba(255,255,255,.10);
  box-shadow: 0 24px 70px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.07);
  backdrop-filter: blur(10px);
  animation: rise 380ms cubic-bezier(.2,.8,.2,1) both;
}
.bubble::before {
  content: "";
  position: absolute;
  left: 34px; top: -1px;
  width: 64px; height: 2px;
  background: var(--accent);
  opacity: .75;
}
.bubble-name {
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
  font-family: var(--serif);
  font-size: 20px;
  letter-spacing: .12em;
  margin-bottom: 10px;
}
.bubble-name em {
  font-style: normal;
  font-size: 10px;
  letter-spacing: .3em;
  color: rgba(255,255,255,.35);
  font-family: var(--sans);
}
.bubble-text {
  font-family: var(--serif);
  font-size: 25px;
  line-height: 1.85;
  color: var(--ink);
  letter-spacing: .01em;
  min-height: 1.85em;
}
.bubble-text .caret {
  display: inline-block;
  width: 2px; height: 1em;
  margin-left: 2px;
  background: var(--accent);
  vertical-align: -0.12em;
  animation: blink 1s steps(1) infinite;
}

.thought {
  border-style: dashed;
  border-color: rgba(255,255,255,.16);
  background: linear-gradient(180deg, rgba(18,20,28,.82), rgba(10,12,18,.9));
}
.thought .bubble-text { font-style: italic; color: #c9d2e2; }
.thought .bubble-name { color: #b9c6dc; }

/* 无线电 */
.radio .bubble-text { font-family: var(--sans); letter-spacing: .06em; color: #d6e3f0; }

/* 定向私密 */
.private-tag {
  position: absolute;
  left: 50%;
  top: -34px;
  transform: translateX(-50%);
  font-size: 10px;
  letter-spacing: .18em;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(216,178,106,.14);
  border: 1px solid rgba(216,178,106,.42);
  color: #e0c48a;
}

/* ---------------------------------------------------------------- 掷骰 */
.check-wrap {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.check {
  width: 430px;
  padding: 26px 30px 28px;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(16,20,28,.96), rgba(8,11,16,.98));
  border: 1px solid rgba(255,255,255,.12);
  box-shadow: 0 34px 90px rgba(0,0,0,.72), inset 0 1px 0 rgba(255,255,255,.08);
  animation: pop 420ms cubic-bezier(.2,.9,.3,1.1) both;
  text-align: center;
}
.check-prompt {
  font-family: var(--serif);
  font-size: 15px;
  line-height: 1.7;
  color: rgba(232,236,242,.62);
  margin-bottom: 14px;
  min-height: 1em;
}
.check-skill {
  font-family: var(--serif);
  font-size: 22px;
  letter-spacing: .16em;
  color: var(--ink);
  margin-bottom: 4px;
}
.check-target { font-size: 12px; color: rgba(232,236,242,.42); letter-spacing: .2em; margin-bottom: 14px; }
.check-dice {
  font-family: "Inter", var(--sans);
  font-size: 76px;
  font-weight: 200;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
  letter-spacing: .02em;
  transition: color 260ms ease;
}
.check-level {
  margin-top: 12px;
  font-size: 14px;
  letter-spacing: .3em;
  min-height: 1.4em;
  color: var(--lvl, #8fb8dd);
  opacity: 0;
  transition: opacity 300ms ease;
}
.check-level.in { opacity: 1; }
.check-loss {
  margin-top: 8px;
  font-family: var(--serif);
  font-size: 15px;
  color: #e08b8b;
  letter-spacing: .1em;
  opacity: 0;
  transition: opacity 400ms ease;
}
.check-loss.in { opacity: 1; }
.check-badge {
  display: inline-block;
  font-size: 9px;
  letter-spacing: .3em;
  color: rgba(216,178,106,.8);
  border: 1px solid rgba(216,178,106,.3);
  border-radius: 999px;
  padding: 3px 10px;
  margin-bottom: 14px;
}

/* ---------------------------------------------------------------- 场景卡 */
.scene-card {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: rgba(4,6,9,.78);
  backdrop-filter: blur(3px);
  animation: fade 520ms ease both;
}
.scene-card.out { animation: fadeout 620ms ease both; }
.scene-no {
  font-size: 11px;
  letter-spacing: .5em;
  color: rgba(216,178,106,.75);
}
.scene-label {
  font-family: var(--serif);
  font-size: 40px;
  letter-spacing: .16em;
  color: var(--ink);
}
.scene-line { width: 76px; height: 1px; background: rgba(255,255,255,.22); }

/* ---------------------------------------------------------------- OOC */
.ooc {
  position: absolute;
  left: 50%;
  top: 74px;
  transform: translateX(-50%);
  max-width: 760px;
  padding: 9px 18px;
  border-radius: 999px;
  background: rgba(28,32,40,.86);
  border: 1px solid rgba(255,255,255,.09);
  font-size: 13px;
  color: rgba(232,236,242,.6);
  animation: rise 300ms ease both;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ooc b { color: rgba(232,236,242,.85); font-weight: 500; margin-right: 8px; }

/* ---------------------------------------------------------------- 控制条 */
.ui {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  padding: 12px 20px 14px;
  display: flex;
  align-items: center;
  gap: 14px;
  background: linear-gradient(to top, rgba(4,6,9,.92), transparent);
  opacity: 0;
  transition: opacity 240ms ease;
}
.frame:hover .ui, .frame:focus-within .ui, .ui.pinned { opacity: 1; }

.btn {
  appearance: none;
  border: 0;
  background: rgba(255,255,255,.07);
  color: rgba(232,236,242,.86);
  width: 32px; height: 32px;
  border-radius: 8px;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background 160ms ease, color 160ms ease;
  padding: 0;
}
.btn:hover { background: rgba(255,255,255,.16); color: #fff; }
.btn svg { width: 15px; height: 15px; fill: currentColor; }
.btn.wide { width: auto; padding: 0 11px; font-size: 11px; letter-spacing: .1em; }
.btn.on { background: rgba(216,178,106,.22); color: #f0d9a8; }

.spacer { flex: 1; }

.scene-btn {
  appearance: none; border: 0; background: transparent; cursor: pointer;
  color: rgba(232,236,242,.62); font-size: 11px; letter-spacing: .18em;
  padding: 6px 4px; font-family: var(--sans);
  max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.scene-btn:hover { color: #fff; }

.progress {
  position: absolute;
  left: 0; right: 0; bottom: 0;
  height: 2px;
  background: rgba(255,255,255,.10);
  cursor: pointer;
}
.progress-fill {
  height: 100%;
  width: 0;
  background: linear-gradient(to right, rgba(216,178,106,.55), var(--accent));
  transition: width 200ms linear;
}

.chapters {
  position: absolute;
  right: 20px; bottom: 56px;
  width: 260px;
  padding: 8px;
  border-radius: 10px;
  background: rgba(12,15,21,.96);
  border: 1px solid rgba(255,255,255,.10);
  box-shadow: 0 20px 50px rgba(0,0,0,.6);
  display: none;
}
.chapters.open { display: block; }
.chapters button {
  display: block; width: 100%; text-align: left;
  background: transparent; border: 0; cursor: pointer;
  color: rgba(232,236,242,.72);
  font-size: 12px; padding: 9px 10px; border-radius: 6px;
  font-family: var(--sans);
}
.chapters button:hover { background: rgba(255,255,255,.08); color: #fff; }
.chapters button span { color: rgba(216,178,106,.7); margin-right: 8px; font-size: 10px; }

/* ---------------------------------------------------------------- 结束卡 */
.end {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 18px;
  background: rgba(4,6,9,.92);
  animation: fade 700ms ease both;
}
.end .t { font-family: var(--serif); font-size: 30px; letter-spacing: .3em; color: var(--ink); }
.end .s { font-size: 12px; letter-spacing: .3em; color: rgba(232,236,242,.4); }

@keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
@keyframes pop { from { opacity: 0; transform: scale(.94); } to { opacity: 1; transform: none; } }
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeout { from { opacity: 1; } to { opacity: 0; } }
@keyframes blink { 50% { opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  * { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
`
