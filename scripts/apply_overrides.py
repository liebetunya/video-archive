#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""브라우저에서 내보낸 분류·설명 변경을 데이터 JSON에 반영합니다.

변경 파일 형식 (js/app.js 가 내려주는 파일과 같습니다)::

    {
      "version": 1,
      "kind": "eunjo-video-overrides",
      "exportedAt": "2026-11-18T00:00:00.000Z",
      "overrides": {
        "kakao:VIDEO_ID": {
          "source": "kakao",
          "id": "VIDEO_ID",
          "category": "일반 영상",
          "subcategory": null,
          "description": "설명을 바꿨다면 이 필드가 들어갑니다."
        },
        "channel:VIDEO_ID": {
          "source": "channel",
          "id": "VIDEO_ID",
          "category": "코칭",
          "subcategory": null
        }
      }
    }

키는 ``소스:영상id`` 입니다. 소스는 kakao, channel, coaching 중 하나입니다.
같은 유튜브 id가 카톡과 채널에 모두 있을 수 있어 소스를 함께 적습니다.
설명만 바꾼 경우에도 category, subcategory 는 현재 값으로 들어 있고, description 만
달라집니다. description 필드가 없으면 설명은 건드리지 않습니다.

코칭으로 옮긴 채널 영상은 공개 채널 JSON에서 빼서 ``--coaching`` 평문 파일에 붙입니다.
코칭 평문에서 다른 분류로 옮기면 공개 채널 JSON으로 돌아갑니다.
평문 코칭 파일은 저장소에 커밋하지 말고, 반영 후 encrypt_coaching.js 로 다시 암호화하세요.

예::

    python3 scripts/apply_overrides.py ./eunjo-overrides.json \\
        --kakao data/kakao.json \\
        --channel data/channel.json \\
        --coaching /안전한/경로/coaching.private.json
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

KAKAO_CATEGORIES = {"암웨이 관련", "일반 영상", "소비자에게", "미분류"}
KAKAO_SUBS = {"제품설명", "사업·강의"}
CHANNEL_CATEGORIES = {
    "박주희북텔링",
    "최현홍북텔링",
    "화목한9시",
    "제품설명",
    "박주희",
    "최현홍",
    "강의와미팅",
    "미분류",
    "코칭",
}
KIND = "eunjo-video-overrides"


def configure_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")


def die(message: str) -> None:
    print("오류: " + message, file=sys.stderr)
    raise SystemExit(1)


def load_json(path: Path):
    try:
        with path.open(encoding="utf-8") as handle:
            return json.load(handle)
    except FileNotFoundError:
        die("파일을 찾을 수 없습니다: " + str(path))
    except json.JSONDecodeError as error:
        die("JSON 형식 오류 (" + str(path) + "): " + str(error))


def dump_json(path: Path, data) -> None:
    if not path.parent.exists():
        die("폴더가 없습니다: " + str(path.parent))
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def as_video_list(container, label: str):
    if isinstance(container, list):
        return container
    if isinstance(container, dict) and isinstance(container.get("videos"), list):
        return container["videos"]
    die(label + " 파일은 영상 배열이거나 {\"videos\": []} 형태여야 합니다.")


def refresh_kakao_counts(data: dict) -> None:
    videos = data["videos"]
    counts = data.setdefault("counts", {})
    counts["items"] = len(videos)
    counts["category"] = dict(Counter((item.get("category") or "미분류") for item in videos))
    counts["subcategory"] = dict(Counter((item.get("subcategory") or "(none)") for item in videos))
    counts["with_reviews"] = sum(1 for item in videos if item.get("reviews"))


def parse_overrides(path: Path) -> dict:
    data = load_json(path)
    if not isinstance(data, dict) or not isinstance(data.get("overrides"), dict):
        die('overrides 파일은 {"kind":"eunjo-video-overrides","overrides":{...}} 형태여야 합니다.')
    kind = data.get("kind")
    if kind not in (None, KIND):
        die("kind 값이 " + KIND + " 가 아닙니다.")
    if data.get("version", 1) != 1:
        die("지원하지 않는 version 입니다. version 1만 처리할 수 있습니다.")
    return data["overrides"]


