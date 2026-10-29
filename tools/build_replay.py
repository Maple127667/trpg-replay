"""把平台导出的原始 log 解析成「回放脚本」(replay.json)。

设计原则：
  * 引擎与数据分离 —— 播放器只认 replay.json，换一份 log 不用改播放器。
  * 保留原文 —— 每条事件都带 source.seq 与 raw 文本，方便回溯校对。
  * 能解析的就结构化（掷骰），解析不了的保留原文并标记，绝不丢信息。
"""
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(r"D:\Downloads\trpg-story-log-all_pages_all-2026-10-29T18-57-27-694Z.json")
OUT = ROOT / "data" / "replay.json"

# ---------------------------------------------------------------- 角色表
# 名字 -> 稳定 id。原 log 只有显示名，没有可靠的角色 id。
CAST = [
    ("Maple", "maple", "kp"),
    ("梁琰", "liangyan", "pc"),
    ("温可乐", "wenkele", "pc"),
    ("杰西卡·杰克逊", "jessica", "pc"),
    ("西西弗斯·沃德", "sisyphus", "pc"),
    ("安吉洛·耶伍德", "angelo", "npc"),
]
NAME2ID = {n: i for n, i, _ in CAST}
ROLE = {i: r for _, i, r in CAST}

# 幕（场景）标题：log 里只有「场景发生了变化」，没有名字，这里是**推断值**，待确认。
# 与美术对齐后固定为 4 幕，对应 4 张背景（art/bg/scene-0X-*.{png,jpg}）。
SCENE_LABELS = [
    "北海九号 · 甲板层",
    "生活层 · 走廊",
    "C-01 宿舍",
    "工程层 · 服务器控制室",
]

TYPE_MAP = {
    "talk": "dialogue",
    "voiceover": "narration",
    "action": "action",
    "in_mind": "thought",
    "chat": "ooc",
    "roll_dice": "check",
    "hidden_dice": "hidden_check",
    "log": "marker",
}

LEVEL_RANK = {
    "大成功": 5, "极难成功": 4, "困难成功": 3,
    "普通成功": 2, "成功": 2, "失败": 1, "大失败": 0,
}

# 角色退场点：到达该 seq 后立绘下场。
# 西西弗斯 seq 63 惨叫、65 尸体坠落到甲板，之后不再有台词，视为死亡退场。
EXITS = {
    "sisyphus": 65,
}

RE_SAN = re.compile(r"^(?P<name>.+?)\s+理智检定\s+(?P<roll>\d+)/(?P<target>\d+)\s*=>\s*(?P<level>\S+)$")
RE_SKILL = re.compile(
    r"^(?P<name>.+?)\s+检定了\s*(?P<skill>.+?)，出目/检定:\s*"
    r"(?P<roll>\d+)/(?P<target>\d+)\s*=>\s*(?P<level>.+?)\s*!?$"
)
RE_DICEPOOL = re.compile(
    r"^(?P<kind>惩罚骰|奖励骰)：十位 (?P<tens_a>\d+) / (?P<tens_b>\d+)，取 (?P<tens>\d+)；"
    r"个位 (?P<unit>\d+)；结果 (?P<total>\d+)$"
)
RE_HIDDEN = re.compile(r"^(?P<name>.+?)\s+进行了检定$")
RE_HIDDEN_DICE = re.compile(r"^(?P<formula>\d*[dD]\d+)$")
RE_HIDDEN_EQ = re.compile(r"^(?P<roll>\d+)\s*=\s*(?P<value>\d+)$")
RE_MONTAGE = re.compile(r"^(?P<where>[^\s：]{2,10})：\s*(?P<what>.+)$")
RE_AUDIENCE = re.compile(r"^<(?P<who>[^>]{1,8})>\s*")

SCENE_TAG = re.compile(r"^宇宙恐怖(?P<kind>理智检定|属性检定|惩罚骰|奖励骰)$")


def norm_level(s: str) -> str:
    return s.strip().rstrip("!").strip()


