#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""코칭 평문 JSON에 하위 분류를 붙입니다.

제목 규칙:
- '하드코아' 또는 '하드코어'가 있으면 하드코아코칭
- '셀프리더' 또는 '셀프코칭방'이 있으면 셀프리더코칭
- 그 밖의 코칭 제목은 그 외 코칭

평문 파일은 data/ 폴더에 두지 마세요. 분류를 붙인 뒤 encrypt_coaching.js 로
data/coaching.enc.json 만 다시 만들어 커밋합니다. 기본 출력은 개수만 보여 줍니다.

    python3 scripts/classify_coaching.py /저장소/밖/coaching.private.json
    python3 scripts/classify_coaching.py /저장소/밖/coaching.private.json --dry-run
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

SUB_HARD = "하드코아코칭"
SUB_SELF = "셀프리더코칭"
SUB_OTHER = "그 외 코칭"
SUBS = (SUB_SELF, SUB_HARD, SUB_OTHER)


def configure_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")


def coaching_subcategory(title: str) -> str:
    text = title or ""
    if "하드코아" in text or "하드코어" in text:
        return SUB_HARD
    if "셀프리더" in text or "셀프코칭방" in text:
        return SUB_SELF
    return SUB_OTHER


def fail(message: str) -> None:
    print("오류: " + message, file=sys.stderr)
    raise SystemExit(1)


def load_videos(path: Path):
    data_dir = (Path(__file__).resolve().parents[1] / "data").resolve()
    abs_path = path.resolve()
    if abs_path == data_dir or data_dir in abs_path.parents:
        fail("data/ 안의 파일은 입력으로 쓸 수 없습니다. 평문은 저장소 밖에 두세요.")
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        fail("입력 JSON을 읽지 못했습니다. " + str(error))
    if isinstance(raw, list):
        return raw, raw
    if isinstance(raw, dict) and isinstance(raw.get("videos"), list):
        return raw, raw["videos"]
    fail("입력은 JSON 배열이거나 {\"videos\": []} 형태여야 합니다.")


def classify(videos: list) -> list:
    changed = []
    for item in videos:
        if not isinstance(item, dict):
            continue
        sub = coaching_subcategory(str(item.get("title") or ""))
        if item.get("subcategory") == sub and item.get("category") == "코칭":
            continue
        item["category"] = "코칭"
        item["subcategory"] = sub
        changed.append(item)
    return changed


def main() -> None:
    configure_stdio()
    parser = argparse.ArgumentParser(description="코칭 평문에 셀프리더/하드코아 하위 분류를 붙입니다.")
    parser.add_argument("coaching", type=Path, help="저장소 밖의 코칭 평문 JSON")
    parser.add_argument("--dry-run", action="store_true", help="파일을 쓰지 않고 개수만 출력합니다.")
    args = parser.parse_args()
    if not args.coaching.exists():
        fail("파일을 찾을 수 없습니다: " + str(args.coaching))
    container, videos = load_videos(args.coaching)
    changed = classify(videos)
    counts = Counter(
        item.get("subcategory") if isinstance(item, dict) else None for item in videos
    )
    print("코칭 영상 " + str(len(videos)) + "개")
    for name in SUBS:
        print("- " + name + ": " + str(counts.get(name, 0)) + "개")
    extra = set(counts) - set(SUBS)
    for name in sorted(extra, key=lambda value: str(value)):
        print("- " + str(name) + ": " + str(counts[name]) + "개")
    print("하위 분류를 바꾼 항목 " + str(len(changed)) + "건")
    if args.dry_run:
        print("dry-run 이라 파일은 쓰지 않았습니다.")
        return
    if not changed:
        print("바꿀 항목이 없어 파일을 쓰지 않았습니다.")
        return
    args.coaching.write_text(json.dumps(container, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("저장: " + str(args.coaching))
    print("평문 파일은 커밋하지 마세요. encrypt_coaching.js 로 data/coaching.enc.json 을 다시 만드세요.")


if __name__ == "__main__":
    main()
