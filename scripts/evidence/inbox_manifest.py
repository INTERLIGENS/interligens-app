#!/usr/bin/env python3
"""RC-SPINE-02 · inventaire déterministe d'un dossier de pièces brutes. LECTURE SEULE sur le dossier cible.

Ne déplace, ne renomme, ne modifie rien. N'écrit que dans --out-dir (jamais dans --root).
Le manifeste produit sur un corpus réel est NOMINATIF : il reste HORS DÉPÔT (ruling 14/09).
Seuls ce script et le fixture sanitisé sous __fixtures__/inbox-manifest/ sont versionnés.

Tri déclaré : chemin relatif comparé comme octets UTF-8, tel que renvoyé par le système de fichiers
(NFD sur APFS/HFS+), croissant. Répertoires et liens symboliques exclus. Aucun horodatage d'exécution
dans les sorties : deux exécutions sur un dossier inchangé produisent des fichiers identiques.

Usage :
  python3 scripts/evidence/inbox_manifest.py --root DIR --out-dir DIR --stem NAME [--find-token T ...]
  python3 scripts/evidence/inbox_manifest.py --from-entries FILE.json --out-dir DIR --stem NAME
  python3 scripts/evidence/inbox_manifest.py --selftest

Les sondes dépendantes de la plateforme (mdls, xattr, pdfinfo, pdftotext, PIL) sont facultatives :
absentes, le champ correspondant vaut None et la sortie le dit.
"""
import argparse
import datetime as _dt
import hashlib
import json
import mimetypes
import os
import plistlib
import re
import shutil
import subprocess
import sys
import unicodedata
from collections import OrderedDict

DATA_NATURES = ("PRIMARY_OBSERVATION", "THIRD_PARTY_DATA", "INFERENCE", "ESTIMATE", "EDITORIAL_ASSERTION", "UNCLASSIFIED")
RE_HANDLE = re.compile(r"(?<![\w.])@([A-Za-z0-9_]{2,15})\b")
RE_URL = re.compile(r"https?://[^\s\"'<>)\]]+")
RE_B58 = re.compile(r"\b[1-9A-HJ-NP-Za-km-z]{32,44}\b")
RE_ETH = re.compile(r"\b0x[0-9a-fA-F]{40}\b")
RE_CAPTURE_NAME = re.compile(r"(\d{4}-\d{2}-\d{2}) (?:à|at) (\d{2})\.(\d{2})\.(\d{2})")
SIGNATURE = ("image/png", "application/pdf", "application/x-apple-ds-store")


def have(tool):
    return shutil.which(tool) is not None


def run(cmd):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, errors="replace").stdout
    except OSError:
        return ""


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def mime_by_signature(path):
    with open(path, "rb") as f:
        head = f.read(16)
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head.startswith(b"%PDF-"):
        return "application/pdf"
    if head.startswith(b"\x00\x00\x00\x01Bud1"):
        return "application/x-apple-ds-store"
    return None


def mdls(path, name):
    if not have("mdls"):
        return None
    v = run(["mdls", "-raw", "-name", name, path]).strip()
    return None if v in ("(null)", "") else v


def xattr_names(path):
    if not have("xattr"):
        return None
    return sorted(l.strip() for l in run(["xattr", path]).splitlines() if l.strip())


def where_froms(path, names):
    if not names or "com.apple.metadata:kMDItemWhereFroms" not in names:
        return None
    hexs = run(["xattr", "-px", "com.apple.metadata:kMDItemWhereFroms", path])
    try:
        v = plistlib.loads(bytes.fromhex("".join(hexs.split())))
        return v if isinstance(v, list) else [str(v)]
    except Exception as exc:  # noqa: BLE001
        return [f"xattr présent, décodage plist impossible: {exc}"]