def parse_check(text: str) -> dict:
    """掷骰 / 暗骰文本 -> 结构化。原文格式有三种，全部在这里兼容。"""
    lines = text.split("\n")
    out: dict = {"systemTag": None}

    # --- 暗骰：「主持人之外不可见 / X 进行了检定 / 1D10 / 8 = 8 / 最终结果：8」
    if lines and lines[0].strip() == "主持人之外不可见":
        out.update(kind="hidden", visibleToPlayers=False)
        body = [l.strip() for l in lines[1:] if l.strip()]
        for i, line in enumerate(body):
            if m := RE_HIDDEN.match(line):
                out["actor"] = m.group("name")
            elif m := RE_HIDDEN_DICE.match(line):
                out["formula"] = m.group("formula")
            elif m := RE_HIDDEN_EQ.match(line):
                out["roll"] = int(m.group("roll"))
                out["value"] = int(m.group("value"))
            elif line.startswith("最终结果"):
                out["total"] = int(re.sub(r"\D", "", line) or 0)
        return out

    # --- 公开掷骰：前面若干行是「检定缘由」，之后是「宇宙恐怖XX检定」标签行
    head = next(
        (i for i, l in enumerate(lines) if SCENE_TAG.match(l.strip())), None
    )
    if head is None:
        out.update(kind="unparsed", raw=text)
        return out

    out["prompt"] = "\n".join(l.strip() for l in lines[:head] if l.strip())
    out["systemTag"] = "宇宙恐怖"
    tag = SCENE_TAG.match(lines[head].strip()).group("kind")
    body = [l.strip() for l in lines[head + 1:] if l.strip()]

    if tag == "理智检定":
        for line in body:
            if m := RE_SAN.match(line):
                out.update(
                    kind="san", actor=m.group("name"),
                    roll=int(m.group("roll")), target=int(m.group("target")),
                    level=norm_level(m.group("level")),
                )
            elif m := re.match(r"^理智损失\s*=\s*(?P<expr>.+?)\s*=>\s*(?P<value>-?\d+)$", line):
                out["lossExpr"] = m.group("expr").strip()
                out["lossValue"] = int(m.group("value"))
        out.setdefault("kind", "san")

    elif tag in ("惩罚骰", "奖励骰"):
        out["kind"] = "dice_pool"
        for line in body:
            if m := RE_DICEPOOL.match(line):
                out.update(
                    pool=tag, tens=[int(m.group("tens_a")), int(m.group("tens_b"))],
                    tensKeep=int(m.group("tens")), unit=int(m.group("unit")),
                    total=int(m.group("total")), roll=int(m.group("total")),
                )

    else:  # 属性检定（其实就是技能检定）
        for line in body:
            if m := RE_SKILL.match(line):
                out.update(
                    kind="skill", actor=m.group("name"),
                    skill=m.group("skill").strip(),
                    roll=int(m.group("roll")), target=int(m.group("target")),
                    level=norm_level(m.group("level")),
                )
        out.setdefault("kind", "skill")

    if "level" in out:
        out["rank"] = LEVEL_RANK.get(out["level"], -1)
    return out


def parse_body(raw: str, rtype: str) -> dict:
    """正文 -> 显示文本 + 附加语义（受众 / 频道 / 蒙太奇分段）。"""
    text = raw
    meta: dict = {}

    if rtype == "voiceover" and text.startswith("旁白\n"):
        text = text[len("旁白\n"):]

    # 定向旁白：<梁琰>xxx —— 只有该角色能感知
    if rtype == "voiceover":
        if m := RE_AUDIENCE.match(text):
            who = m.group("who")
            if who in NAME2ID:
                meta["audience"] = [NAME2ID[who]]
                text = text[m.end():]

    # 无线电/广播：「...」
    s = text.strip()
    if s.startswith("「") and s.endswith("」"):
        meta["channel"] = "radio"

    # 蒙太奇：一段旁白里并列多个地点（seq 230 那种）
    lines = text.split("\n")
    segs = [m.groupdict() for line in lines if (m := RE_MONTAGE.match(line.strip()))]
    if len(segs) >= 2:
        meta["subtype"] = "montage"
        meta["segments"] = [{"where": g["where"], "what": g["what"]} for g in segs]
        # 第一段地点分行之前的正文不属于任何地点，单独保留，别丢掉
        first = next(
            i for i, line in enumerate(lines) if RE_MONTAGE.match(line.strip())
        )
        lead = "\n".join(lines[:first]).strip()
        if lead:
            meta["lead"] = lead

    return {"text": text, **meta}


