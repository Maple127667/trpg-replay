"""统计回放需要的画面资源：背景切换点 + 每个角色的表情差分线索。

输出：
  * 所有场景切换点（日志类事件）及其上下文，用于给每张背景命名
  * 每个角色被描写到神态/情绪/状态的句子，按时间排序，用于归纳差分
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOC = json.loads((ROOT / "data" / "replay.json").read_text(encoding="utf-8"))
EVENTS = DOC["events"]
CAST = {c["id"]: c for c in DOC["cast"]}

# 神态/情绪/状态线索词
CUES = {
    "笑": ["笑", "勾起", "咧", "弯起"],
    "惊": ["惊", "愣", "怔", "睁大", "一颤", "僵", "顿住"],
    "惧": ["恐", "怕", "颤", "发抖", "冷汗", "发白", "尖叫", "哭", "抽泣", "泪", "抖"],
    "怒": ["怒", "瞪", "皱眉", "咬牙", "骂", "啧", "冒犯"],
    "专注": ["专注", "冷静", "镇定", "盯", "观察", "记下", "警惕", "警觉", "屏住"],
    "温柔": ["温柔", "轻轻", "摸", "捧", "搂", "扶", "护", "心疼"],
    "疲惫": ["累", "喘", "虚浮", "瘫", "沙哑", "空洞", "失神"],
    "兴奋": ["兴奋", "激动", "亮", "好玩", "有趣"],
    "放松": ["放松", "伸了个懒腰", "神游", "释然", "微笑"],
}

# 谁在场 / 谁被描写
def actors_of(ev: dict) -> set[str]:
    found = set()
    who = ev.get("speaker")
    if who in CAST:
        found.add(who)
    for cid, c in CAST.items():
        if c["name"] in ev.get("text", "") or c["name"] in ev.get("raw", ""):
            found.add(cid)
    return found


def main() -> None:
    print("=" * 74)
    print("一、场景切换点")
    print("=" * 74)
    marks = [(i, e) for i, e in enumerate(EVENTS) if e["type"] == "marker"]
    for i, e in marks:
        kind = "场景发生变化" if e.get("subtype") == "scene" else "[Empty]"
        print(f"\n--- #{e['seq']:>3}  {e['at']}  {kind}")
        # 前两条、后两条上下文
        for j in range(max(0, i - 2), i):
            t = EVENTS[j]["text"].replace("\n", " / ")
            print(f"    ‹前› {EVENTS[j]['type']:<9} {t[:70]}")
        for j in range(i + 1, min(len(EVENTS), i + 3)):
            t = EVENTS[j]["text"].replace("\n", " / ")
            print(f"    ‹后› {EVENTS[j]['type']:<9} {t[:70]}")

    print()
    print("=" * 74)
    print("二、每个角色的神态/情绪线索（按时间）")
    print("=" * 74)

    for cid, c in CAST.items():
        if c["role"] == "kp":
            continue
        rows = []
        for e in EVENTS:
            if e["type"] in ("check", "hidden_check", "marker"):
                continue
            if cid not in actors_of(e):
                continue
            text = e["text"]
            hits = [k for k, words in CUES.items() if any(w in text for w in words)]
            if not hits:
                continue
            rows.append((e["seq"], e["type"], ",".join(hits), text.replace("\n", " / ")[:64]))
        print(f"\n### {c['name']}  ({c['count']} 条事件, 线索 {len(rows)} 条)")
        for seq, typ, hits, text in rows:
            print(f"  #{seq:>3} {typ:<9} [{hits:<8}] {text}")

    print()
    print("=" * 74)
    print("三、每个角色的出场幕 / 首末位置")
    print("=" * 74)
    for cid, c in CAST.items():
        print(f"  {c['name']:<10} {c['role']:<3} {c['count']:>3} 条  幕 {c['presence']}  seq {c['firstSeq']}..{c['lastSeq']}")


if __name__ == "__main__":
    main()
