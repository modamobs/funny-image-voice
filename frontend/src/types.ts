export interface ImageItem {
  id: string;
  filename: string;
  original_name: string;
  created_at: string;
  response_count?: number;
}

export interface Response {
  id: string;
  image_id: string;
  type: 'ai' | 'user';
  audio_filename: string;
  ai_text?: string;
  votes: number;
  created_at: string;
}

export interface ImageDetail extends ImageItem {
  responses: Response[];
}

export interface Comment {
  id: string;
  image_id: string;
  user_id: string | null;
  nickname: string;
  text: string;
  created_at: string;
}
