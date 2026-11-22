import { Routes, Route } from 'react-router'
import './App.css'

import Register from "./pages/register"
import Login from "./pages/login"
import Landing from './pages/landing'
import Dashboard from './pages/dashboard'
import Project from "./pages/project"

function App() {

  return (
    <>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/project" element={<Project />} />
    </Routes>
    </>
  )
}

export default App