def suggest_ms(kind: str, text: str) -> int:
    """给播放器的建议停留时长（毫秒）。只是建议，播放器可覆盖。"""
    if kind in ("check", "hidden_check"):
        return 1800 if kind == "check" else 900
    n = len(re.sub(r"\s", "", text))
    base = {"narration": 900, "dialogue": 750, "action": 800, "thought": 850, "ooc": 600}.get(kind, 700)
    return max(1200, min(base + n * 95, 9000))


def main() -> None:
    raw = json.loads(SRC.read_text(encoding="utf-8"))
    raw.sort(key=lambda m: int(m["seq"]))
    t0 = datetime.strptime(raw[0]["timestamp"], "%Y-%m-%d %H:%M:%S")

    cast: dict[str, dict] = {
        cid: {"id": cid, "name": name, "role": role, "count": 0,
              "firstSeq": None, "lastSeq": None,
              "types": {}, "presence": []}
        for name, cid, role in CAST
    }

    events: list[dict] = []
    scenes: list[dict] = []
    current_scene = None
    dropped = []

    for m in raw:
        rtype = m["raw_content_type"]
        seq = int(m["seq"])
        name = m["sender_name"]
        cid = NAME2ID.get(name)
        if cid is None:  # 未知说话人，动态补进角色表
            cid = re.sub(r"\W", "", name) or "unknown"
            NAME2ID[name] = cid
            cast[cid] = {"id": cid, "name": name, "role": "unknown", "count": 0,
                         "firstSeq": None, "lastSeq": None, "types": {}, "presence": []}
            ROLE[cid] = "unknown"

        if m["status"] == "recalled":
            dropped.append({"seq": seq, "reason": "recalled", "text": m["content"][:40]})
            continue

        kind = TYPE_MAP.get(rtype)
        if kind is None:
            kind = "unknown"

        ev: dict = {
            "seq": seq,
            "at": m["timestamp"],
            "t": int((datetime.strptime(m["timestamp"], "%Y-%m-%d %H:%M:%S") - t0).total_seconds()),
            "type": kind,
            "speaker": cid,
            "raw": m["content"],
        }

        if kind == "marker":
            content = m["content"].strip()
            if content == "场景发生了变化":
                ev["subtype"] = "scene"
                current_scene = {"index": len(scenes), "startSeq": seq,
                                 "label": SCENE_LABELS[len(scenes)] if len(scenes) < len(SCENE_LABELS) else f"场景 {len(scenes)+1}",
                                 "labelConfidence": "inferred"}
                scenes.append(current_scene)
            else:
                ev["subtype"] = "empty"
                ev["note"] = "平台导出为此条无内容，疑为场景板/插画/手卡，待确认"
            ev["text"] = m["content"]
        elif kind in ("check", "hidden_check"):
            body = parse_body(m["content"], rtype)
            ev["text"] = m["content"]
            ev["check"] = parse_check(m["content"])
            # 暗骰：不向观众展示，只留数据层
            if kind == "hidden_check":
                ev["visibleToPlayers"] = False
                ev["text"] = "（暗骰·主持人可见）"
        else:
            body = parse_body(m["content"], rtype)
            ev["text"] = body.pop("text")
            ev.update(body)

        ev["ms"] = suggest_ms(kind, ev.get("text", ""))
        ev["scene"] = current_scene["index"] if current_scene else 0
        if not scenes:
            scenes.append(current_scene := {"index": 0, "startSeq": seq, "label": SCENE_LABELS[0],
                                            "labelConfidence": "inferred"})
            ev["scene"] = 0
        events.append(ev)

        # 统计
        rec = cast[cid]
        rec["count"] += 1
        rec["firstSeq"] = rec["firstSeq"] or seq
        rec["lastSeq"] = seq
        rec["types"][kind] = rec["types"].get(kind, 0) + 1
        if kind != "narration" and (not rec["presence"] or rec["presence"][-1] != ev["scene"]):
            rec["presence"].append(ev["scene"])

    # 收尾：场景结束 seq
    for i, sc in enumerate(scenes):
        sc["endSeq"] = (scenes[i + 1]["startSeq"] - 1) if i + 1 < len(scenes) else events[-1]["seq"]
        sc["eventCount"] = sum(1 for e in events if e["scene"] == i)

    # 旁白归属异常：旁白本应由 KP 发出，但 log 里有几条挂在玩家名下
    anomalies = []
    for e in events:
        if e["type"] == "narration" and e["raw"].startswith("旁白") and e["speaker"] != "maple":
            anomalies.append({"seq": e["seq"], "attributedTo": cast[e["speaker"]]["name"],
                              "text": e["text"][:30]})
    for e in events:
        if e["type"] == "narration" and not e["raw"].startswith("旁白"):
            # 玩家直接写的旁白（没有「旁白」前缀）
            if e["speaker"] != "maple":
                anomalies.append({"seq": e["seq"], "attributedTo": cast[e["speaker"]]["name"],
                                  "text": e["text"][:30], "noPrefix": True})

    doc = {
        "schema": "trpg-replay/1",
        "meta": {
            "title": "北海九号",
            "titleConfidence": "inferred",
            "systemTag": "宇宙恐怖",
            "source": SRC.name,
            "exportedAt": "2026-10-29T18:57:27.694Z",
            "startedAt": raw[0]["timestamp"],
            "endedAt": raw[-1]["timestamp"],
            "durationSeconds": events[-1]["t"] if events else 0,
            "rawCount": len(raw),
            "eventCount": len(events),
            "droppedCount": len(dropped),
            "generatedBy": "tools/build_replay.py",
        },
        "cast": [c for c in cast.values() if c["count"]],
        "scenes": scenes,
        "events": events,
        "exits": EXITS,
        "anomalies": {
            "dropped": dropped,
            "narrationAttribution": anomalies,
            "missingSeq": None,
            "unparsedChecks": [e["seq"] for e in events
                               if e["type"] in ("check", "hidden_check")
                               and e["check"].get("kind") == "unparsed"],
        },
    }

    # 缺失 seq（导出过滤掉的条目）
    seqs = {int(m["seq"]) for m in raw}
    doc["anomalies"]["missingSeq"] = [n for n in range(min(seqs), max(seqs) + 1) if n not in seqs]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")

    # ------------------------------------------------------------ 控制台摘要
    print(f"事件 {len(events)} 条 / 原始 {len(raw)} 条 / 丢弃召回 {len(dropped)} 条")
    print(f"跨度 {doc['meta']['durationSeconds']/3600:.2f}h   幕数 {len(scenes)}")
    for sc in scenes:
        print(f"  幕{sc['index']+1} [{sc['startSeq']:>3}-{sc['endSeq']:>3}] {sc['label']}  {sc['eventCount']} 条")
    print("\n角色:")
    for c in doc["cast"]:
        print(f"  {c['name']:<10} {c['role']:<3} {c['count']:>3} 条  seq {c['firstSeq']}..{c['lastSeq']}"
              f"  出场幕 {c['presence']}  " + " ".join(f"{k}:{v}" for k, v in c["types"].items()))
    print(f"\n旁白归属异常 {len(anomalies)} 条: {[a['seq'] for a in anomalies]}")
    print(f"暗骰 {sum(1 for e in events if e['type']=='hidden_check')} 条")
    print(f"未解析掷骰: {doc['anomalies']['unparsedChecks']}")
    print(f"\n输出 -> {OUT}")


if __name__ == "__main__":
    main()
