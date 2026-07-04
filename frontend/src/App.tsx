import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ImageDetail from './pages/ImageDetail';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/image/:id" element={<ImageDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
