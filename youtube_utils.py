# youtube_utils.py

import os
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from dotenv import load_dotenv
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled

# Load environment variables
load_dotenv()

# Get the YouTube API key from environment variables
YOUTUBE_API_KEY = "AIzaSyBNXevtPCknFIPWCfelMuMlRSRv_WMY7ts"

def get_video_info(video_id):
    """
    Fetch video information using the YouTube Data API v3.

    Args:
        video_id (str): The ID of the YouTube video.

    Returns:
        dict: A dictionary containing video information (title, description, etc.).
    """
    youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)

    try:
        # Call the videos().list method to retrieve video details
        video_response = youtube.videos().list(
            part='snippet,contentDetails,statistics',
            id=video_id
        ).execute()

        if not video_response['items']:
            return None

        video_data = video_response['items'][0]
        
        return {
            'title': video_data['snippet']['title'],
            'description': video_data['snippet']['description'],
            'published_at': video_data['snippet']['publishedAt'],
            'view_count': video_data['statistics']['viewCount'],
            'like_count': video_data['statistics']['likeCount'],
            'duration': video_data['contentDetails']['duration']
        }
    except HttpError as e:
        print(f"An HTTP error {e.resp.status} occurred: {e.content}")
        return None

def get_video_transcript(video_id):
    """
    Fetch video transcript using the YouTube Transcript API.

    Args:
        video_id (str): The ID of the YouTube video.

    Returns:
        str: The transcript text of the video, or None if transcript is not available.
    """
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        return ' '.join([entry['text'] for entry in transcript])
    except TranscriptsDisabled:
        print(f"Transcripts are disabled for video: {video_id}")
        return None
    except Exception as e:
        print(f"An error occurred while fetching transcript: {str(e)}")
        return None