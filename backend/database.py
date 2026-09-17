import os
from pathlib import Path

from sqlalchemy import create_engine, Column, Integer, String, Boolean, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime

# Resolve DB location:
#   1. NIBBLIFY_DB_PATH env var (set by the Electron wrapper to a user-writable dir)
#   2. Fallback: ./learner.db next to backend/ for plain `uvicorn` dev runs
_db_path = os.environ.get("NIBBLIFY_DB_PATH")
if _db_path:
    Path(_db_path).parent.mkdir(parents=True, exist_ok=True)
    DATABASE_URL = f"sqlite:///{_db_path}"
else:
    DATABASE_URL = "sqlite:///./learner.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True)
    youtube_id = Column(String, unique=True, index=True)
    title = Column(String)
    url = Column(String)
    thumbnail = Column(String)
    total_duration = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    chunks = relationship("Chunk", back_populates="video", order_by="Chunk.order", cascade="all, delete-orphan")


class Chunk(Base):
    __tablename__ = "chunks"

    id = Column(Integer, primary_key=True)
    video_id = Column(Integer, ForeignKey("videos.id"))
    title = Column(String)
    summary = Column(Text)
    start_time = Column(Float)
    end_time = Column(Float)
    order = Column(Integer)
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime, nullable=True)
    video = relationship("Video", back_populates="chunks")


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
