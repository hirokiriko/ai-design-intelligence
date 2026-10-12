"""保存候補のURLだけを判定する純粋フィルタ。取得・保存・順位付けは行わない。"""
from __future__ import annotations

from collections.abc import Mapping, Sequence
from copy import deepcopy
import re
from typing import Any, Literal, TypedDict
from urllib.parse import urlsplit


FILTER_VERSION = "saved-article-links-1"
ExclusionReason = Literal["pagination", "index_link"]
EXCLUSION_REASONS: tuple[ExclusionReason, ...] = ("pagination", "index_link")
PAGINATION_PATH_PATTERN = r"/news_list/page/[1-9][0-9]*/?"
INDEX_PATHS = ("/news", "/news/")


class ExcludedCandidate(TypedDict):
    index: int
    reason: ExclusionReason
    candidate: dict[str, Any]


class FilterResult(TypedDict):
    version: str
    candidates: list[dict[str, Any]]
    excluded: list[ExcludedCandidate]


def _exclusion_reason(value: object, source_hostname: str) -> ExclusionReason | None:
    # 不明・非正規URLを推測で除外しない。取得の許可判定は別層で行う。
    if not isinstance(value, str) or any(ord(character) <= 32 for character in value):
        return None
    if "?" in value or "#" in value:
        return None
    try:
        parsed = urlsplit(value)
        if parsed.hostname != source_hostname:
            return None
    except ValueError:
        return None
    if re.fullmatch(PAGINATION_PATH_PATTERN, parsed.path):
        return "pagination"
    if parsed.path in INDEX_PATHS:
        return "index_link"
    return None


def filter_candidates(candidates: Sequence[Mapping[str, Any]], source_url: str) -> FilterResult:
    """上限適用前の全候補に適用し、保持順と除外理由を返す。

    同一source hostnameの正確なページ送りと記事一覧だけを除外する。
    見出し、記事番号、slug、別ホスト、query、fragmentは除外根拠にしない。
    入力は変更せず、返却候補もdeepcopyで入力から分離する。
    """
    try:
        source_hostname = urlsplit(source_url).hostname
    except (AttributeError, TypeError, ValueError) as error:
        raise ValueError("SOURCE_HOSTNAME_REQUIRED") from error
    if not isinstance(source_hostname, str) or not source_hostname:
        raise ValueError("SOURCE_HOSTNAME_REQUIRED")
    kept: list[dict[str, Any]] = []
    excluded: list[ExcludedCandidate] = []
    for index, candidate in enumerate(candidates):
        if not isinstance(candidate, Mapping):
            raise TypeError("CANDIDATE_MAPPING_REQUIRED")
        reason = _exclusion_reason(candidate.get("url"), source_hostname)
        copied = deepcopy(dict(candidate))
        if reason is None:
            kept.append(copied)
        else:
            excluded.append({"index": index, "reason": reason, "candidate": copied})
    return {"version": FILTER_VERSION, "candidates": kept, "excluded": excluded}