def png_meta(path):
    try:
        from PIL import Image
    except ImportError:
        return {"probe": "PIL absent"}
    try:
        with Image.open(path) as im:
            info = OrderedDict(sorted((k, v if isinstance(v, (int, float, str)) else repr(v)[:120]) for k, v in im.info.items()))
            return {"width": im.width, "height": im.height, "mode": im.mode, "info_chunk_keys": list(info.keys()), "info_chunks": info, "exif_tag_count": len(im.getexif())}
    except Exception as exc:  # noqa: BLE001
        return {"probe": f"PIL erreur: {exc}"}


def pdf_meta(path):
    if not have("pdfinfo"):
        return {"probe": "pdfinfo absent"}
    out = OrderedDict()
    for line in run(["pdfinfo", path]).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            if k in ("Title", "Subject", "Keywords", "Author", "Creator", "Producer", "CreationDate", "ModDate", "Pages", "Page size", "Encrypted", "PDF version"):
                out[k] = v.strip()
    return out


def text_of(path, mime):
    if mime == "application/pdf":
        return run(["pdftotext", "-layout", path, "-"]) if have("pdftotext") else ""
    if mime and mime.startswith("text/"):
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    return ""


def counts(rx, text):
    c = {}
    for m in rx.findall(text):
        c[m] = c.get(m, 0) + 1
    return OrderedDict(sorted(c.items(), key=lambda kv: (-kv[1], kv[0])))


def subjects(text):
    return OrderedDict([("handles", counts(RE_HANDLE, text)), ("urls", counts(RE_URL, text)),
                        ("base58_32_44", counts(RE_B58, text)), ("hex_0x40", counts(RE_ETH, text))])


def nature_proposal(e):
    """Critère déclaré : MODE DE PRODUCTION lu dans les métadonnées, jamais le contenu."""
    if e["mime_by_content"] == "application/x-apple-ds-store":
        return "UNCLASSIFIED", "fichier système Finder, pas une pièce"
    if (e.get("mdls") or {}).get("kMDItemIsScreenCapture") == "1":
        return "PRIMARY_OBSERVATION", "xattr kMDItemIsScreenCapture=1 : capture d'écran réalisée par l'opérateur"
    pdf = e.get("pdf") or {}
    if pdf.get("Creator") == "Chrome Helper" and "Quartz PDFContext" in pdf.get("Producer", ""):
        return "PRIMARY_OBSERVATION", "PDF imprimé depuis Chrome par l'opérateur (Creator=Chrome Helper, Producer=Quartz PDFContext)"
    if pdf.get("Creator") == "Google Sheets":
        return "THIRD_PARTY_DATA", "PDF exporté par Google Sheets : document composé par un tiers, auteur non porté par le fichier"
    if e["mime_by_content"] == "text/csv" and e.get("where_froms"):
        return "THIRD_PARTY_DATA", "CSV téléchargé (kMDItemWhereFroms) : données compilées par un tiers, auteur non porté par le fichier"
    return "UNCLASSIFIED", "aucun critère de production applicable : provenance inconnue"


def utc(ts):
    return _dt.datetime.utcfromtimestamp(ts).strftime("%Y-%m-%dT%H:%M:%SZ")


