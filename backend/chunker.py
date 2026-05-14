import json
import subprocess
from youtube_service import format_transcript_for_claude

SYSTEM_PROMPT = """You are an expert at breaking educational YouTube video transcripts into logical learning episodes.

Given a timestamped transcript, identify natural topic boundaries and create episodes that:
- Are roughly 10–30 minutes each (but always follow content logic over time targets)
- Cover a complete concept or topic with a clear beginning and end
- Have a concise, descriptive title (like a podcast or course episode title)
- Include a 2–3 sentence summary of what the viewer will learn

Return ONLY a JSON array with no additional text, using this exact structure:
[
  {
    "title": "Episode title",
    "summary": "What the viewer will learn in this episode.",
    "start_time": 0.0,
    "end_time": 600.0
  }
]

Times are in seconds. Episodes must be sequential and together cover the full video duration."""


def chunk_video(transcript: list[dict], total_duration: float) -> list[dict]:
    transcript_text = format_transcript_for_claude(transcript)

    max_chars = 150_000
    if len(transcript_text) > max_chars:
        transcript_text = transcript_text[:max_chars] + "\n[transcript truncated]"

    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"Break this educational video transcript into logical learning episodes.\n\n"
        f"Total duration: {total_duration:.0f} seconds ({total_duration / 60:.1f} minutes)\n\n"
        f"Transcript:\n{transcript_text}"
    )

    result = subprocess.run(
        ["claude", "-p", prompt],
        capture_output=True,
        text=True,
        timeout=300,
    )

    if result.returncode != 0:
        raise RuntimeError(f"Claude CLI error: {result.stderr or result.stdout}")

    response_text = result.stdout.strip()
    start = response_text.find("[")
    end = response_text.rfind("]") + 1
    if start == -1 or end == 0:
        raise ValueError(f"Claude returned unexpected format: {response_text[:300]}")

    chunks = json.loads(response_text[start:end])

    if chunks:
        chunks[-1]["end_time"] = total_duration

    return chunks
