from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime

from database import init_db, get_db, Video, Chunk
from youtube_service import extract_video_id, get_video_info, get_transcript
from chunker import chunk_video

app = FastAPI(title="Nibblify")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    init_db()


class AddVideoRequest(BaseModel):
    url: str


class ChunkUpdate(BaseModel):
    completed: bool


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/videos")
def list_videos(db: Session = Depends(get_db)):
    videos = db.query(Video).order_by(Video.created_at.desc()).all()
    result = []
    for v in videos:
        total = len(v.chunks)
        done = sum(1 for c in v.chunks if c.completed)
        result.append({
            "id": v.id,
            "youtube_id": v.youtube_id,
            "title": v.title,
            "url": v.url,
            "thumbnail": v.thumbnail,
            "total_duration": v.total_duration,
            "total_chunks": total,
            "completed_chunks": done,
            "progress": round(done / total * 100) if total else 0,
            "created_at": v.created_at.isoformat(),
        })
    return result


@app.post("/api/videos", status_code=201)
async def add_video(req: AddVideoRequest, db: Session = Depends(get_db)):
    try:
        video_id = extract_video_id(req.url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if db.query(Video).filter(Video.youtube_id == video_id).first():
        raise HTTPException(status_code=409, detail="This video has already been added.")

    try:
        info = await get_video_info(video_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not fetch video info. Check the URL and try again.")

    try:
        transcript = get_transcript(video_id)
    except Exception:
        raise HTTPException(status_code=400, detail="No transcript available for this video. Try a video with captions enabled.")

    last = transcript[-1]
    total_duration = last["start"] + last.get("duration", 0)

    video = Video(
        youtube_id=video_id,
        title=info["title"],
        url=f"https://www.youtube.com/watch?v={video_id}",
        thumbnail=info["thumbnail"],
        total_duration=total_duration,
    )
    db.add(video)
    db.flush()

    try:
        chunks_data = chunk_video(transcript, total_duration)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to generate episodes: {str(e)}")

    for i, chunk in enumerate(chunks_data):
        db.add(Chunk(
            video_id=video.id,
            title=chunk["title"],
            summary=chunk["summary"],
            start_time=chunk["start_time"],
            end_time=chunk["end_time"],
            order=i,
        ))

    db.commit()
    db.refresh(video)

    return {
        "id": video.id,
        "youtube_id": video.youtube_id,
        "title": video.title,
        "chunks_count": len(chunks_data),
    }


@app.get("/api/videos/{video_id}")
def get_video(video_id: int, db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    total = len(video.chunks)
    done = sum(1 for c in video.chunks if c.completed)

    return {
        "id": video.id,
        "youtube_id": video.youtube_id,
        "title": video.title,
        "url": video.url,
        "thumbnail": video.thumbnail,
        "total_duration": video.total_duration,
        "total_chunks": total,
        "completed_chunks": done,
        "progress": round(done / total * 100) if total else 0,
        "chunks": [
            {
                "id": c.id,
                "title": c.title,
                "summary": c.summary,
                "start_time": c.start_time,
                "end_time": c.end_time,
                "order": c.order,
                "completed": c.completed,
                "completed_at": c.completed_at.isoformat() if c.completed_at else None,
            }
            for c in video.chunks
        ],
    }


@app.patch("/api/videos/{video_id}/chunks/{chunk_id}")
def update_chunk(video_id: int, chunk_id: int, update: ChunkUpdate, db: Session = Depends(get_db)):
    chunk = db.query(Chunk).filter(Chunk.id == chunk_id, Chunk.video_id == video_id).first()
    if not chunk:
        raise HTTPException(status_code=404, detail="Chunk not found")

    chunk.completed = update.completed
    chunk.completed_at = datetime.utcnow() if update.completed else None
    db.commit()

    return {"id": chunk.id, "completed": chunk.completed}


@app.delete("/api/videos/{video_id}", status_code=204)
def delete_video(video_id: int, db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    db.delete(video)
    db.commit()