def probe_dir(root, find_tokens):
    entries = []
    for n in sorted(os.listdir(root), key=lambda s: s.encode("utf-8")):
        p = os.path.join(root, n)
        if not os.path.isfile(p) or os.path.islink(p):
            continue
        st = os.stat(p)
        e = OrderedDict()
        e["path"] = n
        e["path_nfc"] = unicodedata.normalize("NFC", n)
        e["path_is_nfd_on_disk"] = n != e["path_nfc"]
        e["bytes"] = st.st_size
        e["sha256"] = sha256_of(p)
        e["mime_by_extension"] = mimetypes.guess_type(n)[0] or "ABSENT"
        e["mime_by_content_file_cmd"] = run(["file", "--mime-type", "-b", p]).strip() if have("file") else None
        sig = mime_by_signature(p)
        e["mime_by_content"] = sig or e["mime_by_content_file_cmd"] or "ABSENT"
        e["mime_extension_vs_content_agree"] = e["mime_by_extension"] == e["mime_by_content"]
        e["fs_mtime_utc"] = utc(st.st_mtime)
        e["fs_birthtime_utc"] = utc(getattr(st, "st_birthtime", st.st_mtime))
        names = xattr_names(p)
        e["xattr_names"] = names
        e["where_froms"] = where_froms(p, names)
        e["mdls"] = OrderedDict((k, mdls(p, k)) for k in ("kMDItemContentCreationDate", "kMDItemIsScreenCapture", "kMDItemScreenCaptureType", "kMDItemAuthors"))
        m = RE_CAPTURE_NAME.search(e["path_nfc"])  # NFC : sur APFS le nom est NFD et "à"/"é" sont décomposés
        e["filename_declared_datetime_unzoned"] = f"{m.group(1)}T{m.group(2)}:{m.group(3)}:{m.group(4)}" if m else None
        if e["mime_by_content"] == "image/png":
            e["png"] = png_meta(p)
        if e["mime_by_content"] == "application/pdf":
            e["pdf"] = pdf_meta(p)
        text = text_of(p, e["mime_by_content"])
        e["text_extractable"] = bool(text.strip())
        e["text_chars"] = len(text)
        e["subjects_in_filename"] = subjects(n)
        e["subjects_in_text"] = subjects(text) if text else None
        hay = (n + "\n" + text).lower()
        e["token_hits"] = OrderedDict((t, hay.count(t.lower())) for t in find_tokens if hay.count(t.lower()))
        pdf = e.get("pdf") or {}
        e["source_url"] = e["where_froms"] if e["where_froms"] else "ABSENT"
        e["author"] = pdf.get("Author") or "ABSENT"
        ka = e["mdls"].get("kMDItemAuthors")
        e["creator_application_not_author"] = pdf.get("Creator") or (", ".join(re.findall(r'"([^"]*)"', ka)) if ka else None)
        e["declared_date"] = e["filename_declared_datetime_unzoned"] or pdf.get("CreationDate") or "ABSENT"
        e["date_source"] = "nom de fichier (sans fuseau)" if e["filename_declared_datetime_unzoned"] else ("PDF CreationDate" if pdf.get("CreationDate") else "ABSENT")
        nat, crit = nature_proposal(e)
        e["data_nature_PROPOSED"] = nat
        e["data_nature_criterion"] = crit
        e["temporal_mode_PROPOSED"] = "RETROACTIVE"
        e["temporal_mode_reason"] = "matériel préexistant à tout pipeline d'ingestion gouverné ; jamais CONTEMPORANEOUS (ruling 14/09)"
        entries.append(e)
    return entries


