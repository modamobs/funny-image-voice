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
  user_id: string | null;
}

// 라운드에 올라온 멘트. rank 는 유저 멘트에만 매겨진다.
export interface RoundEntry {
  id: string;
  type: 'ai' | 'user';
  audio_filename: string;
  ai_text: string | null;
  votes: number;
  created_at: string;
  user_id: string | null;
  nickname: string | null;
  picture: string | null;
  voted_by_me: boolean;
  rank?: number;
}

export interface DailyRound {
  id: string;
  image_id: string;
  image_filename: string;
  image_name: string;
  opens_at: string;
  closes_at: string;
  status: 'scheduled' | 'open' | 'closed';
  winner_response_id: string | null;
  is_open: boolean;
  entry_count: number;
  my_entry_id: string | null;
  entries: RoundEntry[];
  ai_entries: RoundEntry[];
  winner: RoundEntry | null;
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
