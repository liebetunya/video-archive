#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""코칭 평문 JSON을 공개 데이터 파일로 복사합니다.

classify_coaching.py 규칙으로 하위 분류를 붙인 뒤 data/coaching.json 에 저장합니다. 제목은 바꾸지 않습니다.
기본 출력은 개수만 보여 줍니다.

    python3 scripts/classify_coaching.py /경로/coaching.json
    python3 scripts/publish_coaching.py /경로/coaching.json

한 번에 분류하고 공개 파일까지 쓰려면:

    python3 scripts/publish_coaching.py /경로/coaching.json
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

from classify_coaching import SUBS, classify, coaching_subcategory, configure_stdio
from coaching_exceptions import excluded_from_coaching_page, NOT_COACHING_PAGE


def fail(message: str) -> None:
    print("오류: " + message, file=sys.stderr)
    raise SystemExit(1)


def load_videos(path: Path):
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        fail("입력 JSON을 읽지 못했습니다. " + str(error))
    if isinstance(raw, list):
        return raw, raw
    if isinstance(raw, dict) and isinstance(raw.get("videos"), list):
        return raw, raw["videos"]
    fail("입력은 JSON 배열이거나 {\"videos\": []} 형태여야 합니다.")


def main() -> None:
    configure_stdio()
    root = Path(__file__).resolve().parents[1]
    default_out = root / "data" / "coaching.json"
    parser = argparse.ArgumentParser(description="코칭 평문을 공개 data/coaching.json 으로 만듭니다.")
    parser.add_argument("coaching", type=Path, help="분류할 코칭 평문 JSON")
    parser.add_argument(
        "--out",
        type=Path,
        default=default_out,
        help="공개 JSON 경로 (기본: data/coaching.json)",
    )
    parser.add_argument("--dry-run", action="store_true", help="파일을 쓰지 않고 개수만 출력합니다.")
    args = parser.parse_args()
    if not args.coaching.exists():
        fail("파일을 찾을 수 없습니다: " + str(args.coaching))

    out = args.out.resolve()
    if out.suffix == ".enc.json" or out.name.endswith(".enc.json"):
        fail("암호문 경로에는 쓸 수 없습니다.")

    container, videos = load_videos(args.coaching)
    kept = []
    skipped = []
    for item in videos:
        if not isinstance(item, dict):
            kept.append(item)
            continue
        dest = excluded_from_coaching_page(item.get("id"))
        if dest:
            skipped.append((item.get("id"), dest))
            continue
        kept.append(item)
    if skipped:
        print("코칭 페이지 제외 " + str(len(skipped)) + "개 (직찍 강의에 둡니다)")
        for vid, dest in skipped:
            print("- " + str(vid) + " → " + dest)
        videos[:] = kept
        if isinstance(container, list):
            container[:] = kept
        else:
            container["videos"] = kept
    changed = classify(videos)
    counts = Counter(item.get("subcategory") if isinstance(item, dict) else None for item in videos)
    print("코칭 영상 " + str(len(videos)) + "개")
    for name in SUBS:
        print("- " + name + ": " + str(counts.get(name, 0)) + "개")
    print("하위 분류를 붙이거나 고친 항목 " + str(len(changed)) + "건")

    if args.dry_run:
        print("dry-run 이라 파일은 쓰지 않았습니다.")
        return

    if changed:
        args.coaching.write_text(json.dumps(container, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("분류 반영: " + str(args.coaching))

    out.parent.mkdir(parents=True, exist_ok=True)
    # 공개 파일은 채널 데이터와 같이 배열로 둡니다.
    payload = videos
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if out.exists() and out.read_text(encoding="utf-8") == text:
        print("공개 파일은 이미 같은 내용이라 쓰지 않았습니다: " + str(out))
        return
    out.write_text(text, encoding="utf-8")
    print("공개 파일 저장: " + str(out))


if __name__ == "__main__":
    main()
