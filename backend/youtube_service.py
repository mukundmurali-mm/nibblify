import re
import httpx
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled

_api = YouTubeTranscriptApi()


def extract_video_id(url: str) -> str:
    pattern = r'(?:v=|/v/|youtu\.be/|/embed/)([a-zA-Z0-9_-]{11})'
    match = re.search(pattern, url)
    if not match:
        raise ValueError(f"Could not extract video ID from URL: {url}")
    return match.group(1)


async def get_video_info(video_id: str) -> dict:
    oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    async with httpx.AsyncClient() as client:
        resp = await client.get(oembed_url, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    return {
        "title": data.get("title", "Unknown Title"),
        "thumbnail": data.get("thumbnail_url", f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"),
    }


def get_transcript(video_id: str) -> list[dict]:
    try:
        # Try English first, then fall back to any available transcript
        try:
            fetched = _api.fetch(video_id, languages=["en", "en-US", "en-GB"])
        except NoTranscriptFound:
            transcript_list = _api.list(video_id)
            fetched = transcript_list.find_transcript(
                [t.language_code for t in transcript_list]
            ).fetch()
        return [{"text": s.text, "start": s.start, "duration": s.duration} for s in fetched]
    except TranscriptsDisabled:
        raise ValueError("Transcripts are disabled for this video.")
    except Exception as e:
        raise ValueError(f"Could not fetch transcript: {e}")


def format_transcript_for_claude(transcript: list[dict]) -> str:
    lines = []
    for entry in transcript:
        start = entry["start"]
        m = int(start // 60)
        s = int(start % 60)
        lines.append(f"[{m:02d}:{s:02d}] {entry['text']}")
    return "\n".join(lines)
