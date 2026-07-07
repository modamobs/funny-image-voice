import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ImageDetail from './pages/ImageDetail';
import Admin from './pages/Admin';
import Profile from './pages/Profile';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/image/:id" element={<ImageDetail />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