def aggregate(entries, root, find_tokens):
    groups = OrderedDict()
    for e in entries:
        groups.setdefault(e["sha256"], []).append(e["path"])
    dups = OrderedDict((k, v) for k, v in sorted(groups.items()) if len(v) > 1)
    agg = OrderedDict()
    agg["root"] = root
    agg["sort_order"] = "chemin relatif, octets UTF-8 (forme renvoyée par le système de fichiers), croissant ; symlinks et répertoires exclus"
    agg["file_count"] = len(entries)
    agg["total_bytes"] = sum(e["bytes"] for e in entries)
    agg["by_mime_by_content"] = OrderedDict(sorted({m: sum(1 for e in entries if e["mime_by_content"] == m) for m in {e["mime_by_content"] for e in entries}}.items()))
    agg["extension_vs_content_disagreements"] = [e["path"] for e in entries if not e["mime_extension_vs_content_agree"]]
    agg["sha256_distinct"] = len(groups)
    agg["duplicate_groups_by_sha256"] = dups
    agg["source_url_present"] = [e["path"] for e in entries if e["source_url"] != "ABSENT"]
    agg["source_url_absent_count"] = sum(1 for e in entries if e["source_url"] == "ABSENT")
    agg["author_present"] = [e["path"] for e in entries if e["author"] != "ABSENT"]
    agg["data_nature_PROPOSED_counts"] = OrderedDict((n, sum(1 for e in entries if e["data_nature_PROPOSED"] == n)) for n in DATA_NATURES if any(e["data_nature_PROPOSED"] == n for e in entries))
    agg["temporal_mode_PROPOSED_counts"] = OrderedDict([("RETROACTIVE", sum(1 for e in entries if e["temporal_mode_PROPOSED"] == "RETROACTIVE")), ("CONTEMPORANEOUS", sum(1 for e in entries if e["temporal_mode_PROPOSED"] == "CONTEMPORANEOUS"))])
    hits = [(e["path"], e["token_hits"]) for e in entries if e.get("token_hits")]
    agg["ISOLATED_token_search"] = OrderedDict([
        ("tokens", list(find_tokens)),
        ("scope", "noms de fichiers + texte extractible (PDF via pdftotext, fichiers text/*) ; les images ne sont pas lues pour leur contenu"),
        ("hits", hits),
        ("tokens_not_found", [t for t in find_tokens if not any(t in h for _, h in hits)]),
        ("note", "un relevé de jeton n'est pas une pièce : à isoler du corpus et à vérifier humainement"),
    ])
    return agg


def render_md(agg, entries):
    L = [f"# Manifeste déterministe — `{agg['root']}`", "",
         "Lecture seule. Aucun fichier déplacé, renommé, modifié. Manifeste nominatif : HORS DÉPÔT.", "",
         f"- Tri déclaré : {agg['sort_order']}",
         f"- Fichiers : {agg['file_count']} · octets : {agg['total_bytes']} · sha256 distincts : {agg['sha256_distinct']}",
         f"- MIME par contenu : {dict(agg['by_mime_by_content'])}",
         f"- Désaccords extension/contenu : {agg['extension_vs_content_disagreements'] or 'aucun'}",
         f"- Groupes de doublons par sha256 : {len(agg['duplicate_groups_by_sha256'])}"]
    for k, v in agg["duplicate_groups_by_sha256"].items():
        L.append(f"  - `{k}` ← {v}")
    L += [f"- source_url présente : {agg['source_url_present'] or 'aucune'} · absente : {agg['source_url_absent_count']}",
          f"- auteur présent (métadonnée PDF Author) : {agg['author_present'] or 'aucun'}",
          f"- Data Nature PROPOSÉE : {dict(agg['data_nature_PROPOSED_counts'])}",
          f"- Mode temporel PROPOSÉ : {dict(agg['temporal_mode_PROPOSED_counts'])}", "",
          "## ISOLÉ À PART — recherche de jetons", ""]
    ts = agg["ISOLATED_token_search"]
    L.append(f"- jetons : {ts['tokens'] or 'aucun'} · non trouvés : {ts['tokens_not_found'] or 'aucun'}")
    for pth, h in ts["hits"]:
        L.append(f"- `{pth}` : {dict(h)}")
    L += [f"- {ts['note']}", f"- portée : {ts['scope']}", "",
          "## Méthode", "",
          "- MIME : `mimetypes` sur l'extension ; signature des premiers octets (PNG, PDF, DS_Store) sinon `file --mime-type`.",
          "- Data Nature : mode de PRODUCTION lu dans les métadonnées (kMDItemIsScreenCapture, PDF Creator/Producer, kMDItemWhereFroms). Proposition, pas qualification.",
          "- Mode temporel : RETROACTIVE pour tout matériel préexistant.",
          "- Sujets : expressions régulières (handles, URL, base58 32–44, 0x+40 hex) sur le nom et le texte extractible. Un relevé n'est pas une assertion.", "",
          "## Pièces", ""]
    for i, e in enumerate(entries, 1):
        L += [f"### {i}. `{e['path_nfc']}`", "",
              f"- octets : {e['bytes']} · sha256 : `{e['sha256']}`",
              f"- MIME extension : {e['mime_by_extension']} · contenu : {e['mime_by_content']} · accord : {e['mime_extension_vs_content_agree']}",
              f"- source_url : {e['source_url']}",
              f"- date déclarée : {e['declared_date']} ({e['date_source']}) · mdls ContentCreation : {(e.get('mdls') or {}).get('kMDItemContentCreationDate') or 'ABSENT'} · fs birthtime UTC : {e['fs_birthtime_utc']}",
              f"- auteur : {e['author']} · application créatrice (pas un auteur) : {e.get('creator_application_not_author') or 'ABSENT'}",
              f"- xattr : {', '.join(e['xattr_names']) if e.get('xattr_names') else 'aucun / sonde absente'}"]
        if e.get("png"):
            L.append(f"- PNG : {e['png']}")
        if e.get("pdf"):
            L.append(f"- PDF : {dict(e['pdf'])}")
        L.append(f"- texte extractible : {e['text_extractable']} ({e['text_chars']} caractères)")
        sf = e["subjects_in_filename"]
        L.append(f"- sujets dans le nom : handles {dict(sf['handles']) or 'aucun'} · base58 {list(sf['base58_32_44']) or 'aucun'}")
        if e.get("subjects_in_text"):
            s = e["subjects_in_text"]
            L.append(f"- sujets dans le texte : handles distincts {len(s['handles'])} · URL {len(s['urls'])} · base58 {len(s['base58_32_44'])} · 0x {len(s['hex_0x40'])}")
        L += [f"- jetons : {dict(e.get('token_hits') or {}) or 'ABSENT'}",
              f"- Data Nature PROPOSÉE : **{e['data_nature_PROPOSED']}** — {e['data_nature_criterion']}",
              f"- Mode temporel PROPOSÉ : **{e['temporal_mode_PROPOSED']}**", ""]
    return "\n".join(L) + "\n"


