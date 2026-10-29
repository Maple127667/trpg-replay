"""一次性统计脚本：解析跑团平台导出的 JSON 日志，输出结构与异常报告。"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else
           r"D:\Downloads\trpg-story-log-all_pages_all-2026-10-29T18-57-27-694Z.json")

data = json.loads(SRC.read_text(encoding="utf-8"))
print(f"总条数: {len(data)}")
print(f"字段集合: {sorted({k for m in data for k in m})}")

def ts(m): return datetime.strptime(m["timestamp"], "%Y-%m-%d %H:%M:%S")

print(f"时间范围: {data[0]['timestamp']} -> {data[-1]['timestamp']}")
span = ts(data[-1]) - ts(data[0])
print(f"跨度: {span} ({span.total_seconds()/3600:.2f} h)")

pair = Counter((m["content_type"], m["raw_content_type"]) for m in data)
print("\n[content_type <-> raw_content_type]")
for k, v in sorted(pair.items(), key=lambda kv: -kv[1]):
    print(f"  {k[0]:<4} / {k[1]:<12} {v}")

print("\n[按类型 x 发送者]")
by_sender = defaultdict(Counter)
for m in data:
    by_sender[m["sender_name"]][m["content_type"]] += 1
for name, c in sorted(by_sender.items(), key=lambda kv: -sum(kv[1].values())):
    total = sum(c.values())
    print(f"  {name:<10} 共{total:>3}  " + "  ".join(f"{k}:{v}" for k, v in c.most_common()))

print("\n[recalled 条目]")
rec = [m for m in data if m["status"] == "recalled"]
print(f"  共 {len(rec)} 条")
for m in rec:
    print(f"  seq={m['seq']:>4} {m['content_type']:<3} {m['sender_name']:<10} {m['content'][:44]!r}")

seqs = sorted(int(m["seq"]) for m in data)
missing = [n for n in range(seqs[0], seqs[-1] + 1) if n not in set(seqs)]
print(f"\n[seq] {seqs[0]}..{seqs[-1]}  缺失 {len(missing)} 个: {missing}")
dupseq = [s for s, c in Counter(seqs).items() if c > 1]
print(f"  重复 seq: {dupseq}")

print("\n[内容完全重复的相邻条目]")
for a, b in zip(data, data[1:]):
    if a["content"] == b["content"] and a["sender_name"] == b["sender_name"]:
        print(f"  seq {a['seq']}/{b['seq']} status {a['status']}/{b['status']} {a['content'][:36]!r}")

print("\n[时间间隔 > 5min]")
for a, b in zip(data, data[1:]):
    d = (ts(b) - ts(a)).total_seconds()
    if d > 300:
        print(f"  seq {a['seq']:>4}->{b['seq']:>4}  {d/60:6.1f} min   {b['content'][:40]!r}")

print("\n[含 <角色> 定向标记]")
for m in data:
    if re.search(r"<[^>]{1,8}>", m["content"]):
        print(f"  seq={m['seq']:>4} {m['content_type']} {m['sender_name']} :: {m['content'][:60]!r}")

print("\n[[Empty] 条目]")
for m in data:
    if m["content"].strip() in {"[Empty]", "场景发生了变化"}:
        print(f"  seq={m['seq']:>4} {m['content_type']} {m['content_type']} {m['timestamp']} {m['content']!r}")

print("\n[掷骰/暗骰原文]")
for m in data:
    if m["raw_content_type"] in {"roll_dice", "hidden_dice"}:
        print(f"--- seq={m['seq']} {m['content_type']} {m['sender_name']} {m['status']}")
        for line in m["content"].split("\n"):
            print(f"    | {line}")

print("\n[多行非掷骰内容]")
for m in data:
    if "\n" in m["content"] and m["raw_content_type"] not in {"roll_dice", "hidden_dice"}:
        print(f"  seq={m['seq']:>4} {m['content_type']} {m['sender_name']} {m['content'].count(chr(10))}行")
