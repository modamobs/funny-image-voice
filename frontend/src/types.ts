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
  user_id: string | null;
  nickname: string | null;
  voted_by_me: boolean;
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
  likes: number;
  liked_by_me: boolean;
  parent_id: string | null;
  country_code: string | null;
}
