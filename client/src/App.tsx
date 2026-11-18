import { Routes, Route } from 'react-router'
import './App.css'

import Register from "./pages/register"
import Login from "./pages/login"
import Landing from './pages/landing'

function App() {

  return (
    <>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
    </Routes>
    </>
  )
}

export default App