def dump(doc):
    return json.dumps(doc, ensure_ascii=False, indent=1, sort_keys=True) + "\n"


def write_outputs(agg, entries, out_dir, stem):
    os.makedirs(out_dir, exist_ok=True)
    doc = OrderedDict([("aggregates", agg), ("entries", entries)])
    with open(os.path.join(out_dir, stem + ".json"), "w", encoding="utf-8") as f:
        f.write(dump(doc))
    with open(os.path.join(out_dir, stem + ".md"), "w", encoding="utf-8") as f:
        f.write(render_md(agg, entries))


def selftest():
    here = os.path.dirname(os.path.abspath(__file__))
    fx_dir = os.path.join(here, "__fixtures__", "inbox-manifest")
    fx_entries = os.path.join(here, "__fixtures__", "inbox-manifest.entries.json")
    tokens = ["fixture_hdl", "jeton_introuvable"]
    # 1. sonde sur le fixture disque
    e1 = probe_dir(fx_dir, tokens)
    a1 = aggregate(e1, fx_dir, tokens)
    assert a1["file_count"] == 6, a1["file_count"]
    assert len(a1["duplicate_groups_by_sha256"]) == 1 and sorted(next(iter(a1["duplicate_groups_by_sha256"].values()))) == ["capture_A.png", "capture_A_copy.png"], "doublon sha256 non détecté"
    # trois désaccords, chacun d'une nature différente : détecteurs en désaccord (README.md : text/markdown vs
    # text/plain), extension mensongère (mislabeled.png), extension inconnue (unknown.zzz : ABSENT vs octet-stream)
    assert a1["extension_vs_content_disagreements"] == ["README.md", "mislabeled.png", "unknown.zzz"], a1["extension_vs_content_disagreements"]
    assert a1["author_present"] == [], "auteur absent attendu partout"
    byp = {e["path"]: e for e in e1}
    assert byp["unknown.zzz"]["mime_by_extension"] == "ABSENT" and byp["unknown.zzz"]["data_nature_PROPOSED"] == "UNCLASSIFIED", "provenance inconnue → UNCLASSIFIED"
    assert byp["table.csv"]["subjects_in_text"]["base58_32_44"] and byp["table.csv"]["subjects_in_text"]["handles"] and byp["table.csv"]["subjects_in_text"]["hex_0x40"], "relevés de sujets"
    assert byp["table.csv"]["source_url"] == "ABSENT", "aucune xattr sur un fichier versionné"
    assert a1["temporal_mode_PROPOSED_counts"] == OrderedDict([("RETROACTIVE", 6), ("CONTEMPORANEOUS", 0)])
    assert set(e["data_nature_PROPOSED"] for e in e1) <= set(DATA_NATURES)
    assert a1["ISOLATED_token_search"]["tokens_not_found"] == ["jeton_introuvable"] and a1["ISOLATED_token_search"]["hits"][0][0] == "table.csv"
    assert byp["capture_A.png"]["filename_declared_datetime_unzoned"] is None
    assert [e["path"] for e in e1] == sorted((e["path"] for e in e1), key=lambda s: s.encode("utf-8")), "tri"
    assert dump(aggregate(e1, fx_dir, tokens)) == dump(a1), "déterminisme de l'agrégation"
    # 2. fixture d'entrées (couvre ce que le disque ne peut pas porter : xattr WhereFroms, PDF)
    with open(fx_entries, encoding="utf-8") as f:
        e2 = json.load(f)["entries"]
    a2 = aggregate(e2, "fixture://entries", ["jeton_absent"])
    assert a2["source_url_present"] == ["fx_with_source.csv"] and a2["source_url_absent_count"] == len(e2) - 1, "source URL présente / absente"
    assert a2["author_present"] == [], "auteur absent"
    assert len(a2["duplicate_groups_by_sha256"]) == 1, "doublon dans le fixture d'entrées"
    assert a2["extension_vs_content_disagreements"] == ["fx_mislabeled.png", "fx_unknown.bin"], a2["extension_vs_content_disagreements"]  # extension mensongère + extension ABSENT
    assert a2["data_nature_PROPOSED_counts"] == OrderedDict([("PRIMARY_OBSERVATION", 2), ("THIRD_PARTY_DATA", 1), ("UNCLASSIFIED", 3)]), dict(a2["data_nature_PROPOSED_counts"])
    assert a2["temporal_mode_PROPOSED_counts"]["CONTEMPORANEOUS"] == 0
    md = render_md(a2, e2)
    assert "fx_with_source.csv" in md and "HORS DÉPÔT" in md
    print("selftest OK — fixture disque:", a1["file_count"], "fichiers ; fixture entrées:", len(e2), "entrées")
    return 0


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root")
    ap.add_argument("--from-entries")
    ap.add_argument("--out-dir")
    ap.add_argument("--stem", default="INBOX_MANIFEST")
    ap.add_argument("--find-token", action="append", default=[])
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args(argv)
    if a.selftest:
        return selftest()
    if not a.out_dir or not (a.root or a.from_entries):
        ap.error("--out-dir et (--root | --from-entries) requis")
    if a.root:
        root = os.path.abspath(a.root)
        out = os.path.abspath(a.out_dir)
        if out == root or out.startswith(root + os.sep):
            ap.error("--out-dir ne doit pas être dans --root (lecture seule sur le dossier cible)")
        entries = probe_dir(root, a.find_token)
    else:
        with open(a.from_entries, encoding="utf-8") as f:
            entries = json.load(f)["entries"]
        root = "entries:" + os.path.basename(a.from_entries)
    agg = aggregate(entries, root, a.find_token)
    write_outputs(agg, entries, a.out_dir, a.stem)
    print(json.dumps({k: agg[k] for k in ("file_count", "total_bytes", "sha256_distinct", "extension_vs_content_disagreements", "data_nature_PROPOSED_counts", "temporal_mode_PROPOSED_counts")}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
