import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:3001/api' });

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

export const AUDIO_URL = (filename: string) =>
  `http://localhost:3001/uploads/audio/${filename}`;
export const IMAGE_URL = (filename: string) =>
  `http://localhost:3001/uploads/images/${filename}`;
