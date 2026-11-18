#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""채널 영상 제목을 보고 '화목한9시' 분류를 붙입니다.

제목에 '화목한9시' 또는 '화목한 9시'가 있으면(사이의 공백은 몇 칸이든) category를
화목한9시로 바꿉니다. 데이터 파일을 갈아 끼운 뒤에 이 스크립트를 한 번 실행하면
같은 규칙이 다시 적용됩니다. 이미 그 분류인 영상은 그대로 둡니다.

    python3 scripts/classify_channel.py data/channel.json
    python3 scripts/classify_channel.py data/channel.json --dry-run
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

HWAMOKHAN = re.compile(r"화목한\s*9시")
CATEGORY = "화목한9시"
REASON = "제목에 화목한9시"


def configure_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")


def title_is_hwamokhan(title: str) -> bool:
    return HWAMOKHAN.search(title or "") is not None


def classify_videos(videos: list) -> list:
    """제목 규칙에 맞는 영상의 분류를 바꾸고, 바뀐 항목을 반환합니다."""
    changed = []
    for item in videos:
        if not isinstance(item, dict):
            continue
        if not title_is_hwamokhan(str(item.get("title") or "")):
            continue
        if item.get("category") == CATEGORY:
            continue
        item["category"] = CATEGORY
        item["auto_reason"] = REASON
        changed.append(item)
    return changed


def load_container(path: Path):
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if isinstance(data, list):
        return data, data
    if isinstance(data, dict) and isinstance(data.get("videos"), list):
        return data, data["videos"]
    raise SystemExit("채널 파일은 영상 배열이거나 {\"videos\": []} 형태여야 합니다.")


def main() -> None:
    configure_stdio()
    parser = argparse.ArgumentParser(description="제목의 화목한9시를 채널 분류에 반영합니다.")
    parser.add_argument("channel", type=Path, help="data/channel.json")
    parser.add_argument("--dry-run", action="store_true", help="파일을 쓰지 않고 대상만 출력합니다.")
    args = parser.parse_args()
    if not args.channel.exists():
        raise SystemExit("파일을 찾을 수 없습니다: " + str(args.channel))
    container, videos = load_container(args.channel)
    changed = classify_videos(videos)
    print("화목한9시로 분류 " + str(len(changed)) + "건")
    for item in changed:
        print("- " + str(item.get("id")) + " " + str(item.get("title")))
    if args.dry_run:
        print("dry-run 이라 파일은 쓰지 않았습니다.")
        return
    if not changed:
        print("바꿀 영상이 없어 파일을 쓰지 않았습니다.")
        return
    args.channel.write_text(json.dumps(container, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("저장: " + str(args.channel))


if __name__ == "__main__":
    main()
