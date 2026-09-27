"""ICD-10 exact dictionary loader for death-cause audit.

Runtime looks up codes from a JSON file (not RAG / not embedded in workflow).

Search order for the dictionary file:
1. EAGENT_ICD_DICT_PATH — absolute path to icd10_dictionary.v1.json
2. EAGENT_ICD_DATA_DIR — directory containing the JSON files
3. /mnt/nodestor/eagent/data/death_audit/icd/  (Huzhou node3)
4. /app/data/death_audit/icd/                  (aliyun docker volume)
5. Package-bundled data next to this module    (local / default)
"""

from __future__ import annotations

import json
import logging
import os
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

DICTIONARY_FILENAME = "icd10_dictionary.v1.json"
QUARANTINE_FILENAME = "icd10_dictionary_quarantine.v1.json"

# U04.9 is registered by SWBG70019 but absent from the legacy ICD table.
SUPPLEMENTAL_CODES: Dict[str, List[str]] = {
    "U04.9": ["未特指的严重急性呼吸道综合征", "", "其他"],
}

_lock = threading.RLock()
_cache: Optional[Dict[str, Any]] = None


def _candidate_dirs() -> List[Path]:
    dirs: List[Path] = []
    env_file = os.getenv("EAGENT_ICD_DICT_PATH", "").strip()
    if env_file:
        dirs.append(Path(env_file).expanduser().resolve().parent)
    env_dir = os.getenv("EAGENT_ICD_DATA_DIR", "").strip()
    if env_dir:
        dirs.append(Path(env_dir).expanduser().resolve())
    dirs.extend(
        [
            Path("/mnt/nodestor/eagent/data/death_audit/icd"),
            Path("/app/data/death_audit/icd"),
            Path(__file__).resolve().parent / "data",
        ]
    )
    # de-dupe while preserving order
    seen = set()
    unique: List[Path] = []
    for item in dirs:
        key = str(item)
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique


def resolve_dictionary_paths() -> Tuple[Path, Optional[Path]]:
    env_file = os.getenv("EAGENT_ICD_DICT_PATH", "").strip()
    if env_file:
        dict_path = Path(env_file).expanduser().resolve()
        quarantine = dict_path.with_name(QUARANTINE_FILENAME)
        return dict_path, quarantine if quarantine.exists() else None

    for directory in _candidate_dirs():
        dict_path = directory / DICTIONARY_FILENAME
        if dict_path.is_file():
            quarantine = directory / QUARANTINE_FILENAME
            return dict_path, quarantine if quarantine.is_file() else None

    searched = ", ".join(str(path) for path in _candidate_dirs())
    raise FileNotFoundError(
        f"ICD dictionary not found ({DICTIONARY_FILENAME}). Searched: {searched}"
    )


def _normalize_ccd(value: Any) -> str:
    text = "" if value is None else str(value).strip()
    if not text:
        return ""
    try:
        number = float(text)
        return str(int(number)) if number.is_integer() else str(number)
    except Exception:
        return text


def _records_to_lookup(records: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    lookup: Dict[str, List[str]] = {}
    for item in records:
        code = str(item.get("code", "")).strip().upper()
        if not code:
            continue
        lookup[code] = [
            str(item.get("name", "") or ""),
            _normalize_ccd(item.get("ccd", "")),
            str(item.get("cause_group", "") or ""),
        ]
    return lookup


def _load_from_disk() -> Dict[str, Any]:
    dict_path, quarantine_path = resolve_dictionary_paths()
    payload = json.loads(dict_path.read_text(encoding="utf-8"))
    records = payload.get("records") or []
    if not isinstance(records, list) or not records:
        raise ValueError(f"ICD dictionary has no records: {dict_path}")

    dictionary = _records_to_lookup(records)
    dictionary.update(SUPPLEMENTAL_CODES)

    quarantine: List[Dict[str, Any]] = []
    if quarantine_path and quarantine_path.is_file():
        q_payload = json.loads(quarantine_path.read_text(encoding="utf-8"))
        q_records = q_payload.get("records") or []
        if isinstance(q_records, list):
            quarantine = q_records

    assets = {
        "version": str(payload.get("version") or "zhejiang_icd10.v1"),
        "source": str(payload.get("source") or DICTIONARY_FILENAME),
        "dictionary": dictionary,
        "quarantine": quarantine,
        "dictionary_path": str(dict_path),
        "quarantine_path": str(quarantine_path) if quarantine_path else "",
        "entry_count": len(dictionary),
        "base_entry_count": len(dictionary) - len(SUPPLEMENTAL_CODES),
        "supplemental_entry_count": len(SUPPLEMENTAL_CODES),
        "quarantine_count": len(quarantine),
    }
    logger.info(
        "ICD dictionary loaded: version={} entries={} path={}",
        assets["version"],
        assets["entry_count"],
        assets["dictionary_path"],
    )
    return assets


def reload_icd_dictionary() -> Dict[str, Any]:
    global _cache
    with _lock:
        _cache = _load_from_disk()
        return dict(_cache)


def _ensure_cache() -> Dict[str, Any]:
    global _cache
    with _lock:
        if _cache is None:
            _cache = _load_from_disk()
        return _cache


def load_icd_runtime_assets() -> Dict[str, Any]:
    """Return assets for workflow Code node 03A (dictionary + metadata)."""
    cache = _ensure_cache()
    return {
        "version": cache["version"],
        "source": cache["source"],
        "dictionary": dict(cache["dictionary"]),
        "quarantine": list(cache["quarantine"]),
        "dictionary_path": cache["dictionary_path"],
        "entry_count": cache["entry_count"],
        "supplemental_entry_count": cache["supplemental_entry_count"],
        "quarantine_count": cache["quarantine_count"],
    }


def lookup_codes(codes: List[str]) -> Dict[str, Any]:
    cache = _ensure_cache()
    dictionary: Dict[str, List[str]] = cache["dictionary"]
    items = []
    for raw in codes:
        code = str(raw or "").strip().upper()
        hit = dictionary.get(code)
        items.append(
            {
                "code": code,
                "exists": hit is not None,
                "official_name": hit[0] if hit else "",
                "ccd": hit[1] if hit else "",
                "cause_group": hit[2] if hit else "",
            }
        )
    return {
        "version": cache["version"],
        "source": cache["source"],
        "dictionary_path": cache["dictionary_path"],
        "items": items,
    }


def get_icd_status() -> Dict[str, Any]:
    cache = _ensure_cache()
    return {
        "version": cache["version"],
        "source": cache["source"],
        "dictionary_path": cache["dictionary_path"],
        "quarantine_path": cache["quarantine_path"],
        "entry_count": cache["entry_count"],
        "base_entry_count": cache["base_entry_count"],
        "supplemental_entry_count": cache["supplemental_entry_count"],
        "quarantine_count": cache["quarantine_count"],
        "loaded": True,
    }
