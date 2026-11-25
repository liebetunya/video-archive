#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""제목에 '코칭'이 있어도 코칭 페이지에 두지 않을 영상.

은조님이 직찍 강의 탭의 다른 분류로 옮기라고 하신 항목입니다.
23시 루틴이나 제목 자동 분류가 이 id를 다시 코칭 페이지에 넣으면 안 됩니다.
"""

from __future__ import annotations

# id -> 직찍 강의 분류
NOT_COACHING_PAGE = {
    "ZQBk_o5Bvcs": "각오미팅",  # 260409목 사업설명2. 4사분면 줌코칭
    "_p1F6gufVps": "제품설명",  # 260315일 줌코칭.아토피. …
}


def excluded_from_coaching_page(video_id: str | None) -> str | None:
    """코칭 페이지에서 빼야 하면 직찍 강의 분류 이름을, 아니면 None을 반환합니다."""
    if not video_id:
        return None
    return NOT_COACHING_PAGE.get(str(video_id).strip())