def validate_entry(key: str, entry: dict):
    if not isinstance(entry, dict):
        die(key + ": 항목이 객체가 아닙니다.")
    source = entry.get("source")
    video_id = entry.get("id")
    category = entry.get("category")
    subcategory = entry.get("subcategory")
    if not isinstance(source, str) or not isinstance(video_id, str) or not video_id.strip():
        die(key + ": source 와 id 가 필요합니다.")
    if key != source + ":" + video_id:
        die(key + ": 키는 source:id 이고 값의 source, id 와 같아야 합니다.")
    if source in ("kakao", "playlist"):
        if category not in KAKAO_CATEGORIES:
            die(key + ": 카톡에서 쓸 수 없는 분류입니다: " + str(category))
        if category == "암웨이 관련":
            if subcategory not in KAKAO_SUBS:
                die(key + ": 암웨이 관련 영상은 하위 분류가 제품설명 또는 사업·강의여야 합니다.")
        elif subcategory not in (None, ""):
            die(key + ": 이 분류에는 하위 분류를 둘 수 없습니다.")
        subcategory = subcategory if category == "암웨이 관련" else None
    elif source in ("channel", "coaching"):
        if category not in CHANNEL_CATEGORIES:
            die(key + ": 채널에서 쓸 수 없는 분류입니다: " + str(category))
        subcategory = None
    else:
        die(key + ": source 는 kakao, playlist, channel, coaching 중 하나여야 합니다.")
    if "description" in entry and not isinstance(entry.get("description"), str):
        die(key + ": description 은 문자열이어야 합니다.")
    description = entry["description"] if "description" in entry else None
    return source, video_id, category, subcategory, description


def index_by_id(videos: list, label: str) -> dict:
    found = {}
    for item in videos:
        video_id = item.get("id") if isinstance(item, dict) else None
        if not isinstance(video_id, str) or not video_id:
            die(label + " 파일에 id 가 없는 영상이 있습니다.")
        if video_id in found:
            die(label + " 파일에 같은 id 가 두 번 있습니다: " + video_id)
        found[video_id] = item
    return found


def load_coaching(path: Path | None):
    if path is None:
        return None, None, False
    if not path.exists():
        videos: list = []
        return videos, videos, False
    data = load_json(path)
    videos = as_video_list(data, "coaching")
    return data, videos, True


