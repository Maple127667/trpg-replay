# trpg-replay · 跑团 log 动态回放器

把跑团平台导出的聊天日志，渲染成可嵌入博客的**动态跑团记录**（视觉小说式回放）。

> 引擎与数据分离：播放器只认 `data/replay.json`，换一份 log 不需要改播放器。

## 当前状态

- [x] 日志解析器：原始 JSON → 结构化回放脚本（`trpg-replay/1` schema）
- [x] 掷骰解析：理智检定 / 技能检定 / 惩罚骰 / 暗骰 四种格式全部结构化
- [x] 场景切分、角色表、旁白归属异常检测
- [ ] 播放器（Web Component，16:9 视觉小说）
- [ ] 打包为单文件 bundle，可 CDN 引入

## 目录

```
tools/
  inspect_log.py     一次性统计：看看 log 里到底有什么、有什么坑
  build_replay.py    正式解析器：原始 log → data/replay.json
data/
  replay.json        回放脚本（播放器唯一的输入）
```

## 数据格式

`data/replay.json` 大致长这样：

```jsonc
{
  "schema": "trpg-replay/1",
  "meta":   { "title": "…", "startedAt": "…", "durationSeconds": 18484 },
  "cast":   [ { "id": "liangyan", "name": "梁琰", "role": "pc", "count": 96 } ],
  "scenes": [ { "index": 0, "label": "甲板层 · 起雾", "startSeq": 3, "endSeq": 100 } ],
  "events": [
    { "seq": 15, "type": "dialogue", "speaker": "wenkele", "text": "…", "ms": 4200 },
    { "seq": 69, "type": "check",    "speaker": "liangyan",
      "check": { "kind": "san", "roll": 23, "target": 75, "level": "成功", "lossValue": 0 } }
  ]
}
```

`type` 取值：`narration`（旁白）/ `dialogue`（对话）/ `action`（行动）/ `thought`（心声）/
`check`（掷骰）/ `hidden_check`（暗骰）/ `ooc`（闲聊）/ `marker`（场景切换）。

每条事件都保留 `seq` 与 `raw` 原文，便于回溯校对。

## 用法

```bash
python tools/build_replay.py     # 重新生成 data/replay.json
```

解析器里 `SRC` 常量指向原始导出文件，换 log 时改这一行即可。

## 素材脚本

`make_transparent.py` 把白底角色插画批量抠成透明 PNG（供立绘使用）。
