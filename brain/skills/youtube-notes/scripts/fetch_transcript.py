#!/usr/bin/env python3
"""
Fetch transcript from a YouTube video URL.
Outputs clean text to stdout.

Usage:
    python fetch_transcript.py <youtube_url>
    python fetch_transcript.py <youtube_url> --json   # include metadata

Dependencies:
    pip install youtube-transcript-api yt-dlp requests

IP blocking workaround:
    YouTube blocks most cloud/dev IPs. This script first exports Chrome browser
    cookies via yt-dlp, then passes them to youtube-transcript-api to authenticate
    as a real browser session.
"""
import sys
import re
import json
import os
import argparse
import tempfile


def extract_video_id(url: str) -> str:
    patterns = [
        r"(?:v=|youtu\.be/|embed/|shorts/)([A-Za-z0-9_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    raise ValueError(f"Cannot extract video ID from URL: {url}")


def export_browser_cookies(output_path: str, video_url: str, browser: str = "chrome") -> bool:
    """
    Export browser cookies to Netscape format using yt-dlp.
    Returns True if cookies file was created successfully.
    The export succeeds even if the target URL itself fails to download —
    yt-dlp extracts cookies before attempting any download.

    Use the actual video URL so yt-dlp targets the right domain.
    Timeout is intentionally generous (90s) because cookie extraction from
    Chrome can take 20-40s on first run.
    """
    import subprocess
    subprocess.run(
        [
            "yt-dlp",
            "--cookies-from-browser", browser,
            "--cookies", output_path,
            "--skip-download",
            video_url,
        ],
        capture_output=True, text=True, timeout=90
    )
    return os.path.exists(output_path) and os.path.getsize(output_path) > 100


def build_session_with_cookies(cookie_file: str):
    """Build a requests.Session with cookies loaded from a Netscape cookies file."""
    import requests
    import http.cookiejar

    session = requests.Session()
    cj = http.cookiejar.MozillaCookieJar(cookie_file)
    cj.load(ignore_discard=True, ignore_expires=True)
    session.cookies = cj  # type: ignore[assignment]
    return session


def fetch_with_youtube_transcript_api(video_id: str, session=None) -> tuple[str, str]:
    """
    Returns (transcript_text, language_used).
    Pass a requests.Session with cookies to bypass IP blocking.
    """
    from youtube_transcript_api import YouTubeTranscriptApi

    if session is not None:
        api = YouTubeTranscriptApi(http_client=session)
    else:
        api = YouTubeTranscriptApi()

    transcript_list = api.list(video_id)

    transcript = None
    lang_used = "unknown"

    try:
        transcript = transcript_list.find_manually_created_transcript(["en", "en-US", "en-GB"])
        lang_used = "en (manual)"
    except Exception:
        pass

    if transcript is None:
        try:
            transcript = transcript_list.find_generated_transcript(["en", "en-US"])
            lang_used = "en (auto)"
        except Exception:
            pass

    if transcript is None:
        available = list(transcript_list)
        if available:
            transcript = available[0]
            lang_used = transcript.language_code
            try:
                transcript = transcript.translate("en")
                lang_used = f"{lang_used}→en"
            except Exception:
                pass

    if transcript is None:
        raise RuntimeError("No transcripts available")

    segments = transcript.fetch()
    text = " ".join(seg.text for seg in segments)
    text = re.sub(r"\[.*?\]", "", text)  # remove [Music], [Applause] etc
    text = re.sub(r"\s+", " ", text).strip()
    return text, lang_used


def fetch_metadata_via_oembed(url: str) -> dict:
    """
    Fetch basic metadata (title, channel) via YouTube oEmbed API.
    No authentication required. Returns partial metadata.
    """
    import urllib.request
    import urllib.parse

    oembed_url = f"https://www.youtube.com/oembed?url={urllib.parse.quote(url)}&format=json"
    try:
        with urllib.request.urlopen(oembed_url, timeout=10) as resp:
            data = json.loads(resp.read())
            return {
                "title": data.get("title", ""),
                "channel": data.get("author_name", ""),
                "duration_seconds": 0,
                "description": "",
                "upload_date": "",
                "url": url,
            }
    except Exception:
        return {}


def fetch_metadata_with_ytdlp(url: str, cookie_file: str | None = None) -> dict:
    """
    Fetch full metadata via yt-dlp --dump-json.
    Note: may fail if yt-dlp JS challenge solver is broken (n challenge).
    Falls back to oEmbed if this fails.
    """
    import subprocess

    cmd = ["yt-dlp", "--dump-json", "--no-playlist"]
    if cookie_file:
        cmd.extend(["--cookies", cookie_file])
    cmd.append(url)

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode == 0 and result.stdout.strip():
        try:
            data = json.loads(result.stdout)
            return {
                "title": data.get("title", ""),
                "channel": data.get("uploader", data.get("channel", "")),
                "duration_seconds": data.get("duration", 0),
                "description": (data.get("description") or "")[:500],
                "upload_date": data.get("upload_date", ""),
                "url": url,
            }
        except json.JSONDecodeError:
            pass
    return {}


def fetch_transcript_with_ytdlp(url: str, cookie_file: str | None = None) -> str:
    """
    Fallback: use yt-dlp to download auto-subtitles as VTT.
    May fail due to JS challenge (n parameter) even with cookies.
    """
    import subprocess

    with tempfile.TemporaryDirectory() as tmpdir:
        cmd = ["yt-dlp"]
        if cookie_file:
            cmd.extend(["--cookies", cookie_file])
        cmd.extend([
            "--write-auto-subs", "--skip-download",
            "--sub-format", "vtt",
            "--sub-langs", "en,en-US,en-orig",
            "-o", os.path.join(tmpdir, "%(id)s"),
            url,
        ])

        subprocess.run(cmd, capture_output=True, text=True, timeout=60)

        for fname in os.listdir(tmpdir):
            if fname.endswith(".vtt"):
                with open(os.path.join(tmpdir, fname)) as f:
                    content = f.read()
                lines = []
                seen = set()
                for line in content.splitlines():
                    line = line.strip()
                    if not line:
                        continue
                    if "-->" in line:
                        continue
                    if line.startswith("WEBVTT") or line.startswith("Kind:") or line.startswith("Language:"):
                        continue
                    if re.match(r"^\d+$", line):
                        continue
                    line = re.sub(r"<[^>]+>", "", line).strip()
                    if line and line not in seen:
                        seen.add(line)
                        lines.append(line)
                return " ".join(lines)

    raise RuntimeError("yt-dlp could not fetch subtitles for this video")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("url", help="YouTube URL")
    parser.add_argument("--json", action="store_true", help="Output JSON with metadata")
    parser.add_argument("--no-cookies", action="store_true", help="Skip browser cookie export")
    args = parser.parse_args()

    video_id = extract_video_id(args.url)

    # --- Step 1: Export browser cookies (primary IP-ban workaround) ---
    cookie_file = None
    session = None

    if not args.no_cookies:
        tmp_cookie_path = os.path.join(tempfile.gettempdir(), f"yt_cookies_{os.getpid()}.txt")
        try:
            if export_browser_cookies(tmp_cookie_path, video_url=args.url):
                cookie_file = tmp_cookie_path
                session = build_session_with_cookies(cookie_file)
                sys.stderr.write("Using Chrome browser cookies for authentication.\n")
            else:
                sys.stderr.write("Warning: Could not export browser cookies, proceeding without.\n")
        except Exception as e:
            sys.stderr.write(f"Warning: Cookie export failed ({e}), proceeding without.\n")

    # --- Step 2: Fetch metadata ---
    metadata = {}

    # Try yt-dlp with cookies first (full metadata)
    if cookie_file:
        try:
            metadata = fetch_metadata_with_ytdlp(args.url, cookie_file=cookie_file)
        except Exception:
            pass

    # Fallback to oEmbed (title + channel, always works)
    if not metadata.get("title"):
        try:
            oembed = fetch_metadata_via_oembed(args.url)
            if oembed:
                metadata = {**oembed, **metadata}  # oembed as base, keep any yt-dlp fields
        except Exception as e:
            sys.stderr.write(f"Warning: oEmbed metadata fetch failed: {e}\n")

    if not metadata:
        metadata = {"url": args.url, "title": "", "channel": "", "upload_date": ""}

    # --- Step 3: Fetch transcript ---
    transcript = ""
    method_used = ""

    # Primary: youtube-transcript-api with cookies (most reliable)
    try:
        transcript, lang = fetch_with_youtube_transcript_api(video_id, session=session)
        method_used = f"youtube-transcript-api ({lang})"
    except Exception as e:
        sys.stderr.write(f"youtube-transcript-api failed: {e}\n")

    # Fallback: yt-dlp subtitles with cookies
    if not transcript:
        try:
            transcript = fetch_transcript_with_ytdlp(args.url, cookie_file=cookie_file)
            method_used = "yt-dlp subtitles"
        except Exception as e:
            sys.stderr.write(f"yt-dlp subtitles failed: {e}\n")

    # Last resort: youtube-transcript-api without cookies (works on home IPs)
    if not transcript and session is not None:
        try:
            transcript, lang = fetch_with_youtube_transcript_api(video_id, session=None)
            method_used = f"youtube-transcript-api no-auth ({lang})"
        except Exception as e:
            sys.stderr.write(f"youtube-transcript-api (no auth) failed: {e}\n")

    if not transcript:
        print("ERROR: Could not fetch transcript. All methods exhausted.", file=sys.stderr)
        print("Tip: Make sure Chrome is open and logged into YouTube.", file=sys.stderr)
        sys.exit(1)

    # Cleanup temp cookie file
    if cookie_file and os.path.exists(cookie_file):
        try:
            os.unlink(cookie_file)
        except Exception:
            pass

    # --- Step 4: Output ---
    if args.json:
        output = {**metadata, "transcript": transcript, "method": method_used}
        print(json.dumps(output, ensure_ascii=False, indent=2))
    else:
        if metadata.get("title"):
            print(f"TITLE: {metadata['title']}")
        if metadata.get("channel"):
            print(f"CHANNEL: {metadata['channel']}")
        if metadata.get("upload_date"):
            d = metadata["upload_date"]
            print(f"DATE: {d[:4]}-{d[4:6]}-{d[6:]}" if len(d) == 8 else f"DATE: {d}")
        print(f"URL: {args.url}")
        print(f"---TRANSCRIPT---")
        print(transcript)


if __name__ == "__main__":
    main()
