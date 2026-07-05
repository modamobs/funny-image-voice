import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const api = axios.create({ baseURL: `${BASE}/api` });

export const getImages = () => api.get('/images');
export const getImage = (id: string) => api.get(`/images/${id}`);
export const uploadImage = (file: File) => {
  const form = new FormData();
  form.append('image', file);
  return api.post('/images', form);
};
export const generateAiResponse = (imageId: string) =>
  api.post(`/images/${imageId}/ai-response`);
export const uploadUserResponse = (imageId: string, blob: Blob) => {
  const form = new FormData();
  form.append('audio', blob, 'recording.webm');
  return api.post(`/images/${imageId}/user-response`, form);
};
export const vote = (responseId: string) => api.post(`/responses/${responseId}/vote`);

export const getComments = (imageId: string) => api.get(`/images/${imageId}/comments`);
export const postComment = (imageId: string, nickname: string, text: string) =>
  api.post(`/images/${imageId}/comments`, { nickname, text });

// filename이 이미 R2 전체 URL이면 그대로, 아니면 로컬 서버 경로로
export const AUDIO_URL = (filename: string) =>
  filename.startsWith('http') ? filename : `${BASE}/uploads/audio/${filename}`;
export const IMAGE_URL = (filename: string) =>
  filename.startsWith('http') ? filename : `${BASE}/uploads/images/${filename}`;