def main() -> None:
    configure_stdio()
    parser = argparse.ArgumentParser(description="분류·설명 변경 JSON을 카톡/채널/코칭 데이터에 반영합니다.")
    parser.add_argument("overrides", type=Path, help="사이트에서 내보낸 JSON")
    parser.add_argument("--kakao", required=True, type=Path, help="data/kakao.json")
    parser.add_argument("--channel", required=True, type=Path, help="data/channel.json")
    parser.add_argument(
        "--coaching",
        type=Path,
        help="코칭 평문 JSON 경로. 코칭으로 넣거나 코칭에서 빼는 변경이 있으면 필요합니다.",
    )
    parser.add_argument("--dry-run", action="store_true", help="파일을 쓰지 않고 변경 내용만 출력합니다.")
    args = parser.parse_args()

    overrides = parse_overrides(args.overrides)
    kakao_data = load_json(args.kakao)
    channel_data = load_json(args.channel)
    if not isinstance(kakao_data, dict):
        die("kakao 파일은 {\"videos\": []} 형태여야 합니다.")
    kakao_videos = as_video_list(kakao_data, "kakao")
    channel_videos = as_video_list(channel_data, "channel")
    coaching_data, coaching_videos, coaching_existed = load_coaching(args.coaching)

    kakao_index = index_by_id(kakao_videos, "kakao")
    channel_index = index_by_id(channel_videos, "channel")
    coaching_index = index_by_id(coaching_videos, "coaching") if coaching_videos is not None else {}
    overlap = sorted(set(channel_index) & set(coaching_index))
    if overlap:
        die("채널 파일과 코칭 평문에 같은 id가 있습니다: " + ", ".join(overlap))

    plans = []
    seen = set()
    needs_coaching = False
    for key, entry in overrides.items():
        source, video_id, category, subcategory, description = validate_entry(key, entry)
        identity = ("kakao", video_id) if source in ("kakao", "playlist") else ("mine", video_id)
        if identity in seen:
            die("같은 영상이 두 번 지정되었습니다: " + source + ":" + video_id)
        seen.add(identity)

        if source in ("kakao", "playlist"):
            item = kakao_index.get(video_id)
            if item is None:
                die("카톡 데이터에 없는 id입니다: " + video_id)
            plans.append({
                "kind": "kakao",
                "item": item,
                "category": category,
                "subcategory": subcategory,
                "description": description,
            })
            continue

        in_channel = channel_index.get(video_id)
        in_coaching = coaching_index.get(video_id) if coaching_videos is not None else None
        target = "coaching" if category == "코칭" else "channel"
        if in_channel is None and in_coaching is None:
            if coaching_videos is None:
                die(video_id + " 영상을 찾으려면 --coaching 평문 파일이 필요합니다.")
            die("채널/코칭 데이터에 없는 id입니다: " + video_id)
        if target == "coaching" and in_coaching is None:
            needs_coaching = True
        if in_channel is None:
            needs_coaching = True
        current = "channel" if in_channel is not None else "coaching"
        plans.append({
            "kind": "mine",
            "item": in_channel if in_channel is not None else in_coaching,
            "category": category,
            "current": current,
            "target": target,
            "source": source,
            "description": description,
        })

    if needs_coaching and coaching_videos is None:
        die("코칭 분류로 옮기거나 코칭 평문에만 있는 영상이 있습니다. --coaching 경로를 지정하세요. 그 파일은 커밋하지 마세요.")

    notes = []
    kakao_dirty = False
    channel_dirty = False
    coaching_dirty = False

    def apply_description(item, plan) -> bool:
        if plan.get("description") is None:
            return False
        new_desc = plan["description"].strip()
        old_desc = item.get("description") if isinstance(item.get("description"), str) else ""
        if old_desc == new_desc:
            return False
        item["description"] = new_desc
        return True

    for plan in plans:
        item = plan["item"]
        video_id = item.get("id")
        before = item.get("category")
        desc_changed = apply_description(item, plan)
        desc_note = ""
        if plan.get("description") is not None:
            desc_note = " · 설명 수정" if desc_changed else " · 설명 (이미 반영됨)"
        if plan["kind"] == "kakao":
            after_sub = plan["subcategory"]
            changed = item.get("category") != plan["category"] or item.get("subcategory") != after_sub
            if changed:
                item["category"] = plan["category"]
                item["subcategory"] = after_sub
            if changed or desc_changed:
                kakao_dirty = True
            label = plan["category"] + (" · " + after_sub if after_sub else "")
            if changed:
                notes.append("카톡 " + video_id + ": " + str(before) + " → " + label + desc_note)
            elif desc_changed:
                notes.append("카톡 " + video_id + ": 설명 수정")
            else:
                notes.append("카톡 " + video_id + ": " + str(before) + " → " + label + " (이미 반영됨)" + desc_note)
            continue

        changed = item.get("category") != plan["category"]
        if changed:
            item["category"] = plan["category"]
        moved = plan["current"] != plan["target"]
        if moved:
            source_list = channel_videos if plan["current"] == "channel" else coaching_videos
            dest_list = coaching_videos if plan["target"] == "coaching" else channel_videos
            source_list.remove(item)
            dest_list.append(item)
            changed = True
        if (changed or desc_changed) and plan["current"] == "channel":
            channel_dirty = True
        if (changed or desc_changed) and plan["target"] == "channel":
            channel_dirty = True
        if (changed or desc_changed) and (plan["current"] == "coaching" or plan["target"] == "coaching"):
            coaching_dirty = True
        where = ""
        if moved and plan["target"] == "coaching":
            where = " · 공개 목록에서 코칭 평문으로 이동"
        elif moved and plan["target"] == "channel":
            where = " · 코칭 평문에서 공개 목록으로 이동"
        elif plan["source"] != plan["current"] and not moved and not changed:
            where = " · 기록된 source는 " + plan["source"] + ", 실제 위치는 " + plan["current"]
        if changed:
            notes.append("채널 " + video_id + ": " + str(before) + " → " + plan["category"] + where + desc_note)
        elif desc_changed:
            notes.append("채널 " + video_id + ": 설명 수정" + where)
        else:
            notes.append("채널 " + video_id + ": " + str(before) + " → " + plan["category"] + where + " (이미 반영됨)" + desc_note)

    if kakao_dirty:
        refresh_kakao_counts(kakao_data)

    if not notes:
        print("반영할 변경이 없습니다.")
        return

    print("변경 " + str(len(notes)) + "건")
    for line in notes:
        print("- " + line)

    if args.dry_run:
        print("dry-run 이라 파일은 쓰지 않았습니다.")
        return

    if not (kakao_dirty or channel_dirty or coaching_dirty):
        print("파일은 이미 같은 내용이라 쓰지 않았습니다.")
        return

    if kakao_dirty:
        dump_json(args.kakao, kakao_data)
        print("저장: " + str(args.kakao))
    if channel_dirty:
        dump_json(args.channel, channel_data)
        print("저장: " + str(args.channel))
    if coaching_dirty:
        if args.coaching is None or coaching_data is None:
            die("코칭 파일을 써야 하는데 경로가 없습니다.")
        dump_json(args.coaching, coaching_data)
        created = "" if coaching_existed else " (새 파일)"
        print("저장: " + str(args.coaching) + created)
        print("평문 코칭 파일은 커밋하지 마세요. encrypt_coaching.js 로 data/coaching.enc.json 을 다시 만드세요.")


if __name__ == "__main__":
    main()
